import { useEffect, useState } from "react"
import { toast } from "sonner"
import { parseUnits, formatUnits } from "viem"
import { useAccount } from "wagmi"
import { readContract } from "wagmi/actions"
import { wagmiConfig } from "@/lib/wagmi"
import { UNISWAP } from "@/lib/contracts"
import { QUOTER_ABI, ROUTER_ABI, ERC20_APPROVE_ABI, usePoolPrice } from "@/hooks/useUniswap"
import { usePrices } from "@/hooks/useChain"
import { useWallet } from "@/lib/wallet"
import { useTx } from "@/hooks/useTx"
import { PageHeader } from "@/components/PageHeader"
import { StockLogo } from "@/components/StockLogo"
import { stockByCode } from "@/lib/catalog"
import { fmtNum, fmtTWD } from "@/lib/format"
import { Repeat, ArrowDown, ExternalLink, Info } from "lucide-react"
import { cn } from "@/lib/utils"

export default function Swap() {
  const u = UNISWAP
  const { address } = useAccount()
  const { connected } = useWallet()
  const { run } = useTx()
  const market = usePrices()
  const poolPrice = usePoolPrice()

  const [side, setSide] = useState<"buy" | "sell">("buy") // buy = TWD→dTSMC
  const [amt, setAmt] = useState("")
  const [out, setOut] = useState<bigint | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [busy, setBusy] = useState(false)

  const stock = stockByCode(u?.stockCode ?? "2330")!
  const oraclePrice = market[stock.code]?.price ?? 0
  const dev = poolPrice && oraclePrice ? ((poolPrice - oraclePrice) / oraclePrice) * 100 : null

  const tokenIn = u ? (side === "buy" ? u.twd : u.stockToken) : undefined
  const tokenOut = u ? (side === "buy" ? u.stockToken : u.twd) : undefined
  const decIn = side === "buy" ? 6 : 18
  const decOut = side === "buy" ? 18 : 6

  // 報價(QuoterV2,eth_call)
  useEffect(() => {
    if (!u || !amt || Number(amt) <= 0) { setOut(null); return }
    let alive = true
    setQuoting(true)
    const t = setTimeout(async () => {
      try {
        const amountIn = parseUnits(amt, decIn)
        const res = await readContract(wagmiConfig, {
          address: u.quoter,
          abi: QUOTER_ABI,
          functionName: "quoteExactInputSingle",
          args: [{ tokenIn: tokenIn!, tokenOut: tokenOut!, amountIn, fee: u.fee, sqrtPriceLimitX96: 0n }],
        })
        if (alive) setOut((res as unknown[])[0] as bigint)
      } catch {
        if (alive) setOut(null)
      } finally {
        if (alive) setQuoting(false)
      }
    }, 350)
    return () => { alive = false; clearTimeout(t) }
  }, [amt, side, u, decIn, tokenIn, tokenOut])

  if (!u) {
    return (
      <div>
        <PageHeader icon={Repeat} title="AMM 二級市場 (Uniswap)" desc="流動池建立中,請稍候再回來。" />
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">尚未偵測到 Uniswap 流動池(deployed.json 無 uniswap 設定)。</div>
      </div>
    )
  }

  const outNum = out ? Number(formatUnits(out, decOut)) : 0
  const uniLink = `https://app.uniswap.org/swap?chain=sepolia&inputCurrency=${tokenIn}&outputCurrency=${tokenOut}`

  const swap = async () => {
    if (!connected || !address) return toast.error("請先連接錢包")
    if (!amt || Number(amt) <= 0) return toast.error("請輸入數量")
    if (!out) return toast.error("尚無報價")
    setBusy(true)
    try {
      const amountIn = parseUnits(amt, decIn)
      const minOut = (out * 90n) / 100n // 5~10% 滑點保護(池薄)
      await run({ address: tokenIn!, abi: ERC20_APPROVE_ABI, functionName: "approve", args: [u.router, amountIn] }, { pending: "步驟 1/2:授權…", success: "已授權" })
      await run({
        address: u.router, abi: ROUTER_ABI, functionName: "exactInputSingle",
        args: [{ tokenIn: tokenIn!, tokenOut: tokenOut!, fee: u.fee, recipient: address, amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }],
      }, { pending: "步驟 2/2:Uniswap 交換…", success: "AMM 交換完成" })
      setAmt(""); setOut(null)
    } catch {
      /* handled */
    } finally {
      setBusy(false)
    }
  }

  const payLabel = side === "buy" ? "支付 TWD" : `賣出 ${stock.symbol}`
  const getLabel = side === "buy" ? `獲得 ${stock.symbol}` : "獲得 TWD"
  const outUnit = side === "buy" ? "股" : "TWD"

  return (
    <div>
      <PageHeader
        icon={Repeat}
        title="AMM 二級市場 (Uniswap)"
        desc="與一級市場(預言機 mint/redeem)互補的真實二級市場:同一個 Uniswap v3 池,站內可換、也可到 Uniswap 官方介面換,提供 24/7 價格發現。"
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* 交換卡 */}
        <div className="glass rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold">Uniswap v3 · 0.3% 池</span>
            <button onClick={() => setSide(side === "buy" ? "sell" : "buy")} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs transition hover:border-primary/40">
              <Repeat className="size-3.5" /> 反向
            </button>
          </div>

          <div className="rounded-xl border border-input bg-background p-3">
            <div className="text-xs text-muted-foreground">{payLabel}</div>
            <div className="mt-1 flex items-center gap-2">
              <input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.0"
                className="w-full bg-transparent font-mono-num text-2xl outline-none" />
              {side === "buy"
                ? <span className="shrink-0 rounded-lg bg-card px-2.5 py-1 font-mono-num text-sm">TWD</span>
                : <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-card px-2 py-1"><StockLogo stock={stock} size={20} /><span className="font-mono-num text-sm">{stock.symbol}</span></span>}
            </div>
          </div>

          <div className="my-1 flex justify-center"><ArrowDown className="size-4 text-muted-foreground" /></div>

          <div className="rounded-xl border border-input bg-background p-3">
            <div className="text-xs text-muted-foreground">{getLabel}{quoting && " · 報價中…"}</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="w-full font-mono-num text-2xl">{out ? fmtNum(outNum, side === "buy" ? 4 : 2) : "0.0"}</div>
              {side === "buy"
                ? <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-card px-2 py-1"><StockLogo stock={stock} size={20} /><span className="font-mono-num text-sm">{stock.symbol}</span></span>
                : <span className="shrink-0 rounded-lg bg-card px-2.5 py-1 font-mono-num text-sm">TWD</span>}
            </div>
          </div>

          <button onClick={swap} disabled={busy || !out}
            className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground glow-jade transition hover:brightness-105 disabled:opacity-60">
            {busy ? "處理中…" : `交換(預估 ${out ? fmtNum(outNum, 2) : "—"} ${outUnit})`}
          </button>

          <a href={uniLink} target="_blank" rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground transition hover:text-primary">
            或在 Uniswap 官方介面交換(Sepolia) <ExternalLink className="size-3.5" />
          </a>
        </div>

        {/* 價格 / 套利 */}
        <div className="glass rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-semibold"><Info className="size-4 text-primary" /> 一級 vs 二級市場</h3>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">預言機公允價(一級)</span>
              <span className="font-mono-num font-bold">{fmtTWD(oraclePrice)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Uniswap 池價(二級)</span>
              <span className="font-mono-num font-bold text-primary">{poolPrice ? fmtTWD(poolPrice) : "讀取中…"}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">偏離度</span>
              <span className={cn("font-mono-num font-bold", dev === null ? "" : Math.abs(dev) < 1 ? "text-primary" : "text-accent")}>
                {dev === null ? "—" : `${dev >= 0 ? "+" : ""}${dev.toFixed(2)}%`}
              </span>
            </div>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            一級市場以預言機價 mint/redeem 錨定公允價;二級市場 Uniswap AMM 做 24/7 價格發現。兩者偏離時,套利者買低賣高使其<span className="text-foreground"> 收斂 </span>—— 這正是代幣化資產「流動性提升」的核心機制。
          </p>
          <div className="mt-3 rounded-xl border border-border bg-card/50 p-3 text-[11px] text-muted-foreground">
            ⚠ 測試池流動性較薄,大額交換會明顯移動池價(即時價格發現);demo 建議用小額。
          </div>
        </div>
      </div>
    </div>
  )
}
