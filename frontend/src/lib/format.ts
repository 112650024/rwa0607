export const fmtNum = (n: number, dp = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })

export const fmtTWD = (n: number, dp = 0) => "NT$ " + fmtNum(n, dp)

export const fmtPct = (n: number, dp = 2) => (n >= 0 ? "+" : "") + n.toFixed(dp) + "%"

export const fmtCompact = (n: number) =>
  Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)

export const shortAddr = (a?: string) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "")
