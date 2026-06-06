import { NavLink, Outlet, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
  Rocket,
  ShieldCheck,
  Wallet,
  Coins,
} from "lucide-react"
import { Logo } from "./Logo"
import { useWallet } from "@/lib/wallet"
import { useFaucet, useTwdBalance } from "@/hooks/useChain"
import { shortAddr, fmtNum } from "@/lib/format"
import { cn } from "@/lib/utils"

const FAUCET_AMT = 100000

const NAV = [
  { to: "/", label: "總覽", icon: LayoutDashboard, end: true },
  { to: "/trade", label: "交易", icon: ArrowLeftRight },
  { to: "/lending", label: "借貸", icon: Landmark },
  { to: "/ipo", label: "IPO 認購", icon: Rocket },
  { to: "/stablecoin", label: "穩定幣", icon: ShieldCheck },
]

function NavItem({ to, label, icon: Icon, end }: (typeof NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary transition-opacity",
              isActive ? "opacity-100" : "opacity-0",
            )}
          />
          <span
            className={cn(
              "grid size-7 place-items-center rounded-lg transition-colors",
              isActive ? "bg-primary/15 text-primary" : "bg-white/[0.03] text-muted-foreground group-hover:text-foreground",
            )}
          >
            <Icon className="size-[17px]" />
          </span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

function FaucetButton() {
  const { connected } = useWallet()
  const { claim } = useFaucet()
  return (
    <button
      onClick={() => (connected ? claim(FAUCET_AMT) : toast.error("請先連接錢包"))}
      className="inline-flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent/15"
    >
      <Coins className="size-4" />
      <span className="hidden sm:inline">領 TWD</span>
    </button>
  )
}

function ConnectButton() {
  const { connected, address, connect, disconnect } = useWallet()
  return (
    <button
      onClick={connected ? disconnect : connect}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
        connected
          ? "border border-border bg-card text-foreground hover:border-primary/40"
          : "bg-primary text-primary-foreground hover:brightness-105 glow-jade",
      )}
    >
      {connected ? (
        <>
          <span className="size-2 rounded-full bg-primary" />
          <span className="font-mono-num">{shortAddr(address!)}</span>
        </>
      ) : (
        <>
          <Wallet className="size-4" />
          連接錢包
        </>
      )}
    </button>
  )
}

function WalletCard() {
  const { connected, connect } = useWallet()
  const { twd } = useTwdBalance()
  const { claim } = useFaucet()
  return (
    <div className="glass rounded-xl p-3.5">
      {connected ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">TWD 餘額</span>
            <span className="size-2 rounded-full bg-primary animate-pulse" />
          </div>
          <div className="mt-0.5 font-mono-num text-xl font-bold">{fmtNum(twd)}</div>
          <button
            onClick={() => claim(FAUCET_AMT)}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent/15 py-2 text-xs font-semibold text-accent ring-1 ring-accent/25 transition hover:bg-accent/20"
          >
            <Coins className="size-3.5" /> 領取測試 TWD
          </button>
        </>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">連接錢包以開始交易、借貸與認購。</div>
          <button
            onClick={connect}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-105"
          >
            <Wallet className="size-3.5" /> 連接錢包
          </button>
        </>
      )}
    </div>
  )
}

function PageFade() {
  const { pathname } = useLocation()
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <Outlet />
    </motion.div>
  )
}

export function Layout() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1320px]">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r border-border px-4 py-5 md:flex">
        <div className="mb-6 px-2">
          <Logo size={34} withWord />
        </div>

        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
          選單
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </nav>

        <div className="mt-auto space-y-3 pt-6">
          <WalletCard />
          <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Sepolia 測試網 · 非真實金融商品
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Logo size={28} withWord />
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            預言機即時報價 · 鏈上結算
          </div>
          <div className="flex items-center gap-2">
            <FaucetButton />
            <ConnectButton />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-6 md:py-8">
          <PageFade />
        </main>

        <nav className="sticky bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/90 backdrop-blur-xl md:hidden">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px]",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
