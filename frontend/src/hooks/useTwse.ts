import { useEffect, useState } from "react"

export type TwseQuote = { close: number; change: number; open: number; high: number; low: number }

/** 從 /api/twse 取真實台股報價(MIS 即時優先,收盤後備),每 60 秒更新。 */
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
    const id = setInterval(load, 60 * 1000)
    return () => { alive = false; clearInterval(id) }
  }, [])
  return q
}

/** 從 /api/history 取真實近 N 日每日收盤序列 { code: number[] }。日資料,掛載抓一次即可。 */
export function useTwseHistory(): Record<string, number[]> {
  const [h, setH] = useState<Record<string, number[]>>({})
  useEffect(() => {
    let alive = true
    fetch("/api/history")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => { if (alive) setH(d || {}) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  return h
}
