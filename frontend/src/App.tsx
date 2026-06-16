import { Routes, Route } from "react-router-dom"
import { Layout } from "@/components/Layout"
import Dashboard from "@/routes/Dashboard"
import Trade from "@/routes/Trade"
import Swap from "@/routes/Swap"
import Lending from "@/routes/Lending"
import IPO from "@/routes/IPO"
import Stablecoin from "@/routes/Stablecoin"
import Portfolio from "@/routes/Portfolio"
import Risk from "@/routes/Risk"

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="trade" element={<Trade />} />
        <Route path="swap" element={<Swap />} />
        <Route path="lending" element={<Lending />} />
        <Route path="risk" element={<Risk />} />
        <Route path="ipo" element={<IPO />} />
        <Route path="stablecoin" element={<Stablecoin />} />
      </Route>
    </Routes>
  )
}
