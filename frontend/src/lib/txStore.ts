import { useSyncExternalStore } from "react"

// 全域交易狀態:讓 useTx 寫入、<TxOverlay/> 訂閱,做出漂亮的「鏈上驗證」動畫。
export type TxStatus = "idle" | "signing" | "pending" | "success" | "error"
export type TxState = {
  status: TxStatus
  label: string // 主標題,例如「步驟 2/2:買入鑄造」
  hash?: `0x${string}`
  error?: string
}

let state: TxState = { status: "idle", label: "" }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const set = (p: Partial<TxState>) => {
  state = { ...state, ...p }
  emit()
}

export const txStore = {
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  get: () => state,
  start(label: string) {
    set({ status: "signing", label, hash: undefined, error: undefined })
  },
  pending(hash: `0x${string}`) {
    set({ status: "pending", hash })
  },
  success(hash?: `0x${string}`) {
    set({ status: "success", hash: hash ?? state.hash })
  },
  error(msg: string) {
    set({ status: "error", error: msg })
  },
  close() {
    set({ status: "idle" })
  },
}

export const useTxState = () => useSyncExternalStore(txStore.subscribe, txStore.get, txStore.get)
