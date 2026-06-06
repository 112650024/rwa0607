import { useEffect, useRef, useState } from "react"
import { CATALOG } from "@/lib/catalog"

export type Live = { price: number; prev: number; pct: number; hist: number[] }
export type Market = Record<string, Live>

function seed(): Market {
  const m: Market = {}
  for (const s of CATALOG) {
    const hist: number[] = []
    let p = s.fallback
    for (let i = 0; i < 40; i++) {
      p = Math.max(1, p * (1 + (Math.random() - 0.5) * 0.012))
      hist.push(p)
    }
    m[s.code] = { price: s.fallback, prev: s.fallback, pct: 0, hist }
  }
  return m
}

/** 模擬即時行情(random walk)。之後接上預言機時換成鏈上讀取。 */
export function useMarket(intervalMs = 2200): Market {
  const [market, setMarket] = useState<Market>(seed)
  const ref = useRef(market)
  ref.current = market

  useEffect(() => {
    const id = setInterval(() => {
      setMarket((prev) => {
        const next: Market = {}
        for (const s of CATALOG) {
          const cur = prev[s.code]
          const drift = (Math.random() - 0.5) * 0.01
          const price = Math.max(1, cur.price * (1 + drift))
          const hist = [...cur.hist.slice(-39), price]
          next[s.code] = { price, prev: cur.price, pct: (price / s.fallback - 1) * 100, hist }
        }
        return next
      })
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return market
}
