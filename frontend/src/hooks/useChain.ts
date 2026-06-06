import { useEffect, useState } from "react"
import { useAccount, useReadContract, useReadContracts } from "wagmi"
import { TWD, ORACLE, sym32 } from "@/lib/contracts"
import { CATALOG } from "@/lib/catalog"
import { fmtNum } from "@/lib/format"
import { useTx } from "./useTx"
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

function seed(p0: number) {
  const a: number[] = []
  let p = p0
  for (let i = 0; i < 40; i++) {
    p = Math.max(1, p * (1 + (Math.random() - 0.5) * 0.01))
    a.push(p)
  }
  return a
}

/** 從預言機讀全部台股即時價(每 30 秒);回傳與 useMarket 相同結構。 */
export function usePrices(): Market {
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
    for (const s of CATALOG) m[s.code] = { price: s.fallback, prev: s.fallback, pct: 0, hist: seed(s.fallback) }
    return m
  })

  useEffect(() => {
    if (!data) return
    setMarket((prev) => {
      const next: Market = {}
      CATALOG.forEach((s, i) => {
        const r = data[i]
        const cur = prev[s.code]
        let price = cur.price
        if (r?.status === "success" && Array.isArray(r.result)) {
          const [p, dec] = r.result as unknown as [bigint, number, bigint]
          price = Number(p) / 10 ** Number(dec)
        }
        next[s.code] = {
          price,
          prev: cur.price,
          pct: (price / s.fallback - 1) * 100,
          hist: [...cur.hist.slice(-39), price],
        }
      })
      return next
    })
  }, [data])

  return market
}
