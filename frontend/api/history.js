// 抓 TWSE 每日收盤歷史(當月),供前端畫「真實近 N 日走勢線」(每檔股票畫自己真實的近月收盤)。
// 日資料變動慢 → 長快取(12h)。getHistory() 供 Vercel handler 與 Vite dev 外掛(vite.config.ts)共用。
// 來源若被擋(IP/429)→ 回空物件,前端自動退回合成走勢,不致崩。
const CODES = ["2330", "2317", "2454", "2308", "2303", "2412", "2882", "2881", "2603", "3008", "0050", "2891"]
const N = 22 // 取最近 N 個交易日收盤

const monthParam = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}01`
const toNum = (v) => parseFloat(String(v).replace(/,/g, ""))

// 抓單檔當月每日收盤(STOCK_DAY 回傳整月)。row: [日期,成交股數,成交金額,開,高,低,收,漲跌,筆數]
async function fetchMonth(code, dateParam) {
  const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${dateParam}&stockNo=${code}`
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
  const d = await r.json()
  if (!d || d.stat !== "OK" || !Array.isArray(d.data)) return []
  return d.data.map((row) => toNum(row[6])).filter((x) => isFinite(x) && x > 0)
}

/** 取 12 檔近 N 日收盤序列 { code: number[] }。分批抓避免 TWSE 429 / serverless 逾時。 */
export async function getHistory() {
  const now = new Date()
  const thisMonth = monthParam(now)
  const prevMonth = monthParam(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const out = {}
  for (let i = 0; i < CODES.length; i += 4) {
    const batch = CODES.slice(i, i + 4)
    const res = await Promise.all(
      batch.map(async (c) => {
        let closes = await fetchMonth(c, thisMonth).catch(() => [])
        // 月初當月資料太少 → 補抓上個月,湊足走勢
        if (closes.length < 8) {
          const prev = await fetchMonth(c, prevMonth).catch(() => [])
          closes = [...prev, ...closes]
        }
        return closes
      }),
    )
    batch.forEach((c, j) => {
      if (res[j].length) out[c] = res[j].slice(-N)
    })
  }
  return out
}

export default async function handler(_req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Cache-Control", "s-maxage=43200, stale-while-revalidate=86400")
  res.status(200).json(await getHistory())
}
