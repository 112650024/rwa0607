/** 台股目錄(顯示/模擬用)。port 自 v1 data.js,精簡欄位。 */
export type Stock = {
  code: string
  name: string
  symbol: string // 代幣符號 dXXXX
  fallback: number // 示意價
  tint: string // 品牌漸層
  domain?: string // logo 網域
}

export const CATALOG: Stock[] = [
  { code: "2330", name: "台積電", symbol: "dTSMC", fallback: 2355, tint: "#e4002b,#8c0019", domain: "tsmc.com" },
  { code: "2317", name: "鴻海", symbol: "dHHPG", fallback: 205, tint: "#0a4ea2,#062f63", domain: "foxconn.com" },
  { code: "2454", name: "聯發科", symbol: "dMTK", fallback: 1280, tint: "#ff7a00,#b35400", domain: "mediatek.com" },
  { code: "2308", name: "台達電", symbol: "dDLT", fallback: 402, tint: "#0072ce,#004a87", domain: "deltaww.com" },
  { code: "2303", name: "聯電", symbol: "dUMC", fallback: 54, tint: "#00a3a3,#006060", domain: "umc.com" },
  { code: "2412", name: "中華電", symbol: "dCHT", fallback: 126, tint: "#00857c,#004f49", domain: "cht.com.tw" },
  { code: "2882", name: "國泰金", symbol: "dCAT", fallback: 66, tint: "#0c8a3e,#064d22", domain: "cathayholdings.com.tw" },
  { code: "2881", name: "富邦金", symbol: "dFBN", fallback: 92, tint: "#5aa800,#356200", domain: "fubon.com" },
  { code: "2603", name: "長榮", symbol: "dEVG", fallback: 195, tint: "#0a7a3f,#054d27", domain: "evergreen-marine.com" },
  { code: "3008", name: "大立光", symbol: "dLAR", fallback: 2520, tint: "#5b6bff,#2f3aa8", domain: "largan.com.tw" },
  { code: "0050", name: "元大台灣50", symbol: "d0050", fallback: 190, tint: "#e2231a,#8f140e" },
  { code: "2891", name: "中信金", symbol: "dCTBC", fallback: 39, tint: "#0033a0,#001f63", domain: "ctbcbank.com" },
]

export const logoUrl = (s: Stock) =>
  s.domain ? `https://www.google.com/s2/favicons?sz=128&domain=${s.domain}` : ""

export const stockByCode = (code: string) => CATALOG.find((s) => s.code === code)
