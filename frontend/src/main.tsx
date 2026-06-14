import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { WagmiProvider } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit"
import "@rainbow-me/rainbowkit/styles.css"
import "./index.css"
import App from "./App.tsx"
import { wagmiConfig } from "@/lib/wagmi"
import { Toaster } from "@/components/ui/sonner"
import { TxOverlay } from "@/components/TxOverlay"

const queryClient = new QueryClient()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#19e6b0",
            accentColorForeground: "#03130d",
            borderRadius: "large",
            overlayBlur: "small",
          })}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
    <Toaster position="bottom-center" theme="dark" richColors />
    <TxOverlay />
  </StrictMode>,
)
