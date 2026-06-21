# CLAUDE.md — FormosaX 台股 RWA 代幣化平台

給 Claude Code 的專案指南。先讀這份就能掌握全貌;細節見 `README.md`(最新狀態+待辦)、`HANDOVER.md`(完整架構)、`docs/`(簡報/QA)。

## 這是什麼
跑在 **Ethereum Sepolia 測試網** 的「台股 RWA(真實世界資產)代幣化平台」。用平台自有 **TWD 穩定幣**,依**預言機即時價**鑄造/贖回台股代幣(每檔台股 = 一個 ERC-20),並做了完整 DeFi:質押借貸、IPO 認購、Uniswap 二級市場、受監管穩定幣(對標金管會)、投資組合、AI 估值/風險引擎、自動清算 keeper。**課程專題、非真實金融商品、全在測試網。**

- 線上 DApp:https://rwa0607.vercel.app ｜ 區塊瀏覽器:https://sepolia.etherscan.io
- 部署/管理錢包(burner):`0x50d9e8471181fc563C944519d1A7a8AAf4208737`

## 技術棧
- **onchain/**:Hardhat 2 · Solidity 0.8.24 · OpenZeppelin 5 · ethers v6 · axios(抓 TWSE)
- **frontend/**:React 19 · Vite · TypeScript · Tailwind v4 · shadcn/ui · wagmi v2 + viem + RainbowKit · framer-motion;serverless 在 `frontend/api/*.js`(Vercel)

## 目錄(monorepo,兩個獨立 npm 專案)
```
onchain/    合約 + 腳本(各自 npm install)
  contracts/  RegulatedTWD(穩定幣) PriceOracle StockFactory StockToken LendingPool StockIPO
  scripts/    deploy.js · feeder.js(餵價) · keeper.js(自動清算) · verify.js · uniswap_pool.js
  stocks.js   精選 12 檔台股清單
  deployed.json  部署結果(位址+ABI)
frontend/
  api/        twse.js(行情) history.js(走勢) valuation.js(AI 評語,呼叫 Claude)
  src/
    deployed.json   ★ 前端讀這個拿合約位址+ABI(deploy 時自動寫入)
    lib/      contracts.ts(讀 deployed.json) risk.ts(量化風險引擎) costBasis.ts(損益)
    hooks/    useChain.ts(usePrices/useHoldings/useProtocolStats) useTwse.ts useActivity.ts useTx.ts
    routes/   Dashboard Trade Swap Lending IPO Stablecoin Portfolio Risk
docs/         FormosaX_專題_合約原理_Demo_QA.md(Demo+QA) + report/(簡報/報告/講稿)
```

## 常用指令
```bash
# 前端(免金鑰即可跑)
cd frontend && npm install && npm run dev        # http://localhost:5173
cd frontend && npm run build                     # tsc -b && vite build(改完務必跑,確認綠燈)

# 合約(需 onchain/.env)
cd onchain && npm install && npx hardhat test    # 16 項測試
cd onchain && npm run deploy:sepolia             # 部署全部 → 寫 deployed.json
cd onchain && npm run feed:sepolia               # 餵 TWSE 即時價上鏈(demo 盤中要開)
cd onchain && npm run keeper:sepolia             # 自動清算機器人
```

## 關鍵架構與資料流
- **價格**:鏈下 `feeder.js` 抓 **TWSE MIS 即時成交價**(z 為「-」時用最佳買賣價中間價)→ 寫入 `PriceOracle`(Chainlink AggregatorV3 風格)→ 每 60 秒。`StockToken.mint/redeem` 依 `pricePerShare()`(讀預言機)定價,含 30 天過期保護。**故意沒用 Chainlink**:台股無 feed + Chainlink Functions 測試網已 sunset。
- **前端取價**:`usePrices()`(useChain.ts)價格讀**鏈上預言機**;漲跌% 以鏈上價對昨收推算;走勢線用 `/api/history`(TWSE STOCK_DAY 真實收盤)+ 鏈上即時價尾端。
- **買入是 2 步**:`TWD.approve(StockToken 合約, 金額)` → `StockToken.mint()`;賣出 `redeem()` 不需授權。
- **AI**:`src/lib/risk.ts` 用真實收盤算波動/動能/風險分數/建議 LTV(純函式、決定性);`api/valuation.js` 呼叫 **Claude `claude-haiku-4-5`** 生一句評語(需 Vercel 環境變數 `ANTHROPIC_API_KEY`,未設則優雅降級只顯示量化分數)。
- **換合約只要換 `deployed.json`**:`frontend/src/lib/contracts.ts` 從 `frontend/src/deployed.json` 讀所有位址/ABI。

## ⚠️ 重要慣例 / 地雷
- **`onchain/.env` 含私鑰,絕不進版控**(`.gitignore` 已排除);換機器要自己重建(見 `START_HERE.md` / `.env.example`)。
- **合約不可升級**(無 Proxy):改任何合約邏輯 → 必須**重新部署 → 位址全換 → 更新 deployed.json → 重建 Uniswap 池**(流程見 `HANDOVER.md §7`)。
- 註解與 UI 文案是**繁體中文**;沿用既有風格。
- `frontend/api/*.js` 是 **zero-dependency 的 Vercel serverless**(用全域 `fetch`,不裝 SDK)——新增請沿用此模式。
- 部署:Vercel 專案 `rwa0607`(Root Directory = `frontend`)。`git push` 連動自動部署,或 `cd frontend && npx vercel --prod`。
- 風險參數:LendingPool `LTV 50% / 清算門檻 65% / 清算獎勵 5%`。

## 驗證一個改動
前端改動 → `cd frontend && npm run build` 綠燈 → `npm run dev` 眼睛確認 →(要上線)`git push` 或 `vercel --prod`。合約改動 → `npx hardhat test` → 走重部署流程。
