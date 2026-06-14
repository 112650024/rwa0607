// 後端代抓台股報價(避開瀏覽器 CORS / MIS 防爬)。
// 優先 TWSE MIS 即時報價(成交價 z + 開高低),失敗退回 STOCK_DAY_ALL 當日收盤。
// 回精選 12 檔的 現價/漲跌/開高低,供前端畫「當日走勢線」與「盤中即時漲跌%」。
// getQuotes() 供 Vercel handler 與 Vite dev 外掛(vite.config.ts)共用,本機/線上行為一致。
const CODES = ["2330", "2317", "2454", "2308", "2303", "2412", "2882", "2881", "2603", "3008", "0050", "2891"]

// 1) MIS 即時(最準)
async function fromMIS() {
  const ex_ch = CODES.map((c) => `tse_${c}.tw`).join("|")
  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${ex_ch}&json=1&delay=0&_=${Date.now()}`
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Referer: "https://mis.twse.com.tw/stock/index.jsp" },
  })
  const data = await r.json()
  if (!data || data.rtcode !== "0000" || !Array.isArray(data.msgArray)) throw new Error("mis bad")
  const out = {}
  for (const s of data.msgArray) {
    const z = parseFloat(s.z), y = parseFloat(s.y), o = parseFloat(s.o)
    const close = isFinite(z) && z > 0 ? z : y // 成交價優先,否則昨收
    if (!isFinite(close) || close <= 0) continue
    out[s.c] = {
      close,
      change: isFinite(y) ? +(close - y).toFixed(2) : 0, // 盤中即時漲跌(對昨收)
      open: isFinite(o) && o > 0 ? o : close, // 當日開盤(走勢線起點)
      high: parseFloat(s.h) || close,
      low: parseFloat(s.l) || close,
    }
  }
  if (!Object.keys(out).length) throw new Error("mis empty")
  return out
}

// 2) 後備:當日收盤
async function fromDaily() {
  const r = await fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL")
  const data = await r.json()
  const set = new Set(CODES)
  const out = {}
  for (const x of data) {
    if (!set.has(x.Code) || !x.ClosingPrice) continue
    const close = parseFloat(x.ClosingPrice)
    out[x.Code] = {
      close,
      change: parseFloat(x.Change) || 0,
      open: parseFloat(x.OpeningPrice) || close,
      high: parseFloat(x.HighestPrice) || close,
      low: parseFloat(x.LowestPrice) || close,
    }
  }
  return out
}

/** 取得 12 檔報價(MIS 即時 → 收盤後備 → 空物件)。Vercel handler 與 Vite dev 共用。 */
export async function getQuotes() {
  try {
    return await fromMIS()
  } catch {
    try {
      return await fromDaily()
    } catch {
      return {}
    }
  }
}

export default async function handler(_req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=300")
  res.status(200).json(await getQuotes())
}
