import { useState } from "react"
import { toast } from "sonner"
import { readContract } from "wagmi/actions"
import { useReadContract } from "wagmi"
import { CATALOG, stockByCode } from "@/lib/catalog"
import { usePrices } from "@/hooks/useChain"
import { useWallet } from "@/lib/wallet"
import { useTx } from "@/hooks/useTx"
import { StockLogo } from "@/components/StockLogo"
import { PageHeader } from "@/components/PageHeader"
import { TWD, stockContract } from "@/lib/contracts"
import { recordBuy, recordSell } from "@/lib/costBasis"
import { wagmiConfig } from "@/lib/wagmi"
import { fmtNum, fmtTWD } from "@/lib/format"
import { ArrowLeftRight, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

export default function Trade() {
  const market = usePrices()
  const { connected, address } = useWallet()
  const { run } = useTx()
  const [code, setCode] = useState(CATALOG[0].code)
  const [shares, setShares] = useState(10)
  const [side, setSide] = useState<"buy" | "sell">("buy")
  const [busy, setBusy] = useState(false)
  const stock = stockByCode(code)!
  const price = market[code].price
  const total = shares * price
  const sc = stockContract(code)

  // 真實儲備證明
  const { data: reserve } = useReadContract({
    address: sc?.address,
    abi: sc?.abi,
    functionName: "getReserveStatus",
    query: { enabled: !!sc, refetchInterval: 12000 },
  })
  const { data: ratio } = useReadContract({
    address: sc?.address,
    abi: sc?.abi,
    functionName: "getCollateralRatio",
    query: { enabled: !!sc, refetchInterval: 12000 },
  })
  const rv = reserve as [bigint, bigint, bigint] | undefined
  const ratioPct = ratio !== undefined ? Number(ratio as bigint) : null

  const act = async () => {
    if (!connected) return toast.error("請先連接錢包")
    if (shares <= 0) return toast.error("請輸入股數")
    if (!sc) return
    setBusy(true)
    try {
      if (side === "buy") {
        const pps = (await readContract(wagmiConfig, {
          address: sc.address,
          abi: sc.abi,
          functionName: "pricePerShare",
        })) as bigint
        const twdRaw = pps * BigInt(shares)
        await run({ address: TWD.address, abi: TWD.abi, functionName: "approve", args: [sc.address, twdRaw] }, { pending: "步驟 1/2:授權 TWD…", success: "已授權" })
        await run({ address: sc.address, abi: sc.abi, functionName: "mint", args: [twdRaw] }, { pending: "步驟 2/2:買入鑄造…", success: `已買入 ${shares} 股 ${stock.symbol}` })
        recordBuy(address, code, shares, Number(twdRaw) / 1e6) // 記成本(供投資組合算損益)
      } else {
        await run({ address: sc.address, abi: sc.abi, functionName: "redeem", args: [BigInt(shares) * 10n ** 18n] }, { pending: "贖回中…", success: `已贖回 ${shares} 股 ${stock.symbol}` })
        recordSell(address, code, shares)
      }
    } catch {
      /* toast 已處理 */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        icon={ArrowLeftRight}
        title="交易台股代幣"
        desc="以 TWD 穩定幣依預言機即時價兌換台股代幣,鏈上 1:1 實股擔保、免手續費。"
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="glass rounded-2xl p-5">
          <div className="mb-4 flex gap-2">
            {(["buy", "sell"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={cn(
                  "flex-1 rounded-xl py-2 text-sm font-semibold transition",
                  side === s
                    ? s === "buy"
                      ? "bg-up/15 text-up ring-1 ring-up/30"
                      : "bg-down/15 text-down ring-1 ring-down/30"
                    : "text-muted-foreground hover:bg-white/5",
                )}
              >
                {s === "buy" ? "買入(鑄造)" : "賣出(贖回)"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <StockLogo stock={stock} size={46} />
            <div className="grid flex-1 grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">標的</label>
                <select
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm outline-none focus:border-primary"
                >
                  {CATALOG.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} {s.code}({s.symbol})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">股數</label>
                <input
                  type="number"
                  value={shares}
                  min={0}
                  onChange={(e) => setShares(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono-num text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>單價(預言機)</span>
              <span className="font-mono-num text-foreground">{fmtTWD(price)}</span>
            </div>
            <div className="flex justify-between">
              <span>手續費</span>
              <span className="font-mono-num text-primary">鏈上免手續費</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-bold">
              <span className="text-foreground">{side === "buy" ? "需付" : "可得"}</span>
              <span className="font-mono-num text-accent">{fmtTWD(total)}</span>
            </div>
          </div>

          <button
            onClick={act}
            disabled={busy}
            className={cn(
              "mt-4 w-full rounded-xl py-3 text-sm font-semibold transition disabled:opacity-60",
              side === "buy"
                ? "bg-primary text-primary-foreground glow-jade hover:brightness-105"
                : "border border-border bg-card hover:border-primary/40",
            )}
          >
            {busy ? "處理中…" : side === "buy" ? `買入 ${stock.symbol}` : `賣出 ${stock.symbol}`}
          </button>
        </div>

        {/* 儲備證明(真實鏈上) */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="size-4 text-primary" /> 儲備證明
            </h3>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs ring-1",
                ratioPct === null || ratioPct >= 100
                  ? "bg-primary/10 text-primary ring-primary/20"
                  : "bg-accent/10 text-accent ring-accent/20",
              )}
            >
              {ratioPct === null ? "讀取中…" : ratioPct >= 100 ? `✅ 足額 ${ratioPct}%` : `⚠ ${ratioPct}%`}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-muted-foreground">代幣發行</div>
              <div className="mt-1 font-mono-num font-bold">
                {rv ? fmtNum(Number(rv[1]) / 1e18, 2) : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">TWD 儲備</div>
              <div className="mt-1 font-mono-num font-bold">
                {rv ? fmtNum(Number(rv[0]) / 1e6) : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">抵押率</div>
              <div className="mt-1 font-mono-num font-bold text-primary">
                {ratioPct === null ? "—" : `${ratioPct}%`}
              </div>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            數據直接讀自 Sepolia 鏈上 {stock.symbol} 合約,證明代幣由 TWD 儲備足額擔保。
          </p>
        </div>
      </div>
    </div>
  )
}
