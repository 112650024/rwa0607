export function Sparkline({
  data,
  w = 130,
  h = 36,
  color,
}: {
  data: number[]
  w?: number
  h?: number
  color?: string
}) {
  if (data.length < 2) return null
  const mn = Math.min(...data)
  const mx = Math.max(...data)
  const rng = mx - mn || 1
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - mn) / rng) * (h - 7)])
  const line = pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")
  const col = color ?? (data[data.length - 1] >= data[0] ? "var(--up)" : "var(--down)")
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={`0,${h} ${line} ${w},${h}`} fill={col} opacity="0.1" />
      <polyline points={line} fill="none" stroke={col} strokeWidth="1.6" />
    </svg>
  )
}
