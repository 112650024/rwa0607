/* v2 部署:RegulatedTWD + PriceOracle + StockFactory + LendingPool + StockIPO
 * 餵入精選台股現價、量產代幣、種借貸流動性、開一檔 IPO,
 * 並輸出含「位址 + ABI」的 deployed.json 給前端(onchain 本地 + frontend/src)。
 * 用法:npx hardhat run scripts/deploy.js --network sepolia                      */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const STOCKS = require("../stocks.js");

const TWSE = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const FALLBACK = { "2330":2355,"2317":205,"2454":1280,"2308":402,"2303":54,
  "2412":126,"2882":66,"2881":92,"2603":195,"3008":2520,"0050":190,"2891":39 };

async function fetchPrices() {
  const map = {};
  try {
    const { data } = await axios.get(TWSE, { timeout: 15000 });
    for (const r of data) if (r.ClosingPrice && !isNaN(parseFloat(r.ClosingPrice))) map[r.Code] = parseFloat(r.ClosingPrice);
  } catch (e) { console.warn("TWSE 抓取失敗,改用後備價:", e.message); }
  return map;
}

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const F = (n) => ethers.getContractFactory(n);
  const dep = async (n, ...a) => { const c = await (await F(n)).deploy(...a); await c.waitForDeployment(); return c; };

  const twd = await dep("RegulatedTWD", deployer.address);
  const oracle = await dep("PriceOracle");
  const factory = await dep("StockFactory", await twd.getAddress(), await oracle.getAddress());
  const lending = await dep("LendingPool", await twd.getAddress(), deployer.address);
  const ipo = await dep("StockIPO", await twd.getAddress(), deployer.address);

  const twdAddr = await twd.getAddress();
  console.log("RegulatedTWD:", twdAddr);
  console.log("PriceOracle :", await oracle.getAddress());
  console.log("StockFactory:", await factory.getAddress());
  console.log("LendingPool :", await lending.getAddress());
  console.log("StockIPO    :", await ipo.getAddress());

  // 1) 餵價
  const market = await fetchPrices();
  const symbols = [], prices = [];
  for (const s of STOCKS) {
    const p = market[s.code] ?? FALLBACK[s.code];
    if (!p) { console.warn("略過(無價):", s.code); continue; }
    symbols.push(ethers.encodeBytes32String(s.code));
    prices.push(Math.round(p * 100));
  }
  await (await oracle.updatePrices(symbols, prices, 2)).wait();
  console.log(`已餵價 ${symbols.length} 檔`);

  // 2) 量產代幣
  const out = [];
  for (const s of STOCKS) {
    const sym = ethers.encodeBytes32String(s.code);
    await (await factory.createStock(sym, s.name, s.tokenSymbol)).wait();
    const token = await factory.tokenOf(sym);
    out.push({ ...s, token });
    console.log("createStock", s.code, s.tokenSymbol, "->", token);
  }

  // 3) 借貸:登記所有台股為抵押品
  for (const s of out) { await (await lending.addCollateral(s.token)).wait(); }
  console.log("已登記抵押品", out.length, "檔");

  // 4) 種流動性:發行人領 TWD 並存入借貸池
  await (await twd.mintTWD(5_000_000n)).wait();              // 500 萬 TWD(自動同步儲備)
  const lendSeed = 1_000_000n * 10n ** 6n;                   // 存入 100 萬
  await (await twd.approve(await lending.getAddress(), lendSeed)).wait();
  await (await lending.depositTWD(lendSeed)).wait();
  console.log("已種借貸流動性 1,000,000 TWD");

  // 5) 開一檔 IPO(以 0050 為標的,10% 折價,庫存 200 股)
  const ipoStock = out.find((s) => s.code === "0050") ?? out[0];
  const stockC = await ethers.getContractAt("StockToken", ipoStock.token);
  const pps = await stockC.pricePerShare();                  // TWD(6)/股
  await (await twd.approve(ipoStock.token, pps * 200n)).wait();
  await (await stockC.mint(pps * 200n)).wait();              // 鑄造 ~200 股庫存
  const invBal = await stockC.balanceOf(deployer.address);
  await (await stockC.approve(await ipo.getAddress(), invBal)).wait();
  const ipoPrice = pps * 90n / 100n;                         // 折價 10%
  const now = Math.floor(Date.now() / 1000);
  await (await ipo.createOffering(ipoStock.token, ipoPrice, invBal, now - 60, now + 7 * 24 * 3600)).wait();
  console.log("已開 IPO:", ipoStock.code, ipoStock.tokenSymbol, "庫存", invBal.toString());

  // 6) 輸出 deployed.json(位址 + ABI)
  const abi = async (n) => (await hre.artifacts.readArtifact(n)).abi;
  const deployed = {
    network: hre.network.name,
    chainId: 11155111,
    explorer: "https://sepolia.etherscan.io",
    contracts: {
      twd: { address: twdAddr, abi: await abi("RegulatedTWD") },
      oracle: { address: await oracle.getAddress(), abi: await abi("PriceOracle") },
      factory: { address: await factory.getAddress(), abi: await abi("StockFactory") },
      lending: { address: await lending.getAddress(), abi: await abi("LendingPool") },
      ipo: { address: await ipo.getAddress(), abi: await abi("StockIPO") },
    },
    stockTokenAbi: await abi("StockToken"),
    stocks: out,
    ipoOfferings: [{ id: 0, code: ipoStock.code, token: ipoStock.token }],
  };
  fs.writeFileSync(path.join(__dirname, "..", "deployed.json"), JSON.stringify(deployed, null, 2));
  fs.writeFileSync(path.join(__dirname, "..", "..", "frontend", "src", "deployed.json"), JSON.stringify(deployed, null, 2));
  console.log("已寫入 deployed.json(onchain 本地 + frontend/src)");
}
main().catch((e) => { console.error(e); process.exit(1); });
