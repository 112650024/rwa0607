import { useAccount, useDisconnect } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"

/** 錢包狀態(wagmi + RainbowKit)。介面與先前模擬版一致。 */
export function useWallet() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()
  return {
    address: address ?? null,
    connected: isConnected,
    connect: () => openConnectModal?.(),
    disconnect: () => disconnect(),
  }
}
