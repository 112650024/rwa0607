import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import { CATALOG } from "@/lib/catalog"
import { usePrices } from "@/hooks/useChain"
import { StockLogo } from "@/components/StockLogo"
import { Sparkline } from "@/components/Sparkline"
import { MarketTicker } from "@/components/MarketTicker"
import { fmtNum, fmtTWD } from "@/lib/format"
import {
  ShieldCheck,
  Landmark,
  Rocket,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react"

const fade = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const },
  }),
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  i,
}: {
  icon: LucideIcon
  label: string
  value: string
  sub: string
  accent: "jade" | "gold"
  i: number
}) {
  return (
    <motion.div custom={i} variants={fade} initial="hidden" animate="show" className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={accent === "jade" ? "size-4 text-primary" : "size-4 text-accent"} />
      </div>
      <div className="mt-2 font-mono-num text-2xl font-bold">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </motion.div>
  )
}

export default function Dashboard() {
  const market = usePrices()
  const flag = CATALOG[0]
  const fl = market[flag.code]
  const up = fl.pct >= 0

  return (
    <div className="space-y-7">
      {/* Hero */}
      <section className="grid items-center gap-5 md:grid-cols-2">
        <motion.div custom={0} variants={fade} initial="hidden" animate="show">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Real World Asset · On-chain · Sepolia
          </div>
          <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
            把<span className="text-primary">台股</span>變成
            <br />
            24/7 鏈上金融
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            受監管 TWD 穩定幣兌換台股代幣,質押借貸、參與 IPO 認購 —— 預言機即時報價、鏈上 1:1 實股擔保、全程可查驗。
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              to="/trade"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow-jade transition hover:brightness-105"
            >
              開始交易 <ArrowUpRight className="size-4" />
            </Link>
            <Link
              to="/stablecoin"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold transition hover:border-primary/40"
            >
              穩定幣儲備
            </Link>
          </div>
        </motion.div>

        {/* 旗艦標的卡 */}
        <motion.div custom={1} variants={fade} initial="hidden" animate="show" className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <StockLogo stock={flag} size={46} />
            <div className="flex-1">
              <div className="font-semibold">
                {flag.name} <span className="font-mono-num text-xs text-muted-foreground">{flag.code}</span>
              </div>
              <div className="font-mono-num text-[11px] text-accent">{flag.symbol} · 旗艦標的</div>
            </div>
            <div className="text-right">
              <div className="font-mono-num text-2xl font-bold">{fmtNum(fl.price)}</div>
              <div className={`font-mono-num text-xs ${up ? "text-up" : "text-down"}`}>
                {up ? "▲" : "▼"} {Math.abs(fl.pct).toFixed(2)}%
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Sparkline data={fl.hist} w={460} h={90} />
          </div>
        </motion.div>
      </section>

      {/* 指標卡 */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat i={0} icon={Landmark} accent="jade" label="鏈上資產總額" value={fmtTWD(128_400_000)} sub="代幣化台股 + TWD" />
        <Stat i={1} icon={ShieldCheck} accent="gold" label="TWD 儲備率" value="100.0%" sub="法幣足額擔保" />
        <Stat i={2} icon={Landmark} accent="jade" label="借貸池 TVL" value={fmtTWD(24_800_000)} sub="可借 / 出借" />
        <Stat i={3} icon={Rocket} accent="gold" label="進行中 IPO" value="1 檔" sub="新股認購中" />
      </section>

      {/* 跑馬燈 */}
      <MarketTicker market={market} />

      {/* 市場 */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold tracking-wide">台股市場</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOG.map((s, idx) => {
            const L = market[s.code]
            const u = L.pct >= 0
            return (
              <motion.div
                key={s.code}
                custom={idx}
                variants={fade}
                initial="hidden"
                animate="show"
                className="glass rounded-2xl p-4 transition hover:border-primary/30"
              >
                <div className="flex items-start gap-3">
                  <StockLogo stock={s} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {s.name} <span className="font-mono-num text-xs text-muted-foreground">{s.code}</span>
                    </div>
                    <div className="font-mono-num text-[11px] text-primary">{s.symbol} · 可交易</div>
                  </div>
                  <span className={`font-mono-num text-xs ${u ? "text-up" : "text-down"}`}>
                    {u ? "▲" : "▼"} {Math.abs(L.pct).toFixed(2)}%
                  </span>
                </div>
                <div className="mt-3 font-mono-num text-2xl font-bold">{fmtNum(L.price)}</div>
                <div className="mt-1">
                  <Sparkline data={L.hist} />
                </div>
                <Link
                  to="/trade"
                  className="mt-2 block rounded-xl bg-primary/10 py-2 text-center text-sm font-semibold text-primary ring-1 ring-primary/20 transition hover:bg-primary/15"
                >
                  交易 {s.symbol}
                </Link>
              </motion.div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
