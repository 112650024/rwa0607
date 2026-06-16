import { useState } from "react"
import { Link } from "react-router-dom"
import { PieChart, Wallet, ExternalLink, ArrowUpRight, ArrowDownRight, Landmark, PiggyBank, HandCoins, Layers } from "lucide-react"
import { usePrices, useHoldings, type Holding } from "@/hooks/useChain"
import { useActivity, type Activity } from "@/hooks/useActivity"
import { useWallet } from "@/lib/wallet"
import { PageHeader } from "@/components/PageHeader"
import { StockLogo } from "@/components/StockLogo"
import { stockByCode } from "@/lib/catalog"
import { fmtTWD, fmtNum } from "@/lib/format"
import { txUrl, addrUrl } from "@/lib/contracts"
import { pnlFor } from "@/lib/costBasis"
import { cn } from "@/lib/utils"

const tintOf = (code: string) => stockByCode(code)?.tint.split(",")[0] ?? "var(--primary)"

type Seg = { label: string; value: number; color: string }

function Donut({ segments, size = 196 }: { segments: Seg[]; size?: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  const r = size / 2 - 16
  const C = 2 * Math.PI * r
  let acc = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={22} />
        {segments.map((s, i) => {
          const len = (s.value / total) * C
          const node = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={22}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-acc}
              strokeLinecap="butt"
            />
          )
          acc += len
          return node
        })}
      </g>
    </svg>
  )
}

function PositionsTab({ holdings, twd, deposit, collateral, debt, netWorth, address }: ReturnType<typeof useHoldings> & { address?: string | null }) {
  const segments: Seg[] = []
  if (twd > 0) segments.push({ label: "TWD 現金", value: twd, color: "var(--accent)" })
  for (const h of holdings) segments.push({ label: stockByCode(h.code)?.name ?? h.code, value: h.value, color: tintOf(h.code) })
  if (deposit > 0) segments.push({ label: "出借中", value: deposit, color: "#38bdf8" })
  if (collateral > 0) segments.push({ label: "質押抵押", value: collateral, color: "#2dd4bf" })

  const empty = segments.length === 0

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* 配置圖 */}
      <div className="glass flex flex-col items-center rounded-2xl p-5">
        <div className="relative grid place-items-center">
          <Donut segments={empty ? [{ label: "—", value: 1, color: "rgba(255,255,255,0.08)" }] : segments} />
          <div className="absolute text-center">
            <div className="text-[11px] text-muted-foreground">總資產</div>
            <div className="font-mono-num text-lg font-bold">{fmtTWD(netWorth)}</div>
          </div>
        </div>
        <div className="mt-4 w-full space-y-1.5">
          {empty ? (
            <div className="text-center text-xs text-muted-foreground">尚無部位 — 去交易頁買一些台股代幣吧</div>
          ) : (
            segments.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-mono-num">{((s.value / netWorth) * 100 || 0).toFixed(1)}%</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 明細 */}
      <div className="glass rounded-2xl p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini icon={Wallet} label="TWD 現金" value={fmtTWD(twd)} />
          <Mini icon={Layers} label="台股持倉" value={fmtTWD(holdings.reduce((a, h) => a + h.value, 0))} />
          <Mini icon={PiggyBank} label="出借中" value={fmtTWD(deposit)} />
          <Mini icon={HandCoins} label="借款" value={fmtTWD(debt)} accent />
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">台股部位</div>
          {holdings.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              還沒有台股代幣。<Link to="/trade" className="text-primary hover:underline">去交易 →</Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {holdings.map((h) => (
                <PositionRow key={h.code} h={h} address={address} />
              ))}
            </div>
          )}
        </div>
        {collateral > 0 && (
          <p className="mt-3 text-[11px] text-muted-foreground">另有質押在借貸池的抵押品價值 {fmtTWD(collateral)}(已計入總資產)。</p>
        )}
      </div>
    </div>
  )
}

function Mini({ icon: Icon, label, value, accent }: { icon: typeof Wallet; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className={cn("size-3.5", accent ? "text-accent" : "text-primary")} /> {label}
      </div>
      <div className="mt-1 font-mono-num text-base font-bold">{value}</div>
    </div>
  )
}

function PositionRow({ h, address }: { h: Holding; address?: string | null }) {
  const s = stockByCode(h.code)!
  const price = h.value / (h.shares || 1)
  const pnl = pnlFor(address, h.code, h.shares, h.value)
  return (
    <div className="flex items-center gap-3 py-2.5">
      <StockLogo stock={s} size={32} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">
          {s.name} <span className="font-mono-num text-[11px] text-muted-foreground">{s.symbol}</span>
        </div>
        <div className="font-mono-num text-[11px] text-muted-foreground">{fmtNum(h.shares, 2)} 股 · {fmtTWD(price)}/股</div>
      </div>
      <div className="text-right">
        <div className="font-mono-num text-sm font-bold">{fmtTWD(h.value)}</div>
        {pnl && (
          <div className={cn("font-mono-num text-[11px]", pnl.pnl >= 0 ? "text-up" : "text-down")}>
            {pnl.pnl >= 0 ? "+" : ""}
            {fmtNum(pnl.pnl)} ({pnl.pnl >= 0 ? "+" : ""}
            {pnl.pct.toFixed(1)}%)
          </div>
        )}
      </div>
    </div>
  )
}

const ACT_ICON: Record<Activity["kind"], { icon: typeof ArrowUpRight; color: string }> = {
  buy: { icon: ArrowUpRight, color: "text-up" },
  sell: { icon: ArrowDownRight, color: "text-down" },
  borrow: { icon: HandCoins, color: "text-accent" },
  repay: { icon: HandCoins, color: "text-primary" },
  deposit: { icon: PiggyBank, color: "text-primary" },
  withdraw: { icon: PiggyBank, color: "text-muted-foreground" },
  collateral: { icon: Landmark, color: "text-primary" },
}

function ActivityTab() {
  const { items, loading, error } = useActivity()
  const { address } = useWallet()
  if (loading) return <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">讀取鏈上活動中…</div>
  if (error)
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
        無法在前端查詢事件(RPC 範圍限制)。
        <a href={addrUrl(address ?? "")} target="_blank" rel="noreferrer" className="ml-1 text-primary hover:underline">
          改用 Etherscan 查看你的完整鏈上活動 →
        </a>
      </div>
    )
  if (items.length === 0)
    return <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">近期沒有鏈上活動。去交易 / 借貸看看吧。</div>
  return (
    <div className="glass rounded-2xl p-3">
      <div className="divide-y divide-border">
        {items.map((a, i) => {
          const { icon: Icon, color } = ACT_ICON[a.kind]
          return (
            <div key={a.hash + i} className="flex items-center gap-3 px-2 py-2.5">
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.04]", color)}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 text-sm">{a.text}</div>
              <a
                href={txUrl(a.hash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono-num text-[11px] text-primary hover:underline"
              >
                {a.hash.slice(0, 6)}…{a.hash.slice(-4)} <ExternalLink className="size-3" />
              </a>
            </div>
          )
        })}
      </div>
      <p className="px-2 pt-2 text-[11px] text-muted-foreground">資料直接讀自 Sepolia 鏈上事件,每筆可點開 Etherscan 驗證。</p>
    </div>
  )
}

export default function Portfolio() {
  const { connected, address } = useWallet()
  const market = usePrices()
  const pf = useHoldings(market)
  const [tab, setTab] = useState<"positions" | "activity">("positions")

  const hf = pf.hfBps > 10n ** 12n ? Infinity : Number(pf.hfBps) / 10000
  const pnls = pf.holdings.map((h) => pnlFor(address, h.code, h.shares, h.value))
  const hasPnl = pnls.some((p) => p !== null)
  const totalPnl = pnls.reduce((a, p) => a + (p?.pnl ?? 0), 0)
  const totalBasis = pnls.reduce((a, p) => a + (p?.basis ?? 0), 0)
  const totalPnlPct = totalBasis > 0 ? (totalPnl / totalBasis) * 100 : 0

  if (!connected) {
    return (
      <div>
        <PageHeader icon={Wallet} title="我的投資組合" desc="連接錢包後,這裡彙總你在鏈上的所有部位:台股持倉、TWD、借貸與抵押,以及完整的鏈上活動紀錄。" />
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">請先連接錢包以檢視你的投資組合。</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader icon={Wallet} title="我的投資組合" desc="彙總你在鏈上的所有部位與活動 —— 全部即時讀自 Sepolia 合約,可逐筆於 Etherscan 驗證。" />

      {/* 總資產 + 健康因子 */}
      <div className="glass mb-4 flex flex-wrap items-end justify-between gap-4 rounded-2xl p-5">
        <div>
          <div className="text-xs text-muted-foreground">總資產淨值(持倉 + 現金 + 出借 + 抵押 − 借款)</div>
          <div className="mt-1 font-mono-num text-3xl font-bold">{pf.ready ? fmtTWD(pf.netWorth) : "—"}</div>
        </div>
        {hasPnl && (
          <div>
            <div className="text-xs text-muted-foreground">未實現損益(本機成本估算)</div>
            <div className={cn("mt-1 font-mono-num text-2xl font-bold", totalPnl >= 0 ? "text-up" : "text-down")}>
              {totalPnl >= 0 ? "+" : ""}
              {fmtTWD(totalPnl)} <span className="text-base">({totalPnl >= 0 ? "+" : ""}{totalPnlPct.toFixed(1)}%)</span>
            </div>
          </div>
        )}
        {pf.debt > 0 && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground">借貸健康因子</div>
            <div
              className="mt-1 font-mono-num text-2xl font-bold"
              style={{ color: hf >= 1.5 ? "var(--primary)" : hf >= 1.15 ? "var(--accent)" : "var(--down)" }}
            >
              {hf === Infinity ? "∞" : hf.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* 分頁 */}
      <div className="mb-4 inline-flex gap-1 rounded-xl bg-background p-1 text-sm">
        {([["positions", "持倉", PieChart], ["activity", "鏈上活動", Layers]] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 font-semibold transition",
              tab === k ? "bg-primary/15 text-primary ring-1 ring-primary/25" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "positions" ? <PositionsTab {...pf} address={address} /> : <ActivityTab />}
    </div>
  )
}
