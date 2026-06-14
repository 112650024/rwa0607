import { useEffect, useState } from "react"
import { useAccount, useReadContract, useReadContracts } from "wagmi"
import { TWD, ORACLE, LENDING, IPO, STOCKS, stockContract, sym32 } from "@/lib/contracts"
import { CATALOG } from "@/lib/catalog"
import { fmtNum } from "@/lib/format"
import { useTx } from "./useTx"
import { useTwse, useTwseHistory } from "./useTwse"
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
 * 台股行情:
 * - 價格與漲跌% 以「鏈上預言機價」為當前值(feeder 餵 TWSE 即時成交價),/api/twse 提供昨收基準。
 * - 走勢線用 /api/history 的「真實近 N 日每日收盤」+ 尾端接上鏈上即時價(每檔各自真實、不再是合成波)。
 *   取不到歷史時才退回合成走勢(series),不致崩。
 */
export function usePrices(): Market {
  const twse = useTwse()
  const history = useTwseHistory()
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
        // 鏈上預言機價(顯示與推算的「當前值」,精準)
        let oraclePrice = 0
        const r = data?.[i]
        if (r?.status === "success" && Array.isArray(r.result)) {
          const [p, dec] = r.result as unknown as [bigint, number, bigint]
          oraclePrice = Number(p) / 10 ** Number(dec)
        }
        // /api/twse 提供基準帶(昨收/開/高/低);MIS 被擋時自動走每日收盤後備(IP 安全)
        const t = twse[s.code]
        const hasBase = !!t && t.close > 0
        // /api/history 提供真實近 N 日每日收盤
        const realCloses = history[s.code]
        const haveHist = !!realCloses && realCloses.length >= 2
        if (!oraclePrice && !hasBase && !haveHist) {
          next[s.code] = cur // 三個來源都還沒到 → 維持現值,不亂跳
          return
        }
        const histLast = haveHist ? realCloses[realCloses.length - 1] : 0
        const live = oraclePrice || (hasBase ? t!.close : histLast) || cur.price // 當前值:優先鏈上價
        const prevClose = hasBase ? t!.close - t!.change : haveHist ? histLast : cur.prev // 昨收基準
        const pct = prevClose ? ((live - prevClose) / prevClose) * 100 : cur.pct
        const open = (hasBase && t!.open > 0 ? t!.open : 0) || prevClose || live
        const hi = Math.max(hasBase ? t!.high : 0, live, open, prevClose)
        const lo = Math.min(...[hasBase ? t!.low : Infinity, live, open, prevClose].filter((x) => x > 0))
        next[s.code] = {
          price: live,
          prev: prevClose,
          pct,
          // 真實近 N 日收盤 + 尾端接鏈上即時價;無歷史才退回合成走勢
          hist: haveHist ? [...realCloses, live] : series(open, live, hi, lo),
        }
      })
      return next
    })
  }, [data, twse, history])

  return market
}

export type ProtocolStats = {
  totalAssets: number // 鏈上資產總額(TWD):代幣化台股市值 + 流通 TWD
  reserveRatio: number // TWD 儲備率(%)
  tvl: number // 借貸池 TVL(TWD)
  ipoCount: number // IPO 認購案累計檔數
  ready: boolean // 鏈上資料是否已就緒
}

/**
 * Dashboard 指標卡的真實鏈上彙總(取代原本寫死的示意數字)。
 * 一次 multicall 讀:TWD 流通量/儲備率、借貸池 TVL、IPO 案數、各台股流通股數;
 * 台股市值 = Σ 流通股數 × 預言機價(沿用 usePrices 的 market)。
 */
export function useProtocolStats(market: Market): ProtocolStats {
  const { data } = useReadContracts({
    contracts: [
      { ...TWD, functionName: "totalSupply" },
      { ...TWD, functionName: "reserveRatioBps" },
      { ...LENDING, functionName: "getPoolStats" },
      { ...IPO, functionName: "offeringCount" },
      ...STOCKS.map((s) => ({ ...stockContract(s.code)!, functionName: "totalSupply" })),
    ],
    query: { refetchInterval: 15000 },
  })

  const ok = (i: number) => data?.[i]?.status === "success"
  const big = (i: number) => (ok(i) ? (data![i].result as bigint) : 0n)

  const twdSupply = Number(big(0)) / 1e6
  const reserveRatio = Number(big(1)) / 100
  const pool = ok(2) ? (data![2].result as readonly bigint[]) : undefined
  const tvl = pool ? Number(pool[2]) / 1e6 : 0 // index 2 = totalLiquidity(cash + borrows)
  const ipoCount = Number(big(3))

  let stockValue = 0
  STOCKS.forEach((s, idx) => {
    if (!ok(4 + idx)) return
    const supply = Number(data![4 + idx].result as bigint) / 1e18
    stockValue += supply * (market[s.code]?.price || 0)
  })

  return {
    totalAssets: twdSupply + stockValue,
    reserveRatio,
    tvl,
    ipoCount,
    ready: ok(0),
  }
}
