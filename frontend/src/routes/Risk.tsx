import { motion } from "framer-motion"
import { Gauge, TrendingUp, TrendingDown } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { StockLogo } from "@/components/StockLogo"
import { CATALOG } from "@/lib/catalog"
import { useTwseHistory } from "@/hooks/useTwse"
import { computeRisk, type RiskMetrics } from "@/lib/risk"

const riskColor = (s: number) => (s < 34 ? "var(--up)" : s < 67 ? "var(--accent)" : "var(--down)")

function RiskCard({ stock, m, i }: { stock: (typeof CATALOG)[number]; m: RiskMetrics; i: number }) {
  const up = m.momentumPct >= 0
  return (
    <motion.div
      custom={i}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04, duration: 0.4 }}
      className="glass rounded-2xl p-4"
    >
      <div className="flex items-center gap-3">
        <StockLogo stock={stock} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {stock.name} <span className="font-mono-num text-[11px] text-muted-foreground">{stock.code}</span>
          </div>
          <div className="font-mono-num text-[11px] text-muted-foreground">{stock.symbol}</div>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold ring-1"
          style={{ color: riskColor(m.riskScore), borderColor: riskColor(m.riskScore), background: "rgba(255,255,255,0.03)" }}
        >
          {m.hasData ? `${m.label}風險` : "—"}
        </span>
      </div>

      {/* 風險分數條 */}
      <div className="mt-3 flex items-center gap-2">
        <span className="w-12 shrink-0 text-[11px] text-muted-foreground">風險分</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full transition-all" style={{ width: `${m.riskScore}%`, background: riskColor(m.riskScore) }} />
        </div>
        <span className="w-7 text-right font-mono-num text-xs font-bold">{m.hasData ? m.riskScore : "—"}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] text-muted-foreground">年化波動</div>
          <div className="mt-0.5 font-mono-num text-sm font-bold">{m.hasData ? `${m.annualVolPct.toFixed(0)}%` : "—"}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">近月動能</div>
          <div className={`mt-0.5 flex items-center justify-center gap-0.5 font-mono-num text-sm font-bold ${up ? "text-up" : "text-down"}`}>
            {m.hasData ? (
              <>
                {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {Math.abs(m.momentumPct).toFixed(1)}%
              </>
            ) : (
              "—"
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">建議 LTV</div>
          <div className="mt-0.5 font-mono-num text-sm font-bold text-primary">{m.hasData ? `${(m.suggestedLtvBps / 100).toFixed(0)}%` : "—"}</div>
        </div>
      </div>
    </motion.div>
  )
}

export default function Risk() {
  const history = useTwseHistory()
  return (
    <div>
      <PageHeader
        icon={Gauge}
        title="AI 估值 · 風險引擎"
        desc="以真實近月每日收盤(TWSE)計算各台股的年化波動度、動能與風險分數,並輸出『風險驅動的建議 LTV』。對照借貸目前固定的 50% LTV —— 這即是題目七的量化風險/估值模型。"
      />

      <div className="glass mb-4 rounded-2xl p-4 text-xs leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">模型說明:</span> 風險分數由<span className="text-foreground"> 年化波動度 </span>(日報酬標準差 × √252)正規化到 0–100;
        波動越大、風險越高、<span className="text-foreground">建議 LTV 越低</span>(高風險 30% ↔ 低風險 65%)。可接回 <code className="rounded bg-white/5 px-1 font-mono-num">LendingPool.setRiskParams</code> 做動態調整。
        <span className="text-foreground">(資料源為真實 TWSE 收盤,計算在前端即時完成。)</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATALOG.map((s, i) => (
          <RiskCard key={s.code} stock={s} m={computeRisk(history[s.code])} i={i} />
        ))}
      </div>
    </div>
  )
}
