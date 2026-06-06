import { useState } from "react"
import { toast } from "sonner"
import { useReadContracts } from "wagmi"
import { PageHeader } from "@/components/PageHeader"
import { useWallet } from "@/lib/wallet"
import { useTx } from "@/hooks/useTx"
import { TWD, readUrl, addrUrl } from "@/lib/contracts"
import { fmtNum } from "@/lib/format"
import { ShieldCheck, Building2, FileCheck2, ExternalLink, RefreshCw } from "lucide-react"

function Dial({ pct }: { pct: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.min(pct, 100) / 100)
  return (
    <svg width="150" height="150" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="12" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform="rotate(-90 70 70)"
        style={{ filter: "drop-shadow(0 0 8px rgba(25,230,176,.5))" }}
      />
      <text x="70" y="68" textAnchor="middle" fill="var(--foreground)" fontSize="24" fontWeight="700" fontFamily="JetBrains Mono">
        {pct.toFixed(1)}%
      </text>
      <text x="70" y="88" textAnchor="middle" fill="var(--muted-foreground)" fontSize="10">
        儲備覆蓋率
      </text>
    </svg>
  )
}

export default function Stablecoin() {
  const { connected } = useWallet()
  const { run } = useTx()
  const [amt, setAmt] = useState("")

  const { data } = useReadContracts({
    contracts: [
      { ...TWD, functionName: "issuerName" },
      { ...TWD, functionName: "licenseNo" },
      { ...TWD, functionName: "custodianBank" },
      { ...TWD, functionName: "auditReportURI" },
      { ...TWD, functionName: "termsURI" },
      { ...TWD, functionName: "reserveAttestedTWD" },
      { ...TWD, functionName: "totalSupply" },
      { ...TWD, functionName: "reserveRatioBps" },
      { ...TWD, functionName: "lastAttestationAt" },
      { ...TWD, functionName: "redemptionCount" },
    ],
    query: { refetchInterval: 15000 },
  })
  const g = (i: number) => data?.[i]?.result
  const ratioBps = Number((g(7) as bigint) ?? 0n)
  const pct = ratioBps / 100
  const reserve = Number((g(5) as bigint) ?? 0n) / 1e6
  const supply = Number((g(6) as bigint) ?? 0n) / 1e6
  const lastAt = Number((g(8) as bigint) ?? 0n)

  const disclosure = [
    { k: "發行人", v: (g(0) as string) ?? "—" },
    { k: "牌照號", v: (g(1) as string) ?? "—" },
    { k: "保管銀行", v: (g(2) as string) ?? "—" },
    { k: "審計 / 月報", v: (g(3) as string) ?? "—" },
    { k: "使用條款", v: (g(4) as string) ?? "—" },
  ]

  const redeem = async () => {
    if (!connected) return toast.error("請先連接錢包")
    const n = Math.floor(Number(amt))
    if (!n || n <= 0) return toast.error("請輸入金額")
    try {
      await run(
        { address: TWD.address, abi: TWD.abi, functionName: "requestRedemption", args: [BigInt(n) * 10n ** 6n] },
        { pending: "送出贖回…", success: `已申請贖回 ${fmtNum(n)} TWD` },
      )
      setAmt("")
    } catch {
      /* handled */
    }
  }

  return (
    <div>
      <PageHeader
        icon={ShieldCheck}
        title="TWD 受監管穩定幣"
        desc="對標金管會《穩定幣專法》草案精神:100% 法幣儲備、定期儲備證明、持有人贖回權、發行人揭露與凍結/暫停控制。以下數據全部即時讀自 Sepolia 鏈上合約。"
      />

      <a
        href={readUrl(TWD.address)}
        target="_blank"
        rel="noreferrer"
        className="mb-4 inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-primary transition hover:bg-primary/10"
      >
        <FileCheck2 className="size-4" />
        在 Etherscan「Read Contract」查驗每一項揭露與儲備 <ExternalLink className="size-3.5" />
      </a>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="glass flex flex-col items-center rounded-2xl p-5">
          <Dial pct={pct} />
          <div className="mt-3 text-center">
            <div className="font-mono-num text-lg font-bold">NT$ {fmtNum(reserve)}</div>
            <div className="text-xs text-muted-foreground">已簽證法幣儲備</div>
          </div>
          <div className="mt-3 w-full rounded-xl bg-primary/10 py-2 text-center text-sm font-semibold text-primary ring-1 ring-primary/20">
            {pct >= 100 ? "✅ 100% 足額擔保" : `⚠ ${pct.toFixed(1)}%`}
          </div>
          <div className="mt-3 w-full text-center text-[11px] text-muted-foreground">
            流通量 {fmtNum(supply)} TWD
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Building2 className="size-4 text-accent" /> 發行人揭露
          </h3>
          <div className="mt-3 divide-y divide-border">
            {disclosure.map((d) => (
              <div key={d.k} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="text-muted-foreground">{d.k}</span>
                <span className="truncate font-mono-num text-foreground">{d.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="glass rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <FileCheck2 className="size-4 text-primary" /> 儲備證明
            <span className="text-xs font-normal text-muted-foreground">on-chain attestation</span>
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card/50 p-3">
              <div className="text-xs text-muted-foreground">最後簽證時間</div>
              <div className="mt-1 font-mono-num text-sm font-bold">
                {lastAt ? new Date(lastAt * 1000).toLocaleString("zh-Hant", { hour12: false }) : "—"}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card/50 p-3">
              <div className="text-xs text-muted-foreground">已簽證儲備</div>
              <div className="mt-1 font-mono-num text-sm font-bold">NT$ {fmtNum(reserve)}</div>
            </div>
            <div className="rounded-xl border border-border bg-card/50 p-3">
              <div className="text-xs text-muted-foreground">累計贖回次數</div>
              <div className="mt-1 font-mono-num text-sm font-bold">{Number((g(9) as bigint) ?? 0n)}</div>
            </div>
          </div>
          <a
            href={`${addrUrl(TWD.address)}#events`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            在 Etherscan 查看完整 ReserveAttested 事件歷史 <ExternalLink className="size-3.5" />
          </a>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <RefreshCw className="size-4 text-accent" /> 持有人贖回
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">燒毀 TWD 換回法幣(鏈上記錄贖回請求)。</p>
          <input
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            placeholder="贖回金額 TWD"
            className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2.5 font-mono-num text-sm outline-none focus:border-primary"
          />
          <button
            onClick={redeem}
            className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground glow-jade transition hover:brightness-105"
          >
            申請贖回
          </button>
          <div className="mt-3 rounded-xl border border-border bg-card/50 p-3 text-[11px] text-muted-foreground">
            合規控制:發行人可依法遵需求<span className="text-foreground"> 凍結個別地址 </span>或
            <span className="text-foreground"> 全面暫停 </span>流通,皆記錄於鏈上事件。
          </div>
        </div>
      </div>
    </div>
  )
}
