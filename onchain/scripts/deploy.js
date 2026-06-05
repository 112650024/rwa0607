/* 部署:MockTWD + PriceOracle + StockFactory,餵入精選台股現價,並量產各檔代幣。
 * 結果寫入 deployed.json(本地)與 ../frontend/deployed.json(供前端讀取)。
 * 用法:npx hardhat run scripts/deploy.js --network sepolia            */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const STOCKS = require("../stocks.js");

const TWSE = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
// 抓不到即時價時的後備價(約略值,僅供 demo 不中斷)
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

  const twd = await (await ethers.getContractFactory("MockTWD")).deploy();        await twd.waitForDeployment();
  const oracle = await (await ethers.getContractFactory("PriceOracle")).deploy();  await oracle.waitForDeployment();
  const factory = await (await ethers.getContractFactory("StockFactory"))
        .deploy(await twd.getAddress(), await oracle.getAddress());                await factory.waitForDeployment();

  console.log("MockTWD     :", await twd.getAddress());
  console.log("PriceOracle :", await oracle.getAddress());
  console.log("StockFactory:", await factory.getAddress());

  const market = await fetchPrices();

  // 1) 餵價(2 位小數:價 ×100)
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

  const deployed = {
    network: hre.network.name,
    chainId: 11155111,
    twd: await twd.getAddress(),
    oracle: await oracle.getAddress(),
    factory: await factory.getAddress(),
    stocks: out,
  };
  fs.writeFileSync(path.join(__dirname, "..", "deployed.json"), JSON.stringify(deployed, null, 2));
  fs.writeFileSync(path.join(__dirname, "..", "..", "frontend", "deployed.json"), JSON.stringify(deployed, null, 2));
  console.log("已寫入 deployed.json(本地 + 前端)");
}
main().catch((e) => { console.error(e); process.exit(1); });
