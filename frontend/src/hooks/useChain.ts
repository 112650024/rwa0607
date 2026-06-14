import { useEffect, useState } from "react"
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

/**
 * 台股行情:價格 = 鏈上預言機價(≈ TWSE 真實收盤,精準對得上),
 * 漲跌% 與走勢線用真實 TWSE 開高低收。台股免費資料為「日收盤」,故盤中不跳動(精準優先)。
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

  useEffect(() => {
    setMarket((prevM) => {
      const next: Market = {}
      CATALOG.forEach((s, i) => {
        const cur = prevM[s.code]
        // 鏈上預言機價(顯示用,精準)
        let price = cur.price
        const r = data?.[i]
        if (r?.status === "success" && Array.isArray(r.result)) {
          const [p, dec] = r.result as unknown as [bigint, number, bigint]
          price = Number(p) / 10 ** Number(dec)
        }
        // 真實漲跌與走勢線(TWSE)
        const t = twse[s.code]
        if (t && t.close > 0) {
          const prevClose = t.close - t.change
          const pct = prevClose ? (t.change / prevClose) * 100 : 0
          next[s.code] = {
            price: price || t.close,
            prev: prevClose,
            pct,
            // 從「當日開盤 → 收盤」畫整天走勢線(決定性、不亂跳)
            hist: series(t.open || prevClose || t.close, t.close, t.high, t.low),
          }
        } else {
          next[s.code] = { price, prev: cur.prev, pct: cur.pct, hist: cur.hist }
        }
      })
      return next
    })
  }, [data, twse])

  return market
}
