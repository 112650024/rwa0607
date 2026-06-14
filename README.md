# RWA0607 (FormosaX) — 現在狀態與待完成清單

> 最後更新:**2026-06-14**｜本檔 = 「最新狀態 + 待辦清單」(停電/重開機後**從這裡接續**)。
> 完整專案架構、合約位址、重部署流程見 **[HANDOVER.md](./HANDOVER.md)**(其餵價/前端段落部分已被本次更新取代,**以本檔為準**)。

## ⚡ 一句話
台股 RWA demo(Ethereum **Sepolia** + Vercel）。本次把股價來源從「每日收盤」升級成 **TWSE 即時成交價**,並改進前端(走勢線即時、IPO 美元計價、logo、鏈上驗證動畫)。

- 線上 DApp:https://rwa0607.vercel.app
- GitHub:https://github.com/112650024/rwa0607
- PriceOracle:`0xF1198ab9A92E21E60bB90003eDEC0887aecf2871`

---

## ✅ 本次(2026-06-14)完成了什麼

1. **評估並放棄 Chainlink Functions** — 測試網已於 **2026-06-02 sunset**,新訂閱無法建立(官方改推 CRE,對 demo 太重)。相關檔案已刪、npm 套件已移除。台股本來就沒有 Chainlink 價格 feed,維持自建預言機 + feeder 是正解。
2. **feeder 升級為「即時成交價」**(`onchain/scripts/feeder.js`):改用 **TWSE MIS 即時 API** 抓成交價 `z`,MIS 失敗自動退回每日收盤;預設每 **60 秒**餵一次。已實測 12 檔全到、已實際餵上鏈(台積電 2310)。
3. **前端 4 項(已 build 綠燈)**:
   - **漲跌%/走勢線改即時**:`frontend/api/twse.js` 改抓 MIS(開高低收 + 即時漲跌);走勢線改畫「**當日開盤→收盤**」;另加 **Vite dev 外掛**讓 `/api/twse` 在 `npm run dev` 本機也能跑(以前本機是平線就是因為 serverless 函式不會在 dev 啟動)。
   - **IPO「SpaceX」改美元計價**:顯示 `US$ 135 ≈ NT$ 4,388 / 股`(匯率常數 `USD_TWD` 在 `frontend/src/routes/IPO.tsx` 可調)。
   - **Logo 不再是地球**:多來源抓取 Clearbit → DuckDuckGo → 網站 favicon,全失敗才用品牌色文字徽記;移除了「查無 logo 會回傳地球圖」的 Google favicon。
   - **鏈上驗證動畫**:新 `frontend/src/components/TxOverlay.tsx`(framer-motion)—— 串接區塊脈動 + 三步驟進度(簽署→驗證→上鏈)+ 成功打勾繪製 + Etherscan 連結,取代原本的轉圈圈 toast。
4. **Dashboard 指標卡改真實鏈上讀取**:4 張指標卡(鏈上資產總額/TWD 儲備率/借貸池 TVL/IPO 案數)不再寫死,改 `useProtocolStats()` 一次 multicall 真讀鏈上(`useChain.ts`、`Dashboard.tsx`)。IPO 卡因已結束,改顯示「累計認購案數」。
5. **漲跌%/走勢線改鏈上推算**:終點改以**鏈上預言機價**為當前值,`/api/twse` 只當昨收/開高低基準(後備走 openapi 每日收盤,非 MIS、不限 IP)→ 線上 MIS 被擋也不再平線,顯示價與漲跌% 內部一致(原 TODO-2 已完成)。

---

## 🔴 待完成清單(TODO — 依優先序)

1. **【最優先】確認這次前端已部署到 Vercel**
   到 https://rwa0607.vercel.app 檢查:走勢線有曲線、IPO 顯示美元、買入有新動畫、logo 不是地球。
   Vercel 若有連 GitHub 會自動部署;沒有的話 → `cd frontend && npx vercel --prod --yes`。

2. ~~**MIS 在 Vercel 線上版可能被擋**~~ ✅ **已解決(2026-06-14)**
   漲跌%/走勢線已改用**鏈上預言機價**推算,`/api/twse` 只當基準帶且後備走 openapi 每日收盤(非 MIS、不限 IP)。線上即使 MIS 被擋也不會變平線,無需再依賴 MIS。

3. **【Demo 當天必做】啟動 feeder 餵即時價**
   開**新**終端機 → `cd C:\Users\lab643\Desktop\rwa0607\onchain` → `npm run feed:sepolia`。
   需 `onchain/.env`(見下)+ 錢包有 Sepolia ETH。**讓視窗一直開著**,網站才有最新即時價。想更即時 → 把 `.env` 的 `FEED_INTERVAL_MS` 調小(如 `15000`)。

4. **【選配微調】交易動畫**:`frontend/src/components/TxOverlay.tsx` 可調速度/顏色/步驟文字。

5. **【沿用既有 TODO】** 見 HANDOVER.md §8:WalletConnect projectId(手機掃碼)、Uniswap 池流動性薄、AI 估值模型尚未實作等。(Dashboard 寫死數字已於本次解決)

---

## ▶️ 怎麼跑(速查)

```bash
# 1) 餵即時價(demo 必跑,需 onchain/.env)
cd onchain && npm run feed:sepolia

# 2) 前端本機預覽(走勢線本機現在也看得到了)
cd frontend && npm run dev          # http://localhost:5173

# 3) 部署(push 觸發 Vercel 自動部署;或用 vercel CLI)
git add -A && git commit -m "..." && git push
```

---

## ⚙️ onchain/.env(🔒 不進版控;停電後若遺失需重填)

```
PRIVATE_KEY=0x...        # 部署者/餵價者(= PriceOracle owner、已授權 feeder)= 錢包 0x50d9e8471181fc563C944519d1A7a8AAf4208737
ORACLE_ADDRESS=0xF1198ab9A92E21E60bB90003eDEC0887aecf2871
SEPOLIA_RPC_URL=         # 可留空用公開節點
FEED_INTERVAL_MS=60000   # 選配:餵價間隔(毫秒)
EXTRA_CODES=             # 選配:追加股票代號,逗號分隔
```
> 私鑰只在本機 `.env`(已 gitignore,**不在 GitHub**)。重開機後 `.env` 若還在就直接用;不見了要重建(私鑰找原檔,或換新 burner + 照 HANDOVER.md §7 重部署)。

---

## 📌 重點提醒
- Chainlink Functions 已 sunset,**別再嘗試建訂閱**。
- 台股沒有 Chainlink feed,價格走 **TWSE feeder**(這是正解,不是缺陷)。
- 完整架構/合約/重部署 → 看 **[HANDOVER.md](./HANDOVER.md)**。
