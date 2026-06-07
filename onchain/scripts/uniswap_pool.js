/* 在 Sepolia 用 Uniswap v3 建立 dTSMC/TWD 池並灌入全幅流動性。
 * 站內 swap 與 app.uniswap.org 共用此池。
 * 用法:npx hardhat run scripts/uniswap_pool.js --network sepolia               */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Uniswap v3 @ Sepolia(已驗證有 bytecode)
const UNI = {
  factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
  npm: "0x1238536071E1c677A632429e3655c799b22cDA52",
  router: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E", // SwapRouter02
  quoter: "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3", // QuoterV2
};
const FEE = 3000; // 0.3%
const TICK = 887220; // 全幅(60 對齊)

const NPM_ABI = [
  "function createAndInitializePoolIfNecessary(address token0,address token1,uint24 fee,uint160 sqrtPriceX96) external payable returns (address pool)",
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) external payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)",
];
const FACTORY_ABI = ["function getPool(address,address,uint24) view returns (address)"];
const ERC20_ABI = ["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"];

function isqrt(n) { if (n < 2n) return n; let x = n, y = (x + 1n) / 2n; while (y < x) { x = y; y = (x + n / x) / 2n; } return x; }

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const dpath = path.join(__dirname, "..", "deployed.json");
  const d = JSON.parse(fs.readFileSync(dpath));
  const twdAddr = d.contracts.twd.address;
  const stock = d.stocks.find((s) => s.code === "2330");
  const tsmcAddr = stock.token;

  const twd = await ethers.getContractAt("RegulatedTWD", twdAddr);
  const tsmc = await ethers.getContractAt("StockToken", tsmcAddr);
  const pps = await tsmc.pricePerShare(); // raw TWD(6) / 股
  console.log("pricePerShare:", pps.toString());

  // 備料:200 股 dTSMC + 對應 TWD
  const SHARES = 200n;
  const twdForLiq = SHARES * pps;            // 灌流動性用 TWD
  const tsmcForLiq = SHARES * 10n ** 18n;    // 200 股
  console.log("需求:", ethers.formatUnits(twdForLiq, 6), "TWD +", ethers.formatUnits(tsmcForLiq, 18), "dTSMC");

  // 領 TWD(夠買庫存 + 灌池)
  await (await twd.mintTWD(2_000_000n)).wait();
  // 鑄造 dTSMC 庫存
  await (await twd.approve(tsmcAddr, twdForLiq)).wait();
  await (await tsmc.mint(twdForLiq)).wait();
  console.log("已備料:dTSMC 餘額", ethers.formatUnits(await tsmc.balanceOf(deployer.address), 18));

  // token0 / token1 依地址排序
  const a = BigInt(twdAddr), b = BigInt(tsmcAddr);
  const token0 = a < b ? twdAddr : tsmcAddr;
  const token1 = a < b ? tsmcAddr : twdAddr;
  const twdIsToken0 = a < b;

  // price = token1_raw / token0_raw(公允價);R = dTSMC_raw/TWD_raw = 1e18/pps
  let priceNum, priceDen;
  if (twdIsToken0) { priceNum = 10n ** 18n; priceDen = pps; }   // token1=dTSMC
  else { priceNum = pps; priceDen = 10n ** 18n; }               // token1=TWD
  const sqrtPriceX96 = isqrt((priceNum << 192n) / priceDen);
  console.log("sqrtPriceX96:", sqrtPriceX96.toString());

  const npm = new ethers.Contract(UNI.npm, NPM_ABI, deployer);
  const factory = new ethers.Contract(UNI.factory, FACTORY_ABI, deployer);

  // 建池(若未建)
  await (await npm.createAndInitializePoolIfNecessary(token0, token1, FEE, sqrtPriceX96)).wait();
  const pool = await factory.getPool(token0, token1, FEE);
  console.log("Pool:", pool);

  // 授權 NPM
  const amount0 = twdIsToken0 ? twdForLiq : tsmcForLiq;
  const amount1 = twdIsToken0 ? tsmcForLiq : twdForLiq;
  await (await new ethers.Contract(token0, ERC20_ABI, deployer).approve(UNI.npm, amount0)).wait();
  await (await new ethers.Contract(token1, ERC20_ABI, deployer).approve(UNI.npm, amount1)).wait();

  // 灌全幅流動性
  const mintTx = await npm.mint({
    token0, token1, fee: FEE,
    tickLower: -TICK, tickUpper: TICK,
    amount0Desired: amount0, amount1Desired: amount1,
    amount0Min: 0, amount1Min: 0,
    recipient: deployer.address,
    deadline: Math.floor(Date.now() / 1000) + 1800,
  });
  const rc = await mintTx.wait();
  console.log("已灌流動性 tx:", rc.hash);

  // 寫回 deployed.json(雙路徑)
  d.uniswap = {
    factory: UNI.factory, npm: UNI.npm, router: UNI.router, quoter: UNI.quoter,
    pool, token0, token1, fee: FEE,
    twd: twdAddr, stockToken: tsmcAddr, stockCode: "2330", stockSymbol: "dTSMC",
  };
  fs.writeFileSync(dpath, JSON.stringify(d, null, 2));
  fs.writeFileSync(path.join(__dirname, "..", "..", "frontend", "src", "deployed.json"), JSON.stringify(d, null, 2));
  console.log("已寫入 uniswap 區塊到 deployed.json");
}
main().catch((e) => { console.error(e); process.exit(1); });
