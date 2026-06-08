import { useEffect, useState } from "react"

export type TwseQuote = { close: number; change: number; open: number; high: number; low: number }

/** 從 /api/twse 取真實台股日報(收盤/漲跌/開高低),每 5 分鐘更新。 */
export function useTwse(): Record<string, TwseQuote> {
  const [q, setQ] = useState<Record<string, TwseQuote>>({})
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch("/api/twse")
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => { if (alive) setQ(d || {}) })
        .catch(() => {})
    load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => { alive = false; clearInterval(id) }
  }, [])
  return q
}
