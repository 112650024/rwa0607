// Vercel 無伺服器函式:後端代抓 TWSE 全市場日報(避開瀏覽器 CORS),
// 只回精選 12 檔的 收盤/漲跌/開高低,供前端顯示真實走勢與漲跌%。
const CODES = new Set([
  "2330", "2317", "2454", "2308", "2303", "2412",
  "2882", "2881", "2603", "3008", "0050", "2891",
])

export default async function handler(_req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900")
  try {
    const r = await fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL")
    const data = await r.json()
    const out = {}
    for (const x of data) {
      if (!CODES.has(x.Code) || !x.ClosingPrice) continue
      out[x.Code] = {
        close: parseFloat(x.ClosingPrice),
        change: parseFloat(x.Change) || 0,
        open: parseFloat(x.OpeningPrice) || 0,
        high: parseFloat(x.HighestPrice) || 0,
        low: parseFloat(x.LowestPrice) || 0,
      }
    }
    res.status(200).json(out)
  } catch {
    res.status(200).json({})
  }
}
