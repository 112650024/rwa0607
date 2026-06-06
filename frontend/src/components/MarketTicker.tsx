import { CATALOG } from "@/lib/catalog"
import type { Market } from "@/hooks/useMarket"
import { StockLogo } from "./StockLogo"
import { fmtNum } from "@/lib/format"

export function MarketTicker({ market }: { market: Market }) {
  const row = [...CATALOG, ...CATALOG]
  return (
    <div className="ticker-wrap border-y border-border bg-card/40">
      <div className="ticker">
        {row.map((s, i) => {
          const L = market[s.code]
          const up = L.pct >= 0
          return (
            <span key={i} className="flex items-center gap-2.5 border-r border-border px-5 py-2.5">
              <StockLogo stock={s} size={26} />
              <span className="text-sm text-foreground/90">{s.name}</span>
              <span className="font-mono-num text-sm">{fmtNum(L.price)}</span>
              <span className={`font-mono-num text-xs ${up ? "text-up" : "text-down"}`}>
                {up ? "▲" : "▼"} {Math.abs(L.pct).toFixed(2)}%
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
