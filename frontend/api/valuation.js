// AI 估值評語(選配):用 Claude 依量化風險指標,為每檔台股生成一句繁中評語。
// 需 Vercel 環境變數 ANTHROPIC_API_KEY;未設或任何失敗 → 回 {},前端優雅降級(只顯示量化分數)。
// getValuations() 供 Vercel handler 與 Vite dev 外掛共用。
const MODEL = "claude-haiku-4-5" // 便宜、快,適合一句話評語

/** 依風險指標產生 { code: 評語 }。無 key / 失敗一律回 {}。 */
export async function getValuations(stocks) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key || !Array.isArray(stocks) || stocks.length === 0) return {}

  const lines = stocks
    .map(
      (s) =>
        `${s.code} ${s.name}:風險分 ${s.riskScore}/100、年化波動 ${Math.round(s.annualVolPct)}%、` +
        `近月動能 ${s.momentumPct >= 0 ? "+" : ""}${Math.round(s.momentumPct)}%、建議 LTV ${Math.round((s.suggestedLtvBps || 0) / 100)}%`,
    )
    .join("\n")

  const prompt =
    "你是台股風險分析助理。依下列量化指標,為每檔股票各寫一句 25 字內的繁體中文估值/風險評語(專業、口語、不浮誇)。\n" +
    "只輸出 JSON 物件:key = 股票代號字串,value = 評語字串。不要任何多餘文字或 Markdown。\n\n" +
    lines

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    })
    if (!r.ok) return {}
    const data = await r.json()
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
    const m = text.match(/\{[\s\S]*\}/)
    return m ? JSON.parse(m[0]) : {}
  } catch {
    return {}
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  if (req.method !== "POST") {
    res.status(405).json({ comments: {} })
    return
  }
  let body = req.body
  if (typeof body === "string") {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }
  const comments = await getValuations(body?.stocks)
  res.setHeader("Cache-Control", "s-maxage=3600")
  res.status(200).json({ comments })
}
