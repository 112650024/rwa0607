import { useEffect, useRef, useState } from "react"
import { useAccount, useReadContract, useReadContracts } from "wagmi"
import { TWD, ORACLE, sym32 } from "@/lib/contracts"
import { CATALOG } from "@/lib/catalog"
import { fmtNum } from "@/lib/format"
import { useTx } from "./useTx"
import { useTwse } from "./useTwse"
import type { Market } from "./useMarket"

/** TWD 餘額(顆) */
export function useTwdBalance() {
  const { address } = useAccount()
  const q = useReadContract({
    address: TWD.address,
    abi: TWD.abi,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
    query: { enabled: !!address, refetchInterval: 8000 },
  })
  return { twd: q.data ? Number(q.data as bigint) / 1e6 : 0, refetch: q.refetch }
}

/** 領取測試 TWD(鏈上 mintTWD) */
export function useFaucet() {
  const { run, isPending } = useTx()
  const claim = (whole: number) =>
    run(
      { address: TWD.address, abi: TWD.abi, functionName: "mintTWD", args: [BigInt(whole)] },
      { pending: "領取 TWD…", success: `已領取 ${fmtNum(whole)} TWD` },
    )
  return { claim, isPending }
}

/** 由「昨收→今收 + 開高低」生方向正確的走勢線(決定性)。 */
function series(prev: number, close: number, high: number, low: number, n = 28): number[] {
  const lo = Math.min(low || prev, prev, close)
  const hi = Math.max(high || prev, prev, close)
  const amp = hi - lo || Math.max(close * 0.01, 1)
  const pts: number[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    let v = prev + (close - prev) * t + Math.sin(i * 1.3 + (prev % 7)) * amp * 0.18
    v = Math.min(hi, Math.max(lo, v))
    pts.push(v)
  }
  pts[0] = prev
  pts[n - 1] = close
  return pts
}

type Anchor = { anchor: number; prevClose: number; high: number; low: number }

/**
 * 台股行情:
 *  - 價格錨定鏈上預言機價(≈ TWSE 收盤),漲跌%與走勢用真實 TWSE。
 *  - 盤中模擬跳動:只在「今天真實最高~最低」區間內輕微浮動、向收盤回歸(看起來活、不亂掰)。
 */
export function usePrices(): Market {
  const twse = useTwse()
  const { data } = useReadContracts({
    contracts: CATALOG.map((s) => ({
      address: ORACLE.address,
      abi: ORACLE.abi,
      functionName: "latestPrice",
      args: [sym32(s.code)],
    })),
    query: { refetchInterval: 30000 },
  })

  const [market, setMarket] = useState<Market>(() => {
    const m: Market = {}
    for (const s of CATALOG) m[s.code] = { price: s.fallback, prev: s.fallback, pct: 0, hist: Array(28).fill(s.fallback) }
    return m
  })

  const anchors = useRef<Record<string, Anchor>>({})
  const seeded = useRef<Set<string>>(new Set())

  // 更新錨點 + 首次以真實資料 seed
  useEffect(() => {
    CATALOG.forEach((s, i) => {
      let oracle = 0
      const r = data?.[i]
      if (r?.status === "success" && Array.isArray(r.result)) {
        const [p, dec] = r.result as unknown as [bigint, number, bigint]
        oracle = Number(p) / 10 ** Number(dec)
      }
      const t = twse[s.code]
      if (t && t.close > 0) {
        const prevClose = t.close - t.change
        anchors.current[s.code] = { anchor: oracle || t.close, prevClose, high: t.high || t.close, low: t.low || t.close }
      }
    })
    setMarket((prev) => {
      let changed = false
      const next = { ...prev }
      CATALOG.forEach((s) => {
        const a = anchors.current[s.code]
        if (a && !seeded.current.has(s.code)) {
          seeded.current.add(s.code)
          const pct = a.prevClose ? ((a.anchor - a.prevClose) / a.prevClose) * 100 : 0
          next[s.code] = { price: a.anchor, prev: a.prevClose, pct, hist: series(a.prevClose, a.anchor, a.high, a.low) }
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [data, twse])

  // 盤中模擬跳動(每 2.5 秒,在真實高低區間內)
  useEffect(() => {
    const id = setInterval(() => {
      setMarket((prev) => {
        const next: Market = {}
        let any = false
        CATALOG.forEach((s) => {
          const cur = prev[s.code]
          const a = anchors.current[s.code]
          if (!a || !seeded.current.has(s.code)) { next[s.code] = cur; return }
          any = true
          const band = Math.max(a.high - a.low, a.anchor * 0.004)
          let p = cur.price + (Math.random() - 0.5) * band * 0.08 + (a.anchor - cur.price) * 0.06
          p = Math.min(a.high, Math.max(a.low, p))
          const pct = a.prevClose ? ((p - a.prevClose) / a.prevClose) * 100 : 0
          next[s.code] = { price: p, prev: cur.price, pct, hist: [...cur.hist.slice(1), p] }
        })
        return any ? next : prev
      })
    }, 2500)
    return () => clearInterval(id)
  }, [])

  return market
}
