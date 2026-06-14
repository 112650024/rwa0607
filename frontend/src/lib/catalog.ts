/** 台股目錄(顯示用)。 */
export type Stock = {
  code: string
  name: string
  symbol: string // 代幣符號 dXXXX
  fallback: number // 示意價
  tint: string // 品牌漸層(文字徽記底色)
  domain?: string // 公司網域(參考)
  logo?: string // 已「實測可用」的 logo 圖 URL;沒有就用品牌色文字徽記
}

// 已於 2026-06-14 用 curl + 目視確認「真的抓得到 logo」的來源:
//   Google favicon → 台積電/鴻海/聯發科/台達電/聯電;icon.horse → 0050。
//   其餘 6 檔(金融/航運)各服務皆無 logo → 不設 logo,改用品牌色徽記(避免地球/空殼)。
const gfav = (d: string) => `https://www.google.com/s2/favicons?sz=128&domain=${d}`

export const CATALOG: Stock[] = [
  { code: "2330", name: "台積電", symbol: "dTSMC", fallback: 2355, tint: "#e4002b,#8c0019", domain: "tsmc.com", logo: gfav("tsmc.com") },
  { code: "2317", name: "鴻海", symbol: "dHHPG", fallback: 205, tint: "#0a4ea2,#062f63", domain: "foxconn.com", logo: gfav("foxconn.com") },
  { code: "2454", name: "聯發科", symbol: "dMTK", fallback: 1280, tint: "#ff7a00,#b35400", domain: "mediatek.com", logo: gfav("mediatek.com") },
  { code: "2308", name: "台達電", symbol: "dDLT", fallback: 402, tint: "#0072ce,#004a87", domain: "deltaww.com", logo: gfav("deltaww.com") },
  { code: "2303", name: "聯電", symbol: "dUMC", fallback: 54, tint: "#00a3a3,#006060", domain: "umc.com", logo: gfav("umc.com") },
  { code: "2412", name: "中華電", symbol: "dCHT", fallback: 126, tint: "#00857c,#004f49", domain: "cht.com.tw" },
  { code: "2882", name: "國泰金", symbol: "dCAT", fallback: 66, tint: "#0c8a3e,#064d22", domain: "cathayholdings.com.tw" },
  { code: "2881", name: "富邦金", symbol: "dFBN", fallback: 92, tint: "#5aa800,#356200", domain: "fubon.com" },
  { code: "2603", name: "長榮", symbol: "dEVG", fallback: 195, tint: "#0a7a3f,#054d27", domain: "evergreen-marine.com" },
  { code: "3008", name: "大立光", symbol: "dLAR", fallback: 2520, tint: "#5b6bff,#2f3aa8", domain: "largan.com.tw" },
  { code: "0050", name: "元大台灣50", symbol: "d0050", fallback: 190, tint: "#e2231a,#8f140e", domain: "yuantaetfs.com", logo: "https://icon.horse/icon/yuantaetfs.com" },
  { code: "2891", name: "中信金", symbol: "dCTBC", fallback: 39, tint: "#0033a0,#001f63", domain: "ctbcbank.com" },
]

/** logo 候選:只用「已實測可用」的圖;沒有則回空 → StockLogo 顯示品牌色文字徽記(不會有地球/空殼)。 */
export const logoCandidates = (s: Stock): string[] => (s.logo ? [s.logo] : [])

export const stockByCode = (code: string) => CATALOG.find((s) => s.code === code)
