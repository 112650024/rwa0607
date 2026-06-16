// 量化風險 / 估值引擎(題目七)。
// 用真實近月每日收盤(TWSE STOCK_DAY)算:年化波動度、動能、風險分數(0–100)、風險驅動的建議 LTV。
// 純函式、決定性、可在前端即時計算。

export type RiskMetrics = {
  hasData: boolean
  annualVolPct: number // 年化波動度(%)
  momentumPct: number // 區間(近月)報酬(%)
  riskScore: number // 0–100,越高越危險
  suggestedLtvBps: number // 建議 LTV(bps,10000 = 100%)
  label: "低" | "中" | "高"
}

const VOL_FLOOR = 0.12 // 年化波動 12% → 風險低標
const VOL_CAP = 0.6 // 年化波動 60% → 風險高標
const LTV_MAX_BPS = 6500 // 低風險最高可借成數 65%
const LTV_MIN_BPS = 3000 // 高風險最低可借成數 30%

/** 由每日收盤序列算風險指標。資料不足時回 hasData=false、給中性預設。 */
export function computeRisk(closes?: number[]): RiskMetrics {
  if (!closes || closes.length < 5) {
    return { hasData: false, annualVolPct: 0, momentumPct: 0, riskScore: 0, suggestedLtvBps: 5000, label: "中" }
  }
  const rets: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const r = closes[i] / closes[i - 1] - 1
    if (isFinite(r)) rets.push(r)
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rets.length - 1)
  const annualVol = Math.sqrt(variance) * Math.sqrt(252) // 年化波動度
  const momentum = closes[closes.length - 1] / closes[0] - 1

  const t = Math.min(1, Math.max(0, (annualVol - VOL_FLOOR) / (VOL_CAP - VOL_FLOOR)))
  const riskScore = Math.round(t * 100)
  const suggestedLtvBps = Math.round(LTV_MAX_BPS - t * (LTV_MAX_BPS - LTV_MIN_BPS))
  const label = riskScore < 34 ? "低" : riskScore < 67 ? "中" : "高"

  return {
    hasData: true,
    annualVolPct: annualVol * 100,
    momentumPct: momentum * 100,
    riskScore,
    suggestedLtvBps,
    label,
  }
}
