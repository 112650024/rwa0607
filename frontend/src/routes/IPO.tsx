import { useState } from "react"
import { toast } from "sonner"
import { useAccount, useReadContract, useReadContracts } from "wagmi"
import { PageHeader } from "@/components/PageHeader"
import { useWallet } from "@/lib/wallet"
import { useTx } from "@/hooks/useTx"
import { IPO as IPO_C, IPO_OFFERINGS, TWD } from "@/lib/contracts"
import { stockByCode, type Stock } from "@/lib/catalog"
import { StockLogo } from "@/components/StockLogo"
import { fmtTWD, fmtNum } from "@/lib/format"
import { Rocket, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

// 把鏈上的 IPO 認購案在前端重新品牌化(demo 用)
const IPO_BRAND: Record<string, Stock> = {
  "0050": { code: "SPACEX", name: "SpaceX", symbol: "dSPACEX", fallback: 0, tint: "#0b3d91,#05070f", domain: "spacex.com" },
}

function countdown(end: number) {
  const s = end - Math.floor(Date.now() / 1000)
  if (s <= 0) return "已結束"
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  return `倒數 ${d} 天 ${h} 時`
}

function OfferingCard({ id }: { id: number }) {
  const { address } = useAccount()
  const { connected } = useWallet()
  const { run } = useTx()
  const [amt, setAmt] = useState("")
  const [busy, setBusy] = useState(false)

  const code = IPO_OFFERINGS.find((o) => o.id === id)?.code
  const stock = code ? IPO_BRAND[code] ?? stockByCode(code) : undefined

  const { data, refetch } = useReadContracts({
    contracts: [
      { ...IPO_C, functionName: "getOffering", args: [BigInt(id)] },
      { ...IPO_C, functionName: "userPosition", args: [BigInt(id), address as `0x${string}`] },
    ],
    query: { refetchInterval: 12000 },
  })
  const o = data?.[0]?.result as
    | [string, bigint, bigint, number, number, bigint, bigint, bigint, number]
    | undefined
  const pos = data?.[1]?.result as [bigint, bigint, bigint, boolean] | undefined
  if (!o) return null

  const price = Number(o[1]) / 1e6
  const totalShares = Number(o[2]) / 1e18
  const end = Number(o[4])
  const raised = Number(o[5]) / 1e6
  const maxRaise = Number(o[6]) / 1e6
  const allocBps = Number(o[7])
  const status = o[8] // 0 upcoming 1 active 2 ended 3 finalized
  const over = raised > maxRaise && maxRaise > 0
  const pct = maxRaise ? Math.min(100, (raised / maxRaise) * 100) : 0

  const paid = pos ? Number(pos[0]) / 1e6 : 0
  const estShares = pos ? Number(pos[1]) / 1e18 : 0
  const didClaim = pos ? pos[3] : false

  const statusLabel = ["即將開始", "認購中", "待定案", "已定案"][status]

  const subscribe = async () => {
    if (!connected) return toast.error("請先連接錢包")
    const nAmt = Math.floor(Number(amt))
    if (!nAmt) return toast.error("請輸入認購金額")
    setBusy(true)
    try {
      const raw = BigInt(nAmt) * 10n ** 6n
      await run({ address: TWD.address, abi: TWD.abi, functionName: "approve", args: [IPO_C.address, raw] }, { pending: "授權 TWD…", success: "已授權" })
      await run({ ...IPO_C, functionName: "subscribe", args: [BigInt(id), raw] }, { pending: "認購中…", success: `已認購 ${nAmt} TWD` })
      setAmt("")
      refetch()
    } catch {
      /* handled */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-3">
        {stock ? (
          <StockLogo stock={stock} size={48} />
        ) : (
          <span className="grid size-12 place-items-center rounded-xl bg-primary/15 font-display font-bold text-primary">IPO</span>
        )}
        <div className="flex-1">
          <div className="font-semibold">
            {stock?.name ?? "新股"} <span className="font-mono-num text-xs text-muted-foreground">{stock?.code ?? code}</span>
          </div>
          <div className="font-mono-num text-[11px] text-primary">{stock?.symbol}</div>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs ring-1",
            status === 1 ? "bg-primary/10 text-primary ring-primary/25" : status >= 2 ? "bg-accent/10 text-accent ring-accent/25" : "bg-white/5 text-muted-foreground ring-border",
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">認購價</span>
        <span className="font-mono-num font-semibold">{fmtTWD(price)} / 股</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? "var(--accent)" : "var(--primary)" }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>已募 {fmtNum(raised / 1e6, 2)}M / 釋出 {fmtNum(totalShares, 0)} 股</span>
        <span className={over ? "text-accent" : ""}>{over ? `超額 ${(raised / maxRaise).toFixed(2)}× · 配額 ${(allocBps / 100).toFixed(0)}%` : `${pct.toFixed(0)}%`}</span>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Clock className="size-3.5" /> {status === 1 ? countdown(end) : status >= 2 ? "認購結束" : "尚未開始"}
      </div>

      {paid > 0 && (
        <div className="mt-3 rounded-xl border border-border bg-card/50 p-3 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">我的認購</span><span className="font-mono-num">{fmtTWD(paid)}</span></div>
          <div className="mt-1 flex justify-between"><span className="text-muted-foreground">預估配發</span><span className="font-mono-num text-primary">{fmtNum(estShares, 2)} 股</span></div>
        </div>
      )}

      {status === 1 && (
        <div className="mt-3 flex gap-2">
          <input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="認購金額 TWD"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono-num text-sm outline-none focus:border-primary" />
          <button onClick={subscribe} disabled={busy}
            className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground glow-jade transition hover:brightness-105 disabled:opacity-60">認購</button>
        </div>
      )}
      {status >= 2 && paid > 0 && !didClaim && (
        <button
          onClick={async () => {
            if (!connected) return toast.error("請先連接錢包")
            await run({ ...IPO_C, functionName: "claim", args: [BigInt(id)] }, { pending: "領取配額…", success: "已領取配發代幣 + 退款" }).then(() => refetch()).catch(() => {})
          }}
          className="mt-3 w-full rounded-xl border border-border bg-card py-2 text-sm font-semibold transition hover:border-primary/40">
          領取配額 + 退款
        </button>
      )}
    </div>
  )
}

export default function IPO() {
  const { data: count } = useReadContract({ ...IPO_C, functionName: "offeringCount" })
  const n = count ? Number(count as bigint) : IPO_OFFERINGS.length
  const ids = Array.from({ length: n }, (_, i) => i)
  return (
    <div>
      <PageHeader
        icon={Rocket}
        title="IPO 新股認購"
        desc="參與代幣化新股認購:認購窗口內以固定價格出資,超額認購採 pro-rata 配額並退還溢繳款 —— 例如話題十足的 SpaceX 上市前認購,「抽籤/配額」鏈上重現。"
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ids.map((id) => (
          <OfferingCard key={id} id={id} />
        ))}
      </div>
    </div>
  )
}
