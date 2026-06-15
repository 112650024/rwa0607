/* 鏈下餵價腳本(即時版):
 * 優先用 TWSE MIS 即時報價 API 抓「成交價 z」(盤中接近即時,最準);
 * 某檔無即時價或 MIS 整批失敗時,自動 fallback 到 STOCK_DAY_ALL 當日收盤價。
 * 把精選清單(stocks.js,可用 EXTRA_CODES 追加)批次推上 PriceOracle。
 * 需 .env:SEPOLIA_RPC_URL、PRIVATE_KEY、ORACLE_ADDRESS。
 * 用法:node scripts/feeder.js                                                  */
require("dotenv").config();
const { ethers } = require("ethers");
const axios = require("axios");
const STOCKS = require("../stocks.js");

const MIS = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp";
const STOCK_DAY_ALL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const ORACLE_ABI = [
  "function updatePrices(bytes32[] symbols, int256[] prices, uint8 decimals) external",
];
const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const INTERVAL_MS = Number(process.env.FEED_INTERVAL_MS || 60 * 1000); // 預設每 60 秒
const MIS_CHUNK = 50;  // MIS 單次抓取股票數(避免單一請求過大)
const TX_CHUNK = 40;   // 單筆交易餵的股票數(控 gas / tx 大小)

if (!process.env.PRIVATE_KEY || !process.env.ORACLE_ADDRESS) {
  console.error("請在 .env 設定 PRIVATE_KEY 與 ORACLE_ADDRESS"); process.exit(1);
}
const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const oracle = new ethers.Contract(process.env.ORACLE_ADDRESS, ORACLE_ABI, wallet);

// 餵價清單:精選 stocks.js(可在 .env 用 EXTRA_CODES=1101,1216 追加)
const extra = (process.env.EXTRA_CODES || "").split(",").map((s) => s.trim()).filter(Boolean);
const CODES = [...new Set([...STOCKS.map((s) => s.code), ...extra])];
const exch = (code) => `tse_${code}.tw`; // 上市;若加上櫃股票需改 otc_

const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };

// 從 MIS 單檔資料挑「當前價」:成交價 z → 前筆 pz → 最佳買賣價中間價(盤中 z 暫無成交時最關鍵)
//                              → 今日開盤 o → 昨收 y。避免盤中 z 為「-」時誤用昨收(看起來像沒更新)。
function pickRealtimePrice(s) {
  const first = (str) => parseFloat(String(str || "").split("_")[0]);
  const z = parseFloat(s.z);
  if (isFinite(z) && z > 0) return z;
  const pz = parseFloat(s.pz);
  if (isFinite(pz) && pz > 0) return pz;
  const bid = first(s.b), ask = first(s.a);
  if (isFinite(bid) && bid > 0 && isFinite(ask) && ask > 0) return (bid + ask) / 2; // 委買/委賣中間價
  if (isFinite(bid) && bid > 0) return bid;
  if (isFinite(ask) && ask > 0) return ask;
  const o = parseFloat(s.o);
  if (isFinite(o) && o > 0) return o;
  const y = parseFloat(s.y);
  return isFinite(y) && y > 0 ? y : NaN;
}

// 1) MIS 即時價(成交價優先,盤中無成交退買賣中間價)。回傳 { code: price }
async function fetchRealtime(codes) {
  const out = {};
  for (const grp of chunk(codes, MIS_CHUNK)) {
    const ex_ch = grp.map(exch).join("|");
    try {
      const { data } = await axios.get(MIS, {
        params: { ex_ch, json: 1, delay: 0, _: Date.now() },
        headers: { "User-Agent": "Mozilla/5.0", Referer: "https://mis.twse.com.tw/stock/index.jsp" },
        timeout: 12000,
      });
      if (!data || data.rtcode !== "0000" || !Array.isArray(data.msgArray)) continue;
      for (const s of data.msgArray) {
        const px = pickRealtimePrice(s);
        if (isFinite(px) && px > 0) out[s.c] = px;
      }
    } catch (e) { console.warn("  MIS 批次失敗:", e.message.slice(0, 60)); }
  }
  return out;
}

// 2) 後備:當日收盤價(MIS 失敗或某檔缺值時補)
async function fetchDailyFallback() {
  try {
    const { data } = await axios.get(STOCK_DAY_ALL, { timeout: 15000 });
    const map = {};
    for (const r of data) if (r.ClosingPrice && !isNaN(parseFloat(r.ClosingPrice))) map[r.Code] = parseFloat(r.ClosingPrice);
    return map;
  } catch (e) { console.warn("  STOCK_DAY_ALL 後備失敗:", e.message.slice(0, 60)); return {}; }
}

async function feedOnce() {
  const rt = await fetchRealtime(CODES);
  const missing = CODES.filter((c) => !(c in rt));
  const fallback = missing.length ? await fetchDailyFallback() : {};

  const rows = [];
  for (const code of CODES) {
    const px = rt[code] ?? fallback[code];
    if (px && isFinite(px) && px > 0) rows.push({ code, px, src: rt[code] ? "即時" : "收盤" });
  }
  if (!rows.length) { console.warn("本輪無有效價格,略過"); return; }

  const live = rows.filter((r) => r.src === "即時").length;
  console.log(`[${new Date().toLocaleString()}] 餵價 ${rows.length} 檔(即時 ${live} / 後備收盤 ${rows.length - live})`);
  for (const grp of chunk(rows, TX_CHUNK)) {
    const symbols = grp.map((r) => ethers.encodeBytes32String(r.code));
    const prices = grp.map((r) => Math.round(r.px * 100));
    const tx = await oracle.updatePrices(symbols, prices, 2);
    await tx.wait();
    console.log(`  → ${grp.length} 檔 tx ${tx.hash}`);
  }
  const tsmc = rows.find((r) => r.code === "2330");
  if (tsmc) console.log(`  台積電(2330) = ${tsmc.px}(${tsmc.src})`);
}

(async () => {
  await feedOnce();
  setInterval(() => feedOnce().catch((e) => console.error("餵價失敗:", e.message)), INTERVAL_MS);
  console.log(`已啟動,每 ${INTERVAL_MS / 1000} 秒更新一次。Ctrl+C 結束。`);
})();
