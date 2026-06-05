/* 鏈下餵價腳本:從 TWSE OpenAPI 抓全市場台股收盤價,批次推上 PriceOracle。
 * 需 .env:SEPOLIA_RPC_URL、PRIVATE_KEY、ORACLE_ADDRESS、FEED_LIMIT。
 * 用法:node scripts/feeder.js                                              */
require("dotenv").config();
const { ethers } = require("ethers");
const axios = require("axios");
const STOCKS = require("../stocks.js");

const TWSE = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const ORACLE_ABI = [
  "function updatePrices(bytes32[] symbols, int256[] prices, uint8 decimals) external",
];
const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const LIMIT = Number(process.env.FEED_LIMIT || 120);
const CHUNK = 40;                  // 每筆交易餵 40 檔,控制 gas/tx 大小
const INTERVAL_MS = 10 * 60 * 1000; // 每 10 分鐘更新一次

if (!process.env.PRIVATE_KEY || !process.env.ORACLE_ADDRESS) {
  console.error("請在 .env 設定 PRIVATE_KEY 與 ORACLE_ADDRESS"); process.exit(1);
}
const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const oracle = new ethers.Contract(process.env.ORACLE_ADDRESS, ORACLE_ABI, wallet);

async function pickStocks() {
  const { data } = await axios.get(TWSE, { timeout: 20000 });
  const valid = data.filter((r) => r.ClosingPrice && !isNaN(parseFloat(r.ClosingPrice)));
  // 精選清單優先,再補滿到 LIMIT 檔
  const pri = new Set(STOCKS.map((s) => s.code));
  const head = valid.filter((r) => pri.has(r.Code));
  const tail = valid.filter((r) => !pri.has(r.Code));
  return [...head, ...tail].slice(0, LIMIT);
}

async function feedOnce() {
  const rows = await pickStocks();
  console.log(`[${new Date().toLocaleString()}] 準備餵價 ${rows.length} 檔(共抓到全市場)`);
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const symbols = slice.map((r) => ethers.encodeBytes32String(r.Code));
    const prices = slice.map((r) => Math.round(parseFloat(r.ClosingPrice) * 100));
    const tx = await oracle.updatePrices(symbols, prices, 2);
    await tx.wait();
    console.log(`  批次 ${i / CHUNK + 1}:${slice.length} 檔 → tx ${tx.hash}`);
  }
  console.log("本輪完成。");
}

(async () => {
  await feedOnce();
  setInterval(() => feedOnce().catch((e) => console.error("餵價失敗:", e.message)), INTERVAL_MS);
  console.log(`已啟動,每 ${INTERVAL_MS / 60000} 分鐘更新一次。Ctrl+C 結束。`);
})();
