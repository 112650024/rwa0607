import { useState } from "react"
import { toast } from "sonner"
import { useAccount, useReadContracts } from "wagmi"
import { PageHeader } from "@/components/PageHeader"
import { useWallet } from "@/lib/wallet"
import { useTx } from "@/hooks/useTx"
import { TWD, LENDING, stockContract, tokenOf } from "@/lib/contracts"
import { CATALOG } from "@/lib/catalog"
import { fmtTWD } from "@/lib/format"
import { Landmark, PiggyBank, HandCoins, Wallet2 } from "lucide-react"

function hfColor(hf: number) {
  if (hf >= 1.5) return "var(--down)"
  if (hf >= 1.15) return "var(--accent)"
  return "var(--up)"
}

export default function Lending() {
  const { address } = useAccount()
  const { connected } = useWallet()
  const { run } = useTx()
  const [busy, setBusy] = useState(false)

  // 表單
  const [depositAmt, setDepositAmt] = useState("")
  const [collCode, setCollCode] = useState(CATALOG[0].code)
  const [collShares, setCollShares] = useState("")
  const [borrowAmt, setBorrowAmt] = useState("")
  const [repayAmt, setRepayAmt] = useState("")

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

  const guard = () => {
    if (!connected) {
      toast.error("請先連接錢包")
      return false
    }
    return true
  }
  const wrap = async (fn: () => Promise<unknown>) => {
    if (!guard()) return
    setBusy(true)
    try {
      await fn()
    } catch {
      /* handled */
    } finally {
      setBusy(false)
    }
  }

  const doDeposit = () =>
    wrap(async () => {
      const n = Math.floor(Number(depositAmt))
      if (!n) return toast.error("請輸入金額")
      const raw = BigInt(n) * 10n ** 6n
      await run({ address: TWD.address, abi: TWD.abi, functionName: "approve", args: [LENDING.address, raw] }, { pending: "授權 TWD…", success: "已授權" })
      await run({ address: LENDING.address, abi: LENDING.abi, functionName: "depositTWD", args: [raw] }, { pending: "存入中…", success: `已出借 ${n} TWD` })
      setDepositAmt("")
    })

  const doSupply = () =>
    wrap(async () => {
      const sc = stockContract(collCode)
      const t = tokenOf(collCode)
      const n = Number(collShares)
      if (!sc || !t || !n) return toast.error("請輸入股數")
      const raw = BigInt(Math.floor(n)) * 10n ** 18n
      await run({ address: sc.address, abi: sc.abi, functionName: "approve", args: [LENDING.address, raw] }, { pending: "授權代幣…", success: "已授權" })
      await run({ address: LENDING.address, abi: LENDING.abi, functionName: "supplyCollateral", args: [t, raw] }, { pending: "質押中…", success: `已質押 ${n} 股` })
      setCollShares("")
    })

  const doBorrow = () =>
    wrap(async () => {
      const n = Math.floor(Number(borrowAmt))
      if (!n) return toast.error("請輸入金額")
      await run({ address: LENDING.address, abi: LENDING.abi, functionName: "borrowTWD", args: [BigInt(n) * 10n ** 6n] }, { pending: "借款中…", success: `已借出 ${n} TWD` })
      setBorrowAmt("")
    })

  const doRepay = () =>
    wrap(async () => {
      const n = Math.floor(Number(repayAmt))
      if (!n) return toast.error("請輸入金額")
      const raw = BigInt(n) * 10n ** 6n
      await run({ address: TWD.address, abi: TWD.abi, functionName: "approve", args: [LENDING.address, raw] }, { pending: "授權 TWD…", success: "已授權" })
      await run({ address: LENDING.address, abi: LENDING.abi, functionName: "repay", args: [raw] }, { pending: "還款中…", success: `已還款 ${n} TWD` })
      setRepayAmt("")
    })

  return (
    <div>
      <PageHeader
        icon={Landmark}
        title="台股質押借貸"
        desc="出借 TWD 賺取利息,或質押你的台股代幣借出 TWD。利率隨資金使用率浮動,健康因子 < 1 將被清算(對標 Aave / 幣安質押借貸)。"
      />

      {/* 部位總覽 */}
      <div className="glass mb-4 rounded-2xl p-5">
        <div className="grid gap-4 sm:grid-cols-5">
          <div>
            <div className="text-xs text-muted-foreground">抵押價值</div>
            <div className="mt-1 font-mono-num text-xl font-bold">{fmtTWD(collateral)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">已借出</div>
            <div className="mt-1 font-mono-num text-xl font-bold">{fmtTWD(debt)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">尚可借</div>
            <div className="mt-1 font-mono-num text-xl font-bold text-primary">{fmtTWD(borrowable)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">我的出借</div>
            <div className="mt-1 font-mono-num text-xl font-bold">{fmtTWD(myDeposit)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">健康因子</div>
            <div className="mt-1 font-mono-num text-xl font-bold" style={{ color: hfColor(hf) }}>
              {hf === Infinity ? "∞" : hf.toFixed(2)}
            </div>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* 出借 */}
        <div className="glass rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-semibold"><PiggyBank className="size-4 text-primary" /> 出借 TWD 賺息</h3>
          <p className="mt-1 text-xs text-muted-foreground">提供流動性,按使用率賺取利息。</p>
          <input value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} placeholder="TWD 金額"
            className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2.5 font-mono-num text-sm outline-none focus:border-primary" />
          <button onClick={doDeposit} disabled={busy} className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground glow-jade transition hover:brightness-105 disabled:opacity-60">存入 TWD</button>
        </div>
        {/* 質押 */}
        <div className="glass rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-semibold"><Landmark className="size-4 text-primary" /> 質押台股</h3>
          <p className="mt-1 text-xs text-muted-foreground">存入台股代幣作為抵押品。</p>
          <select value={collCode} onChange={(e) => setCollCode(e.target.value)}
            className="mt-3 w-full rounded-xl border border-input bg-background px-2 py-2 text-sm outline-none focus:border-primary">
            {CATALOG.map((s) => <option key={s.code} value={s.code}>{s.name} {s.symbol}</option>)}
          </select>
          <input value={collShares} onChange={(e) => setCollShares(e.target.value)} placeholder="股數"
            className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 font-mono-num text-sm outline-none focus:border-primary" />
          <button onClick={doSupply} disabled={busy} className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground glow-jade transition hover:brightness-105 disabled:opacity-60">質押代幣</button>
        </div>
        {/* 借款 */}
        <div className="glass rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-semibold"><HandCoins className="size-4 text-accent" /> 借出 TWD</h3>
          <p className="mt-1 text-xs text-muted-foreground">依抵押價值與 LTV 借出 TWD。</p>
          <input value={borrowAmt} onChange={(e) => setBorrowAmt(e.target.value)} placeholder="TWD 金額"
            className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2.5 font-mono-num text-sm outline-none focus:border-primary" />
          <button onClick={doBorrow} disabled={busy} className="mt-3 w-full rounded-xl border border-border bg-card py-2.5 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-60">借款</button>
        </div>
        {/* 還款 */}
        <div className="glass rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-semibold"><Wallet2 className="size-4 text-accent" /> 還款</h3>
          <p className="mt-1 text-xs text-muted-foreground">償還 TWD 借款,提升健康因子。</p>
          <input value={repayAmt} onChange={(e) => setRepayAmt(e.target.value)} placeholder="TWD 金額"
            className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2.5 font-mono-num text-sm outline-none focus:border-primary" />
          <button onClick={doRepay} disabled={busy} className="mt-3 w-full rounded-xl border border-border bg-card py-2.5 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-60">還款</button>
        </div>
      </div>
    </div>
  )
}
