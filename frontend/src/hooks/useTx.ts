import { useWriteContract } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"
import { toast } from "sonner"
import { wagmiConfig } from "@/lib/wagmi"
import { txUrl } from "@/lib/contracts"
import type { Abi } from "viem"

export type TxParams = {
  address: `0x${string}`
  abi: Abi
  functionName: string
  args?: readonly unknown[]
}

/** 送出交易 → toast 等待 → 完成附 Etherscan 連結。回傳交易 hash。 */
export function useTx() {
  const { writeContractAsync, isPending } = useWriteContract()

  const run = async (
    params: TxParams,
    msg?: { pending?: string; success?: string },
  ): Promise<`0x${string}`> => {
    const t = toast.loading(msg?.pending ?? "交易送出,等待錢包確認…")
    try {
      const hash = await writeContractAsync(params as never)
      toast.loading("等待區塊確認…", { id: t })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      toast.success(msg?.success ?? "交易完成", {
        id: t,
        action: { label: "Etherscan ↗", onClick: () => window.open(txUrl(hash), "_blank") },
      })
      return hash
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string }
      toast.error("交易取消 / 失敗:" + (err.shortMessage ?? err.message ?? ""), { id: t })
      throw e
    }
  }

  return { run, isPending }
}
