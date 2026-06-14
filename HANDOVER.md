# FormosaX — 台股 RWA 代幣化平台 ｜ 交接文件 (Handover)

> 最後更新:2026-06-10
> 撰寫對象:接手的下一位開發者。本文件假設你會 Solidity / React / 基本以太坊知識,但**對本專案一無所知**,因此盡量寫白。
>
> ⚠️ **2026-06-14 更新**:餵價已升級為 **TWSE 即時成交價**(非每日收盤),前端也有多項改進(走勢線即時、IPO 美元計價、多來源 logo、交易上鏈動畫)。**最新狀態與待辦請先看根目錄 [README.md](./README.md)**。本檔 §5.3(餵價改每 60 秒即時)、§6 與 §8#1(價格已可盤中即時)等段落已部分被取代,以 README.md 為準。

---

## 0. 一分鐘看懂這個專案

FormosaX 是一個跑在 **以太坊 Sepolia 測試網** 的「**台股 RWA(真實世界資產)代幣化平台**」。核心:
- 用平台自己的 **TWD 穩定幣** 一鍵兌換**台股代幣**(每檔台股 1:1 對應一個 ERC-20),24/7、可碎片化。
- 價格來自**預言機**(鏈下從 TWSE 餵真實收盤價上鏈)。
- 額外做了完整 DeFi:**質押借貸、IPO 新股認購、受監管穩定幣(對標金管會)、Uniswap 二級市場**。
- 前端是一個 React DApp,已部署上線。

**這是課程專題作品(非真實金融商品),全部在測試網。**

### 線上資源
| 項目 | 連結 / 值 |
|---|---|
| 線上 DApp | https://rwa0607.vercel.app |
| GitHub repo | https://github.com/112650024/rwa0607 |
| Vercel 專案 | `112650024s-projects/rwa0607`(Root Directory = `frontend`) |
| 區塊鏈 | Ethereum **Sepolia**(chainId 11155111) |
| 區塊瀏覽器 | https://sepolia.etherscan.io |
| 部署/管理錢包 | `0x50d9e8471181fc563C944519d1A7a8AAf4208737`(burner,私鑰在 `onchain/.env`) |

---

## 1. 技術棧

**鏈上 (`onchain/`)**
- Hardhat 2 · Solidity 0.8.24 · OpenZeppelin 5(ERC20 / AccessControl / Pausable / Ownable)
- ethers v6 · axios(抓 TWSE)· dotenv

**前端 (`frontend/`)**
- React 19 · Vite 8 · TypeScript 6 · Tailwind CSS v4 · **shadcn/ui**
- 錢包:**wagmi v2 + viem + RainbowKit 2 + @tanstack/react-query**
- 動畫:framer-motion(換頁淡入、Dashboard 進場)
- 圖示:lucide-react
- 後端函式:Vercel Serverless(`frontend/api/twse.js`,代抓 TWSE 避 CORS)

> ⚠️ 有裝但**目前沒用到**的套件:`@antv/g2`、`gsap`(原本規劃做進階圖表/捲動動畫,沒做完)。可移除或拿來擴充。

---

## 2. 目錄結構

```
rwa0607/
├── HANDOVER.md            ← 本文件
├── .gitignore             ← 排除 node_modules / .env / artifacts / dist
├── onchain/               ← 智能合約 (Hardhat 專案)
│   ├── contracts/
│   │   ├── RegulatedTWD.sol     受監管 TWD 穩定幣
│   │   ├── PriceOracle.sol      價格預言機 (Chainlink 風格)
│   │   ├── StockFactory.sol     台股代幣工廠
│   │   ├── StockToken.sol       單一台股代幣 (ERC-20)
│   │   ├── LendingPool.sol      質押借貸池
│   │   ├── StockIPO.sol         IPO 新股認購
│   │   └── MockTWD.sol          (舊版穩定幣,已被 RegulatedTWD 取代,留著沒用)
│   ├── scripts/
│   │   ├── deploy.js            一鍵部署全部 + 餵價 + 建股 + 種流動性 + 開 IPO + 寫 deployed.json
│   │   ├── feeder.js            鏈下餵價(每 10 分鐘抓 TWSE 推上預言機)
│   │   ├── verify.js            Etherscan 原始碼驗證
│   │   └── uniswap_pool.js      建立 Uniswap v3 池 + 灌流動性(部署後跑一次)
│   ├── test/
│   │   ├── rwa.test.js          v1 合約測試(9 項)
│   │   └── v2.test.js           v2 合約測試(7 項:穩定幣/借貸/IPO)
│   ├── stocks.js               精選 12 檔台股清單
│   ├── hardhat.config.js
│   ├── .env                    🔒 機密(私鑰等),已 gitignore,不在 repo
│   ├── 餵價.bat                雙擊即持續餵價(純英文內容)
│   └── deployed.json           部署結果(位址 + ABI),本地副本
└── frontend/                  ← React DApp
    ├── api/twse.js            Vercel 後端函式:代抓 TWSE 日報(避 CORS)
    ├── vercel.json            SPA rewrite(排除 /api)
    ├── components.json        shadcn 設定
    ├── src/
    │   ├── main.tsx           Providers: Wagmi / QueryClient / RainbowKit / Router
    │   ├── App.tsx            路由(6 頁)
    │   ├── index.css          設計系統(主題色、字體、背景)
    │   ├── deployed.json      ★ 合約位址 + ABI(由 deploy.js / uniswap_pool.js 自動寫入)
    │   ├── components/
    │   │   ├── Layout.tsx     側欄 + 頂列 + 導覽 + 錢包卡 + 領TWD
    │   │   ├── Logo.tsx StockLogo.tsx Sparkline.tsx MarketTicker.tsx PageHeader.tsx
    │   │   └── ui/            shadcn 元件(button/card/dialog/...)
    │   ├── hooks/
    │   │   ├── useChain.ts    usePrices(行情) / useTwdBalance / useFaucet
    │   │   ├── useTx.ts       送交易 + toast + Etherscan 連結
    │   │   ├── useUniswap.ts  Uniswap 池價 / ABI
    │   │   ├── useTwse.ts     抓 /api/twse
    │   │   └── useMarket.ts   (僅匯出 Market 型別,原 mock 已停用)
    │   ├── lib/
    │   │   ├── contracts.ts   ★ 讀 deployed.json,匯出各合約位址/ABI、UNISWAP、sym32、Etherscan URL
    │   │   ├── wagmi.ts       wagmi 設定(Sepolia)
    │   │   ├── wallet.tsx     useWallet(包 wagmi)
    │   │   ├── catalog.ts     12 檔台股顯示資料(中文名/logo/品牌色)
    │   │   ├── format.ts      數字格式化
    │   │   └── utils.ts       cn()
    │   └── routes/
    │       ├── Dashboard.tsx  總覽(Hero + 指標 + 跑馬燈 + 市場)
    │       ├── Trade.tsx      買賣台股(預言機價 mint/redeem)
    │       ├── Swap.tsx       Uniswap 二級市場交換
    │       ├── Lending.tsx    質押借貸(存/取/借/還)
    │       ├── IPO.tsx        新股認購(前端品牌化為 SpaceX)
    │       └── Stablecoin.tsx 受監管穩定幣(儲備證明/揭露/贖回)
    ├── package.json
    └── (vite/tsconfig 等設定)
```

---

## 3. 已部署的合約(Sepolia · 皆 Etherscan 已驗證 ✅)

> 這些位址也存在 `frontend/src/deployed.json` 與 `onchain/deployed.json`。**重新部署會全部換掉**(見 §7)。

| 合約 | 位址 |
|---|---|
| RegulatedTWD(TWD 穩定幣) | `0x0ec97A83E96C7e61b4eDD6FB5Bf33ddEaF63df67` |
| PriceOracle(預言機) | `0xF1198ab9A92E21E60bB90003eDEC0887aecf2871` |
| StockFactory(工廠) | `0xF262C1BFe36c5F458e1A178fD7D71C5C43AB8c44` |
| LendingPool(借貸) | `0xBebab317ec999ced702dE87C654868a9ede9ab82` |
| StockIPO(認購) | `0x925BE0f709e4c9b38578142E9B94AFbb71aBB990` |
| Uniswap v3 Pool(dTSMC/TWD, 0.3%) | `0xe69aF036F8290Ed0371f79dE8E1060211e9f5353` |

**12 檔台股代幣(StockToken):**

| 代號 | 符號 | 代幣位址 |
|---|---|---|
| 2330 台積電 | dTSMC | `0x1CB2Ea6f8eB47c24387B015C75D9d1dad800dc53` |
| 2317 鴻海 | dHHPG | `0x11ACeC6F4DeA546946Ae51F5b0bcc007D606a244` |
| 2454 聯發科 | dMTK | `0x8CA1c8EE36D85d15bA782fB647C0acD486fe282B` |
| 2308 台達電 | dDLT | `0x4971f44f9B78ee58d0937A77c6093a41D3B5c13d` |
| 2303 聯電 | dUMC | `0xFa2513Ae61a705D33B4c4A4ACbdfb8D0EbA0d567` |
| 2412 中華電 | dCHT | `0xc65AE0ab15e9CC1CbA12eC99fFed241E82EEb9E2` |
| 2882 國泰金 | dCAT | `0xF7F47D514D24728Ea750BcDF3f26926F1bE549B7` |
| 2881 富邦金 | dFBN | `0xdfD81e40f0aa2eDc8c3e9BBfcfebea61ceEFE1df` |
| 2603 長榮 | dEVG | `0x50705242ef00E1c9EA99652e0c3ecf5Ab878DAa8` |
| 3008 大立光 | dLAR | `0x48aA7B3507B272a5C28C9Bb3938290d6872d45Bc` |
| 0050 元大台灣50 | d0050 | `0x3A533Bd5E69aeC180029225d58011Ba599ef42f0` |
| 2891 中信金 | dCTBC | `0x4CF9C310A725ED8138f6eA5674C1Eb72bf3E8BF5` |

**Uniswap v3 基礎合約(Sepolia 官方,不需自己部署):**
- Factory `0x0227628f3F023bb0B980b67D528571c95c6DaC1c`
- NonfungiblePositionManager `0x1238536071E1c677A632429e3655c799b22cDA52`
- SwapRouter02 `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E`
- QuoterV2 `0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3`

---

## 4. 合約功能說明(接手必讀)

### 4.1 RegulatedTWD(受監管穩定幣,6 位小數)
對標金管會《穩定幣專法》精神。
- **角色(AccessControl)**:`DEFAULT_ADMIN_ROLE`(發行人)、`ATTESTOR_ROLE`(儲備簽證)、`COMPLIANCE_ROLE`(凍結/暫停)。部署者一人擁有全部。
- **儲備證明**:`reserveAttestedTWD`、`reserveRatioBps()`(10000 = 100%)、`attestReserves(amount, docHash)`、`lastAttestationAt`。
- **水龍頭**:`mintTWD(twdWhole)` 任何人可領,領取時自動同步儲備(維持 100%)。
- **贖回**:`requestRedemption(amount)` 燒幣 + 降低儲備。
- **監管**:`setFrozen(addr,bool)`、`pause()/unpause()`;`_update` 覆寫 → 凍結地址/暫停時擋轉帳。
- **揭露**:`issuerName/licenseNo/custodianBank/auditReportURI/termsURI`(public,可在 Etherscan 查)。

### 4.2 PriceOracle(預言機)
- 可信餵價者模式(Chainlink AggregatorV3 風格)。
- `updatePrices(bytes32[] symbols, int256[] prices, uint8 decimals)` 限 `feeders`(部署者)。
- `latestPrice(bytes32 symbol)` → (price, decimals, updatedAt)。symbol = 股票代號的 bytes32(例 "2330")。

### 4.3 StockFactory(工廠)
- `createStock(bytes32 symbol, name, tokenSymbol)`(onlyOwner)→ 部署一個 StockToken,共用同一 TWD + Oracle。
- `getAllStocks()`、`tokenOf(bytes32)`、`stockCount()`。

### 4.4 StockToken(單一台股代幣,18 位小數)
- `mint(twdAmount)`:先 `transferFrom` TWD,依**預言機即時價**鑄造代幣(含 30 天過期價檢查 `maxPriceAge`)。
- `redeem(tokenAmount)`:反向贖回 TWD。
- `pricePerShare()`(TWD-6/股)、`previewMint/previewRedeem`、`getReserveStatus()`、`getCollateralRatio()`。
- 監管:`blacklisted`、`kycVerified`、`pause/unpause`(owner = 部署者)。

### 4.5 LendingPool(借貸,對標 Aave 迷你版)
- 出借:`depositTWD` / `withdrawTWD`(份額制,賺利息)。
- 抵押:`supplyCollateral(token, amount)` / `withdrawCollateral(token, amount)`。
- 借款:`borrowTWD(amount)` / `repay(amount)`。
- 清算:`liquidate(user, token, repayAmount)`(健康因子 < 1 才可)。
- 風險參數:`ltvBps = 5000`(50%)、`liqThresholdBps = 6500`(65%)、`liqBonusBps = 500`。
- 利率:使用率模型,利息以 `borrowIndex` 累積。
- 前端讀:`getUserAccount(user)` → (抵押價值, 已借, 可借, 健康因子bps);`getPoolStats()`;`getUserDeposit(user)`;`userCollateral(user, token)`。

### 4.6 StockIPO(新股認購,庫存模式)
- `createOffering(token, priceTWD, totalShares, start, end)`:發行人需先把代幣庫存 approve 給本合約。
- `subscribe(id, twdAmount)`:認購窗口內收 TWD。
- 結束後 `claim(id)`:超額採 **pro-rata 配額** + 退還溢繳款。
- 前端讀:`getOffering(id)`、`userPosition(id, user)`、`offeringCount()`。
- **目前狀態**:部署時開了 1 檔 offering(id = 0),標的是 **d0050**,但**前端把它顯示成「SpaceX」**(品牌化,見 §6 IPO 頁說明)。

---

## 5. 部署 / 維運(怎麼動它)

### 5.1 `onchain/.env`(🔒 機密,不在 repo)
```
SEPOLIA_RPC_URL=                # 留空用公開節點;要更穩可填 Alchemy/Infura
PRIVATE_KEY=0x....              # 部署/管理/餵價錢包私鑰(burner)
ORACLE_ADDRESS=0xF1198ab9...    # = PriceOracle 位址(餵價腳本用)
FEED_LIMIT=120                  # 餵價檔數上限
ETHERSCAN_API_KEY=....          # Etherscan 驗證用
```
> ⚠️ **私鑰只在這個檔**,接手時需要原作者私下提供(或自己換一把新 burner,見 §7 重部署)。

### 5.2 常用指令(在 `onchain/`)
```bash
npm install                    # 裝依賴
npx hardhat test               # 跑合約測試(應 16 項全綠)
npm run deploy:sepolia         # 部署全部 → 產生 deployed.json
npm run verify:sepolia         # Etherscan 驗證
node scripts/uniswap_pool.js   # 建 Uniswap 池(部署後跑一次)
```

### 5.3 餵價(讓股價保持最新)
- **雙擊 `onchain/餵價.bat`** → 每 10 分鐘抓 TWSE 收盤價推上預言機,當掉自動重啟,關視窗才停。
- 需要 `.env` 的 `PRIVATE_KEY` + `ORACLE_ADDRESS`,且錢包要有 Sepolia ETH 付 gas。
- **不開也能用**:`maxPriceAge = 30 天`,部署當下已餵一次,30 天內買賣/借貸照常。

### 5.4 前端部署
- 前端是 Vite SPA,Vercel 專案 Root Directory = `frontend`。
- **方法 A(自動)**:`git push` 到 rwa0607 → 若 Vercel 有連 GitHub 會自動部署。
- **方法 B(CLI)**:`cd frontend && npx vercel --prod --yes`(原作者用這個;需先 `npx vercel login`)。
- 本機開發:`cd frontend && npm install && npm run dev` → http://localhost:5173

---

## 6. 前端資料流(看懂 6 個頁面怎麼拿到鏈上資料)

- **合約存取**:`src/lib/contracts.ts` 讀 `deployed.json`,匯出 `TWD / ORACLE / FACTORY / LENDING / IPO / STOCK_ABI / STOCKS / UNISWAP`。**換合約只要換 deployed.json**。
- **行情**(`hooks/useChain.ts → usePrices`):價格讀**鏈上預言機**;漲跌% 與走勢線讀 **`/api/twse`**(真實 TWSE 開高低收)。
  - ⚠️ 台股免費資料是**日收盤**,所以**價格盤中不會跳動**(這是刻意的:精準優先;之前做過模擬跳動但會跟真實值對不上,已移除)。
- **送交易**(`hooks/useTx.ts`):統一 toast「送出 → 等確認 → 完成(附 Etherscan)」。所有 write 都走這個。
- **錢包**:`lib/wallet.tsx`(包 wagmi useAccount/RainbowKit modal)。
- 各頁:
  - **Dashboard**:Hero + 指標卡(數字目前部分為示意)+ 跑馬燈 + 市場格。
  - **Trade**:`StockToken.mint/redeem`,顯示 `getReserveStatus/getCollateralRatio`。
  - **Lending**:存/取 TWD、質押/取回台股、借/還 TWD(已做反向,含 `withdrawCollateral`)。
  - **IPO**:讀 `getOffering/userPosition`,`subscribe/claim`。**顯示為 SpaceX**(`IPO_BRAND` 對映,底層仍是 d0050 代幣)。
  - **Stablecoin**:讀 RegulatedTWD 的儲備/揭露,`requestRedemption`,附 Etherscan Read 連結。
  - **Swap**:Uniswap v3,`QuoterV2` 報價 + `SwapRouter02.exactInputSingle`,顯示池價 vs 預言機偏離 + 外部 Uniswap 連結。

---

## 7. 重新部署的完整流程(很重要)

合約**不可升級(無 Proxy)**。任何合約改動 → 必須**重新部署 → 位址全換 → 連帶更新前端與 Uniswap 池**。步驟:

1. 確認 `onchain/.env` 的 `PRIVATE_KEY` 對應錢包**有 Sepolia ETH**(沒有去公開水龍頭領)。
2. `cd onchain && npm run deploy:sepolia` → 會自動寫新 `deployed.json` 到 `onchain/` 與 `frontend/src/`。
3. 把輸出的 **PriceOracle 新位址**回填 `.env` 的 `ORACLE_ADDRESS`。
4. `node scripts/uniswap_pool.js` → 為新的 dTSMC 重建 Uniswap 池(舊池作廢)。
5. `npm run verify:sepolia` → Etherscan 驗證。
6. `cd ../frontend && npm run build` 確認可編譯 → `git push`(或 `npx vercel --prod`)。
7. (選)雙擊 `餵價.bat` 開始餵價。

> 換一把新 burner 錢包也是改 `.env` 的 `PRIVATE_KEY` 後重跑上面流程即可。

### 常見小修改
- **新增/移除可交易台股**:改 `onchain/stocks.js` + `frontend/src/lib/catalog.ts`(中文名/logo/色),再重部署(或單獨 `factory.createStock` + 餵價 + 手動更新 deployed.json)。
- **改 IPO 標的/品牌**:`StockIPO` 開新 offering(`createOffering`),前端 `routes/IPO.tsx` 的 `IPO_BRAND` 改顯示名稱/logo。
- **改利率/LTV**:`LendingPool.setRiskParams(...)`(onlyOwner)。

---

## 8. ⚠️ 已知問題 / 待改善(交接重點 TODO)

**功能性 / 真實度**
1. **股價只有日收盤、盤中不跳動**:免費 TWSE 資料限制。要真盤中即時 → 接付費行情源,或用 **Chainlink Functions** 去中心化餵價。
2. **IPO 的「SpaceX」是前端品牌化**,底層代幣其實是 `d0050`。認購 claim 領到的是 d0050。若要名實相符 → 部署一顆真的 `dSPACEX` 代幣 + 開新 offering。
3. **Uniswap 池流動性很薄**(約 200 股 dTSMC + ~47 萬 TWD)→ 大額 swap 滑價嚴重。Demo 用小額;要更順 → 灌更多流動性(改 `uniswap_pool.js` 的數量再跑,或手動加倉)。
4. **預言機價 與 Uniswap 池價會分歧**(兩者獨立)→ 目前靠人工/套利,沒有 keeper bot 自動再平衡。
5. **AI 估值/風險模型(題目七)只在報告/簡報,程式沒實作**。Roadmap:鏈下回歸模型 → Chainlink Functions 把公允價/風險分數上鏈,動態調 LTV。

**工程 / 體驗**
6. **WalletConnect 用佔位 projectId**(`formosax_demo_projectid`)→ 手機掃碼登入無法用,只有 MetaMask(injected)可用。修法:到 cloud.walletconnect.com 申請,設 `frontend/.env` 的 `VITE_WC_PROJECT_ID`。
7. **Dashboard 指標卡部分數字是寫死示意**(鏈上資產總額/TVL 等)→ 可改成真的讀鏈上彙總。
8. **裝了沒用到的套件**:`@antv/g2`、`gsap`(原規劃做 AntV 進階圖表 + GSAP 捲動動畫,未完成)→ 可移除或補做(原計畫的 Portfolio 進階儀表板沒做)。
9. **沒有前端自動化測試**;只有合約測試(`npx hardhat test`)。
10. **單點控管**:部署者一個錢包(`0x50d9…`)同時是 owner/admin/feeder。正式化應拆角色 + 多簽 + 時間鎖。
11. **合約不可升級**:改邏輯就得重部署換位址(見 §7)。要可升級 → 改 UUPS Proxy。
12. **借貸利率/清算模型偏簡化**;清算只有合約函式,沒有自動清算機器人。

---

## 9. 安全須知(交接務必交代)
- `onchain/.env` 內含**私鑰**與 Etherscan key,**已 gitignore,不可進版控**。
- 部署錢包 `0x50d9…8737` 是 **burner(測試網專用)**,只放 Sepolia 測試 ETH;**絕不可拿去主網或放真錢**。
- 這把錢包是所有合約的 owner/admin/feeder,**握有它=能凍結/暫停/餵價/開IPO**。接手請妥善保管或換新 burner 重部署。
- 前端推上 Vercel/GitHub 的內容**不含任何私鑰**(只有公開位址 + ABI)。

---

## 10. 報告 / 簡報檔案位置(非程式,但一起交接)
都在 **`C:\Users\lab643\Desktop\rwa report\`**:
- `FormosaX_RWA_Deck.html` — 漂亮 HTML 簡報(可瀏覽器播放、Ctrl+P 轉 PDF)
- `FormosaX_RWA_Deck.pptx` — 可編輯 PowerPoint(17 頁)
- `FormosaX_RWA_Report.md` — 完整內容報告
- `FormosaX_8min_講稿.md` — 8 分鐘上台逐字稿
- `FormosaX_3Canvas_補充.pptx` — Tokenomics / Use Case / Smart Contract Role Map 三張 Canvas
- `make_pptx.py` / `make_canvas_slides.py` — 上面 PPTX 的產生腳本(Python + python-pptx)

> ⚠️ 班級用的那份原始 deck(`Desktop\RWA 0607 (1).pdf`)是另外用簡報工具做的,**不是上面這些檔生出來的**;若要改那份要回原工具改。

---

## 11. 快速上手檢查清單(新人第一天)
1. `git clone https://github.com/112650024/rwa0607.git`
2. 跟原作者要 `onchain/.env`(或自己建一把新 burner + 領 Sepolia ETH + 照 §7 重部署)。
3. `cd frontend && npm install && npm run dev` → 開 http://localhost:5173,連 MetaMask(Sepolia)。
4. `cd onchain && npm install && npx hardhat test` → 確認 16 項測試全綠。
5. 想改合約 → 先讀 §4、§7;想改前端 → 先讀 §6。
6. 要 demo → 雙擊 `onchain/餵價.bat` 讓價格最新;讀 §8 已知問題避免踩雷。

---

有問題先看本檔的 §6(前端)與 §7(重部署),九成的「怎麼動它」都在裡面。祝接手順利 🚀
