import { useState } from "react"
import { toast } from "sonner"
import { useAccount, useReadContract, useReadContracts } from "wagmi"
import { PageHeader } from "@/components/PageHeader"
import { useWallet } from "@/lib/wallet"
import { useTx } from "@/hooks/useTx"
import { TWD, LENDING, stockContract, tokenOf } from "@/lib/contracts"
import { CATALOG } from "@/lib/catalog"
import { fmtTWD, fmtNum } from "@/lib/format"
import { Landmark, PiggyBank, HandCoins } from "lucide-react"
import { cn } from "@/lib/utils"

function hfColor(hf: number) {
  if (hf >= 1.5) return "var(--down)"
  if (hf >= 1.15) return "var(--accent)"
  return "var(--up)"
}

/** 小型存/取切換 */
function Seg({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-background p-1 text-xs">
      {opts.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={cn(
            "rounded-lg py-1.5 font-semibold transition",
            value === k ? "bg-primary/15 text-primary ring-1 ring-primary/25" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const inputCls = "w-full rounded-xl border border-input bg-background px-3 py-2.5 font-mono-num text-sm outline-none focus:border-primary"

export default function Lending() {
  const { address } = useAccount()
  const { connected } = useWallet()
  const { run } = useTx()
  const [busy, setBusy] = useState(false)

  const [depositMode, setDepositMode] = useState("in")
  const [depositAmt, setDepositAmt] = useState("")
  const [collMode, setCollMode] = useState("in")
  const [collCode, setCollCode] = useState(CATALOG[0].code)
  const [collShares, setCollShares] = useState("")
  const [borrowMode, setBorrowMode] = useState("in")
  const [borrowAmt, setBorrowAmt] = useState("")

  const { data } = useReadContracts({
    contracts: [
      { ...LENDING, functionName: "getUserAccount", args: [address as `0x${string}`] },
      { ...LENDING, functionName: "getPoolStats" },
      { ...LENDING, functionName: "getUserDeposit", args: [address as `0x${string}`] },
    ],
    query: { enabled: !!address, refetchInterval: 10000 },
  })
  const acct = data?.[0]?.result as [bigint, bigint, bigint, bigint] | undefined
  const pool = data?.[1]?.result as [bigint, bigint, bigint, bigint, bigint, bigint] | undefined
  const deposit = data?.[2]?.result as bigint | undefined

  // 目前選到的台股已質押多少(供「取回」參考)
  const collToken = tokenOf(collCode)
  const { data: suppliedRaw } = useReadContract({
    ...LENDING,
    functionName: "userCollateral",
    args: [address as `0x${string}`, collToken as `0x${string}`],
    query: { enabled: !!address && !!collToken, refetchInterval: 10000 },
  })
  const suppliedShares = suppliedRaw ? Number(suppliedRaw as bigint) / 1e18 : 0

  const collateral = acct ? Number(acct[0]) / 1e6 : 0
  const debt = acct ? Number(acct[1]) / 1e6 : 0
  const borrowable = acct ? Number(acct[2]) / 1e6 : 0
  const hfRaw = acct ? acct[3] : 0n
  const hf = hfRaw > 10n ** 12n ? Infinity : Number(hfRaw) / 10000
  const myDeposit = deposit ? Number(deposit) / 1e6 : 0
  const borrowApr = pool ? Number(pool[4]) / 100 : 0
  const supplyApr = pool ? Number(pool[5]) / 100 : 0
  const util = pool ? Number(pool[3]) / 100 : 0
  const pct = hf === Infinity ? 100 : Math.min(100, (hf / 3) * 100)

  const wrap = async (fn: () => Promise<unknown>) => {
    if (!connected) return toast.error("請先連接錢包")
    setBusy(true)
    try {
      await fn()
    } catch {
      /* handled */
    } finally {
      setBusy(false)
    }
  }

  // 出借 TWD:存入 / 取回
  const doDeposit = () =>
    wrap(async () => {
      const n = Math.floor(Number(depositAmt))
      if (!n) return toast.error("請輸入金額")
      const raw = BigInt(n) * 10n ** 6n
      if (depositMode === "in") {
        await run({ address: TWD.address, abi: TWD.abi, functionName: "approve", args: [LENDING.address, raw] }, { pending: "授權 TWD…", success: "已授權" })
        await run({ ...LENDING, functionName: "depositTWD", args: [raw] }, { pending: "存入中…", success: `已出借 ${n} TWD` })
      } else {
        await run({ ...LENDING, functionName: "withdrawTWD", args: [raw] }, { pending: "取回中…", success: `已取回 ${n} TWD` })
      }
      setDepositAmt("")
    })

  // 抵押品:質押 / 取回
  const doColl = () =>
    wrap(async () => {
      const sc = stockContract(collCode)
      const t = tokenOf(collCode)
      const n = Number(collShares)
      if (!sc || !t || !n) return toast.error("請輸入股數")
      const raw = BigInt(Math.floor(n)) * 10n ** 18n
      if (collMode === "in") {
        await run({ address: sc.address, abi: sc.abi, functionName: "approve", args: [LENDING.address, raw] }, { pending: "授權代幣…", success: "已授權" })
        await run({ ...LENDING, functionName: "supplyCollateral", args: [t, raw] }, { pending: "質押中…", success: `已質押 ${n} 股` })
      } else {
        await run({ ...LENDING, functionName: "withdrawCollateral", args: [t, raw] }, { pending: "取回中…", success: `已取回 ${n} 股` })
      }
      setCollShares("")
    })

  // 借款:借出 / 還款
  const doBorrow = () =>
    wrap(async () => {
      const n = Math.floor(Number(borrowAmt))
      if (!n) return toast.error("請輸入金額")
      const raw = BigInt(n) * 10n ** 6n
      if (borrowMode === "in") {
        await run({ ...LENDING, functionName: "borrowTWD", args: [raw] }, { pending: "借款中…", success: `已借出 ${n} TWD` })
      } else {
        await run({ address: TWD.address, abi: TWD.abi, functionName: "approve", args: [LENDING.address, raw] }, { pending: "授權 TWD…", success: "已授權" })
        await run({ ...LENDING, functionName: "repay", args: [raw] }, { pending: "還款中…", success: `已還款 ${n} TWD` })
      }
      setBorrowAmt("")
    })

  return (
    <div>
      <PageHeader
        icon={Landmark}
        title="台股質押借貸"
        desc="出借 TWD 賺息、或質押台股代幣借出 TWD;存入與取回都可隨時操作。利率隨資金使用率浮動,健康因子 < 1 將被清算(對標 Aave / 幣安質押借貸)。"
      />

      {/* 部位總覽 */}
      <div className="glass mb-4 rounded-2xl p-5">
        <div className="grid gap-4 sm:grid-cols-5">
          <div><div className="text-xs text-muted-foreground">抵押價值</div><div className="mt-1 font-mono-num text-xl font-bold">{fmtTWD(collateral)}</div></div>
          <div><div className="text-xs text-muted-foreground">已借出</div><div className="mt-1 font-mono-num text-xl font-bold">{fmtTWD(debt)}</div></div>
          <div><div className="text-xs text-muted-foreground">尚可借</div><div className="mt-1 font-mono-num text-xl font-bold text-primary">{fmtTWD(borrowable)}</div></div>
          <div><div className="text-xs text-muted-foreground">我的出借</div><div className="mt-1 font-mono-num text-xl font-bold">{fmtTWD(myDeposit)}</div></div>
          <div>
            <div className="text-xs text-muted-foreground">健康因子</div>
            <div className="mt-1 font-mono-num text-xl font-bold" style={{ color: hfColor(hf) }}>{hf === Infinity ? "∞" : hf.toFixed(2)}</div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: hfColor(hf) }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
          <span>清算線 1.00 · 使用率 {util.toFixed(1)}%</span>
          <span>借款年利率 ~{borrowApr.toFixed(1)}% · 出借年利率 ~{supplyApr.toFixed(1)}%</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 出借賺息 */}
        <div className="glass rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-semibold"><PiggyBank className="size-4 text-primary" /> 出借 TWD 賺息</h3>
          <div className="mt-2 flex justify-between text-xs"><span className="text-muted-foreground">我的出借</span><span className="font-mono-num">{fmtTWD(myDeposit)}</span></div>
          <div className="mb-3 flex justify-between text-xs"><span className="text-muted-foreground">出借年利率</span><span className="font-mono-num text-primary">~{supplyApr.toFixed(1)}%</span></div>
          <Seg value={depositMode} onChange={setDepositMode} opts={[["in", "存入"], ["out", "取回"]]} />
          <input value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} placeholder="TWD 金額" className={cn(inputCls, "mt-3")} />
          <button onClick={doDeposit} disabled={busy} className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground glow-jade transition hover:brightness-105 disabled:opacity-60">
            {depositMode === "in" ? "存入 TWD" : "取回 TWD"}
          </button>
        </div>

        {/* 質押借款(抵押品 ⇄ 借款) */}
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <h3 className="flex items-center gap-2 font-semibold"><Landmark className="size-4 text-primary" /> 質押台股 ⇄ 借 TWD</h3>
          <div className="mt-3 grid gap-5 sm:grid-cols-2">
            {/* 抵押品 */}
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">① 抵押品(台股代幣)</div>
              <Seg value={collMode} onChange={setCollMode} opts={[["in", "質押"], ["out", "取回"]]} />
              <select value={collCode} onChange={(e) => setCollCode(e.target.value)} className={cn(inputCls, "mt-3 px-2")}>
                {CATALOG.map((s) => <option key={s.code} value={s.code}>{s.name} {s.symbol}</option>)}
              </select>
              <input value={collShares} onChange={(e) => setCollShares(e.target.value)} placeholder={collMode === "in" ? "質押股數" : "取回股數"} className={cn(inputCls, "mt-2")} />
              <div className="mt-1.5 text-[11px] text-muted-foreground">目前已質押 <span className="font-mono-num text-foreground">{fmtNum(suppliedShares, 2)}</span> 股</div>
              <button onClick={doColl} disabled={busy} className="mt-2 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground glow-jade transition hover:brightness-105 disabled:opacity-60">
                {collMode === "in" ? "質押台股" : "取回台股"}
              </button>
            </div>

            {/* 借款 */}
            <div className="sm:border-l sm:border-border sm:pl-5">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><HandCoins className="size-3.5 text-accent" /> ② 借款(TWD)</div>
              <Seg value={borrowMode} onChange={setBorrowMode} opts={[["in", "借出"], ["out", "還款"]]} />
              <input value={borrowAmt} onChange={(e) => setBorrowAmt(e.target.value)} placeholder="TWD 金額" className={cn(inputCls, "mt-3")} />
              <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                <span>已借 <span className="font-mono-num text-foreground">{fmtNum(debt)}</span></span>
                <span>可借 <span className="font-mono-num text-primary">{fmtNum(borrowable)}</span></span>
              </div>
              <button onClick={doBorrow} disabled={busy} className="mt-2 w-full rounded-xl border border-border bg-card py-2.5 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-60">
                {borrowMode === "in" ? "借出 TWD" : "還款"}
              </button>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">提示:有借款時,「取回台股」會受健康因子限制(取回後健康因子須 ≥ 1);先還款即可全數取回。</p>
        </div>
      </div>
    </div>
  )
}
