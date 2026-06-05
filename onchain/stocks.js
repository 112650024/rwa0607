/* 精選「可交易」台股清單:deploy.js 會為每檔部署一個 StockToken。
 * 其餘全市場台股仍由預言機餵價(前端可顯示報價,但未部署者僅供報價)。
 * tokenSymbol 前綴 d = digitized。 */
module.exports = [
  { code: "2330", name: "Digitized TSMC",     tokenSymbol: "dTSMC" },
  { code: "2317", name: "Digitized Hon Hai",  tokenSymbol: "dHHPG" },
  { code: "2454", name: "Digitized MediaTek", tokenSymbol: "dMTK"  },
  { code: "2308", name: "Digitized Delta",    tokenSymbol: "dDLT"  },
  { code: "2303", name: "Digitized UMC",      tokenSymbol: "dUMC"  },
  { code: "2412", name: "Digitized Chunghwa", tokenSymbol: "dCHT"  },
  { code: "2882", name: "Digitized Cathay FH",tokenSymbol: "dCAT"  },
  { code: "2881", name: "Digitized Fubon FH", tokenSymbol: "dFBN"  },
  { code: "2603", name: "Digitized Evergreen",tokenSymbol: "dEVG"  },
  { code: "3008", name: "Digitized Largan",   tokenSymbol: "dLAR"  },
  { code: "0050", name: "Digitized Yuanta50", tokenSymbol: "d0050" },
  { code: "2891", name: "Digitized CTBC FH",  tokenSymbol: "dCTBC" },
];
