import { useWriteContract } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"
import { wagmiConfig } from "@/lib/wagmi"
import { txStore } from "@/lib/txStore"
import type { Abi } from "viem"

export type TxParams = {
  address: `0x${string}`
  abi: Abi
  functionName: string
  args?: readonly unknown[]
}

/** 送出交易 → 驅動全域 <TxOverlay/> 鏈上驗證動畫 → 完成附 Etherscan。回傳交易 hash。 */
export function useTx() {
  const { writeContractAsync, isPending } = useWriteContract()

  const run = async (
    params: TxParams,
    msg?: { pending?: string; success?: string },
  ): Promise<`0x${string}`> => {
    txStore.start(msg?.pending ?? "處理交易中")
    try {
      const hash = await writeContractAsync(params as never)
      txStore.pending(hash)
      await waitForTransactionReceipt(wagmiConfig, { hash })
      txStore.success(hash)
      return hash
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string }
      txStore.error(err.shortMessage ?? err.message ?? "交易已取消")
      throw e
    }
  }

  return { run, isPending }
}
