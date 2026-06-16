/* 清算 keeper(鏈下機器人):補足 DeFi「自動清算」缺口。
 * 掃 Borrow 事件找出借款人 → 每隔一段時間輪詢健康因子 → 低於 1.0(10000 bps)自動清算。
 * 需 .env:PRIVATE_KEY、(選)SEPOLIA_RPC_URL、(選)KEEPER_INTERVAL_MS。
 * LendingPool / TWD 位址讀 onchain/deployed.json(或用 LENDING_ADDRESS 覆蓋)。
 * 用法:node scripts/keeper.js                                                        */
require("dotenv").config();
const { ethers } = require("ethers");

let deployed = {};
try { deployed = require("../deployed.json"); } catch { /* 改用環境變數 */ }

const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const INTERVAL_MS = Number(process.env.KEEPER_INTERVAL_MS || 30000);
const LENDING_ADDR = process.env.LENDING_ADDRESS || deployed?.contracts?.lending?.address;
const TWD_ADDR = process.env.TWD_ADDRESS || deployed?.contracts?.twd?.address;
const SCAN_BLOCKS = 120000; // 往回掃多少區塊找借款人
const STEP = 9000;          // 分塊查詢(避免 RPC getLogs 範圍限制)

if (!process.env.PRIVATE_KEY) { console.error("請在 .env 設定 PRIVATE_KEY"); process.exit(1); }
if (!LENDING_ADDR) { console.error("找不到 LendingPool 位址(deployed.json 或 LENDING_ADDRESS)"); process.exit(1); }

const LENDING_ABI = [
  "event Borrow(address indexed user, uint256 amount)",
  "function getUserAccount(address) view returns (uint256 collateralTWD, uint256 debtTWD, uint256 borrowable, uint256 hfBps)",
  "function userTokenList(address) view returns (address[])",
  "function userCollateral(address, address) view returns (uint256)",
  "function liquidate(address user, address token, uint256 repayAmount)",
];
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const lending = new ethers.Contract(LENDING_ADDR, LENDING_ABI, wallet);
const twd = TWD_ADDR ? new ethers.Contract(TWD_ADDR, ERC20_ABI, wallet) : null;

const fmt6 = (v) => Number(v) / 1e6;
const hfOf = (bps) => (bps > 10n ** 12n ? Infinity : Number(bps) / 10000);

// 掃 Borrow 事件收集借款人(分塊,容錯)
async function findBorrowers() {
  const latest = await provider.getBlockNumber();
  const from = Math.max(0, latest - SCAN_BLOCKS);
  const set = new Set();
  for (let start = from; start <= latest; start += STEP) {
    const end = Math.min(latest, start + STEP - 1);
    try {
      const logs = await lending.queryFilter(lending.filters.Borrow(), start, end);
      for (const l of logs) set.add(l.args.user);
    } catch { /* 該區塊範圍查詢失敗,略過 */ }
  }
  return [...set];
}

async function tryLiquidate(user, debtTWD) {
  try {
    if (!twd) return console.log("    缺 TWD 位址,無法清算");
    const tokens = await lending.userTokenList(user);
    let token = null;
    for (const t of tokens) { if ((await lending.userCollateral(user, t)) > 0n) { token = t; break; } }
    if (!token) return console.log("    無抵押品可沒收,略過");
    const bal = await twd.balanceOf(wallet.address);
    const repay = debtTWD < bal ? debtTWD : bal;
    if (repay <= 0n) return console.log("    keeper 錢包無 TWD → 先領 TWD 才能代償清算");
    console.log(`    執行清算:代償 ${fmt6(repay).toFixed(0)} TWD 取得折價抵押(+5% 獎勵)…`);
    await (await twd.approve(LENDING_ADDR, repay)).wait();
    const tx = await lending.liquidate(user, token, repay);
    await tx.wait();
    console.log(`    ✅ 已清算 tx ${tx.hash}`);
  } catch (e) { console.log("    清算失敗:", String(e.message || e).slice(0, 90)); }
}

async function tick(borrowers) {
  console.log(`\n[${new Date().toLocaleTimeString()}] 監控 ${borrowers.length} 位借款人`);
  let healthy = 0;
  for (const user of borrowers) {
    let acct;
    try { acct = await lending.getUserAccount(user); } catch { continue; }
    const debt = fmt6(acct.debtTWD);
    if (debt <= 0) { healthy++; continue; }
    const factor = hfOf(acct.hfBps);
    const flag = factor < 1 ? "⚠ 可清算" : "OK";
    console.log(`  ${user.slice(0, 8)}…  抵押 ${fmt6(acct.collateralTWD).toFixed(0)}  借款 ${debt.toFixed(0)}  健康因子 ${factor === Infinity ? "∞" : factor.toFixed(2)}  ${flag}`);
    if (factor < 1) await tryLiquidate(user, acct.debtTWD);
  }
  if (healthy === borrowers.length) console.log("  目前無未償借款部位。");
}

(async () => {
  console.log(`清算 keeper 啟動 | LendingPool ${LENDING_ADDR} | 每 ${INTERVAL_MS / 1000}s 檢查 | keeper ${wallet.address}`);
  let borrowers = await findBorrowers();
  console.log(`初始借款人:${borrowers.length} 位`);
  await tick(borrowers);
  let n = 0;
  setInterval(async () => {
    n++;
    try {
      if (n % 10 === 0) borrowers = await findBorrowers(); // 每 10 輪重掃,納入新借款人
      await tick(borrowers);
    } catch (e) { console.error("keeper 迴圈錯誤:", e.message); }
  }, INTERVAL_MS);
})();
