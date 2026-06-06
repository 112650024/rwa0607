import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { sepolia } from "wagmi/chains"
import { http } from "wagmi"

/**
 * wagmi + RainbowKit 設定(Sepolia)。
 * WalletConnect 需要 projectId;沒設也能用 MetaMask 等 injected 錢包。
 * 要啟用 WalletConnect 掃碼,於 frontend/.env 設 VITE_WC_PROJECT_ID(到 cloud.walletconnect.com 免費申請)。
 */
export const wagmiConfig = getDefaultConfig({
  appName: "FormosaX",
  projectId: import.meta.env.VITE_WC_PROJECT_ID || "formosax_demo_projectid",
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(
      import.meta.env.VITE_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
    ),
  },
  ssr: false,
})
