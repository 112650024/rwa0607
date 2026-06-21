# FormosaX — 台股 RWA 代幣化平台(完整作品包)

> 這是整個作品的**單一彙整資料夾**:**程式(含 AI 風險模型)＋ 文件 ＋ 簡報/報告**。整包複製到別台電腦就能跑(也可日後推上 GitHub)。
>
> - 線上 DApp:https://rwa0607.vercel.app
> - 區塊鏈:Ethereum **Sepolia** 測試網 ｜ 區塊瀏覽器:https://sepolia.etherscan.io
> - 詳細文件:根目錄 `README.md`、`HANDOVER.md`;簡報/QA 在 `docs/`。

---

## 📁 資料夾結構
```
FormosaX-RWA/
├── START_HERE.md          ← 你正在看的(新電腦從這裡開始)
├── README.md              ← 最新狀態 + 待辦
├── HANDOVER.md            ← 完整架構 / 合約 / 重部署流程
├── onchain/               ← 智能合約(Hardhat)+ feeder + keeper
│   ├── contracts/         RegulatedTWD / PriceOracle / StockFactory / StockToken / LendingPool / StockIPO
│   ├── scripts/           deploy.js · feeder.js(餵價)· keeper.js(自動清算)· verify.js · uniswap_pool.js
│   ├── deployed.json      已部署的位址 + ABI(公開,非機密)
│   └── .env.example       ← 複製成 .env 填入私鑰等(.env 不進版控)
├── frontend/              ← React DApp(Vite)
│   ├── api/               Vercel serverless:twse.js / history.js / valuation.js(AI 評語)
│   └── src/               頁面:Dashboard/Trade/Swap/Lending/IPO/Stablecoin/Portfolio/Risk
│       └── deployed.json  ★ 前端讀這個拿合約位址 + ABI
└── docs/
    ├── FormosaX_專題_合約原理_Demo_QA.md   ← 上台 Demo 帶看 + QA 速查
    └── report/            簡報(Deck/pptx)、報告、8分鐘講稿、產生腳本
```

---

## 🚀 新電腦快速上手

### 0) 前置:Node.js 18+、Git、MetaMask(瀏覽器)
### 1) 把程式放到新電腦(兩種方式,擇一)
- **直接複製整個 `FormosaX-RWA` 資料夾**(USB / 雲端硬碟 / 網路共享皆可)。本資料夾不含 `node_modules`,只有 ~30MB,複製很快;到新電腦後 `npm install` 會重建依賴。
- 或用現有 GitHub repo:`git clone https://github.com/112650024/rwa0607`(注意:這個 repo **不含** `docs/` 的簡報與 QA;那些只在這個彙整資料夾裡)。
### 2) 前端跑起來(本機預覽)
```bash
cd frontend
npm install
npm run dev          # 開 http://localhost:5173
```
> 前端**不需要任何金鑰**就能跑(合約位址/ABI 已在 `frontend/src/deployed.json`)。連 MetaMask(切到 Sepolia)即可操作。

### 3) 合約端(要部署/餵價/清算才需要)
```bash
cd onchain
npm install
npx hardhat test            # 16 項測試應全綠
cp .env.example .env        # 然後編輯 .env 填入下面的值
```

---

## 🔑 機密設定(`onchain/.env`,**不在版控內**,換電腦要自己建)
複製 `onchain/.env.example` → `onchain/.env`,填入:
| 變數 | 說明 |
|---|---|
| `PRIVATE_KEY` | 部署/餵價/清算錢包私鑰(**burner** `0x50d9e8471181fc563C944519d1A7a8AAf4208737`)。私鑰**不在這個 repo**,要從舊電腦的 `.env` 複製,或換一把新 burner(換新的話需照 HANDOVER §7 重部署)。 |
| `ORACLE_ADDRESS` | `0xF1198ab9A92E21E60bB90003eDEC0887aecf2871`(現有 PriceOracle) |
| `SEPOLIA_RPC_URL` | 可留空用公開節點;要更穩填 Alchemy/Infura |
| `FEED_INTERVAL_MS` | 餵價間隔毫秒,預設 60000 |
> ⚠️ 錢包要有 **Sepolia 測試 ETH** 付 gas(公開水龍頭領)。

---

## ▶️ Demo 當天要跑的(盤中 平日 09:00–13:30)
```bash
# 餵即時股價上鏈(視窗開著)
cd onchain && npm run feed:sepolia

# (選配)自動清算機器人:監控健康因子,<1.0 自動清算
cd onchain && npm run keeper:sepolia
```
看到「台積電(2330) = …(即時)+ tx hash」就是有餵上鏈;網站 1–2 分鐘內價格更新。

---

## ☁️ Vercel 部署(換 repo 不影響!)
Vercel 的「**專案**」(網域 `rwa0607.vercel.app`、環境變數)是獨立的,**沒有跟某個 GitHub repo 綁死**。換新 repo 後二選一:
- **A. 後台重連**:Vercel → 專案 `rwa0607` → Settings → Git → 斷開舊 repo、連上新 repo。網域/環境變數全保留,之後 `git push` 自動部署。
- **B. CLI 部署**(不靠 GitHub):新電腦 `npm i -g vercel`(或 `npx vercel`)→ `cd frontend` → `vercel login` → `vercel --prod`。第一次會問要不要連到現有的 `rwa0607` 專案,選它即可。

### AI 估值評語(`/risk` 頁的 ✨ 一句話評語)
需要在 **Vercel → Settings → Environment Variables** 設 **`ANTHROPIC_API_KEY`**(到 https://console.anthropic.com 申請)。**沒設也不會壞**——只是不顯示 AI 評語,量化風險分數照常。用的是 `claude-haiku-4-5`(便宜快),伺服器端快取 1 小時。

---

## 🧩 八大功能一覽(都已上線)
代幣化台股交易(預言機鑄/贖)· 受監管 TWD 穩定幣(對標金管會)· 質押借貸 · IPO 認購 · Uniswap 二級市場 · **投資組合(總資產/配置圖/損益/鏈上活動)** · **AI 估值 + 風險引擎(題目七)** · **自動清算 keeper**。

## ⚠️ 安全須知
- `onchain/.env`(含私鑰)**永遠不要進版控**(`.gitignore` 已排除)。
- 部署錢包是 **burner、僅測試網**,絕不可放真錢 / 上主網。
- 這是課程 Demo,全部在測試網,非真實金融商品。

---
有不清楚的:程式架構看 `HANDOVER.md`;上台 Demo 與 QA 看 `docs/FormosaX_專題_合約原理_Demo_QA.md`。
