import { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useTxState, txStore } from "@/lib/txStore"
import { txUrl } from "@/lib/contracts"
import { shortAddr } from "@/lib/format"

const STEPS = [
  { key: "signing", label: "錢包簽署交易" },
  { key: "pending", label: "區塊鏈節點驗證中" },
  { key: "success", label: "已寫入區塊" },
]
const stepIndex = (s: string) => (s === "signing" ? 0 : s === "pending" ? 1 : s === "success" ? 2 : -1)

/** 全域「鏈上驗證」動畫覆蓋層。掛在 main.tsx,所有交易(買賣/借貸/IPO/穩定幣)共用。 */
export function TxOverlay() {
  const tx = useTxState()
  const open = tx.status !== "idle"
  const active = stepIndex(tx.status)
  const closeable = tx.status === "success" || tx.status === "error"

  useEffect(() => {
    if (tx.status === "success") {
      const t = setTimeout(() => txStore.close(), 1900)
      return () => clearTimeout(t)
    }
    if (tx.status === "error") {
      const t = setTimeout(() => txStore.close(), 3000)
      return () => clearTimeout(t)
    }
  }, [tx.status])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center p-4"
          style={{ background: "rgba(3,9,7,0.74)", backdropFilter: "blur(8px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => closeable && txStore.close()}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="glass relative w-full max-w-sm overflow-hidden rounded-3xl p-7 text-center"
            style={{ boxShadow: "0 30px 80px -20px rgba(0,0,0,0.7)" }}
          >
            {/* 旋轉流光(僅驗證中) */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -inset-10 opacity-30"
              style={{ background: "conic-gradient(from 0deg, transparent, var(--primary), transparent 35%)" }}
              animate={{ rotate: tx.status === "pending" || tx.status === "signing" ? 360 : 0 }}
              transition={{ repeat: tx.status === "pending" || tx.status === "signing" ? Infinity : 0, duration: 2.6, ease: "linear" }}
            />

            <div className="relative">
              {tx.status === "error" ? <ErrorMark /> : tx.status === "success" ? <SuccessMark /> : <ChainAnim />}

              <div className="mt-5 font-display text-lg font-semibold">
                {tx.status === "error" ? "交易失敗" : tx.status === "success" ? "已上鏈確認 ✅" : tx.label || "處理交易中"}
              </div>
              <div className="mt-1 min-h-4 text-xs text-muted-foreground">
                {tx.status === "error"
                  ? tx.error
                  : tx.status === "success"
                    ? "已永久寫入 Sepolia 區塊鏈,公開可驗證"
                    : STEPS[active]?.label}
              </div>

              {/* 步驟進度條 */}
              {tx.status !== "error" && (
                <div className="mt-5 flex items-center justify-center">
                  {STEPS.map((s, i) => (
                    <div key={s.key} className="flex items-center">
                      <motion.div
                        className="size-2.5 rounded-full"
                        animate={{
                          backgroundColor: i <= active ? "var(--primary)" : "rgba(255,255,255,0.16)",
                          scale: i === active && tx.status !== "success" ? [1, 1.5, 1] : 1,
                        }}
                        transition={{ duration: 0.9, repeat: i === active && tx.status !== "success" ? Infinity : 0 }}
                      />
                      {i < STEPS.length - 1 && (
                        <div className="mx-1.5 h-px w-8 overflow-hidden bg-white/10">
                          <motion.div
                            className="h-full bg-[var(--primary)]"
                            initial={{ width: 0 }}
                            animate={{ width: i < active ? "100%" : "0%" }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tx.hash && (
                <a
                  href={txUrl(tx.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 font-mono-num text-xs text-primary transition hover:border-primary/40"
                >
                  {shortAddr(tx.hash)} · Etherscan ↗
                </a>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** 驗證中:三個區塊串接脈動 + 外圈擴散 */
function ChainAnim() {
  return (
    <div className="relative mx-auto grid size-20 place-items-center">
      <motion.div
        className="absolute inset-0 rounded-2xl ring-2 ring-primary/30"
        animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
      />
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="size-5 rounded-md"
            style={{ background: "linear-gradient(135deg, var(--primary), #38bdf8)" }}
            initial={{ opacity: 0.25, y: 0 }}
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.18, ease: "easeInOut" }}
          />
        ))}
      </div>
    </div>
  )
}

/** 成功:擴散環 + 彈出圓 + 打勾繪製 */
function SuccessMark() {
  return (
    <div className="relative mx-auto grid size-20 place-items-center">
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ border: "2px solid var(--primary)" }}
        initial={{ scale: 0.5, opacity: 0.8 }}
        animate={{ scale: 1.7, opacity: 0 }}
        transition={{ duration: 0.7 }}
      />
      <motion.div
        className="grid size-16 place-items-center rounded-full bg-primary/15 ring-1 ring-primary/40"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
          <motion.path
            d="M4 12.5l5 5 11-11"
            stroke="var(--primary)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          />
        </svg>
      </motion.div>
    </div>
  )
}

/** 失敗:左右搖晃 + 紅色 X */
function ErrorMark() {
  return (
    <motion.div
      className="mx-auto grid size-16 place-items-center rounded-full bg-down/15 text-down ring-1 ring-down/40"
      initial={{ x: 0 }}
      animate={{ x: [0, -8, 8, -5, 5, 0] }}
      transition={{ duration: 0.5 }}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </motion.div>
  )
}
