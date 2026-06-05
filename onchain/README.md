# RWA 台股代幣化 — 鏈上(預言機 + 多台股工廠)

把(大量)台股上鏈,並用**真實預言機**餵 TWSE 股價。

## 元件
- `contracts/PriceOracle.sol` — 價格預言機(授權餵價者把真實股價寫上鏈,Chainlink AggregatorV3 風格)
- `contracts/StockToken.sol` — 依預言機即時價鑄造/贖回的台股代幣(ERC-20)
- `contracts/StockFactory.sol` — 量產台股代幣(一檔一個 ERC-20)
- `contracts/MockTWD.sol` — 平台穩定幣(6 位,公開水龍頭)
- `scripts/deploy.js` — 部署全部 + 餵入精選台股現價 + 量產代幣 + 產生 `deployed.json`
- `scripts/feeder.js` — 從 TWSE OpenAPI 抓全市場收盤價,批次推上預言機
- `stocks.js` — 精選「可交易」台股清單(可自行增減)

## 安裝
```bash
cd code/onchain
npm install
```

## 測試(本地,已通過 5 項)
```bash
npx hardhat test
```

## 設定 .env
複製 `.env.example` 成 `.env`,填入:
- `SEPOLIA_RPC_URL`(Alchemy/Infura,或留空用公開節點)
- `PRIVATE_KEY`(burner 錢包,需有 Sepolia 測試 ETH 付 gas)

## 部署到 Sepolia
```bash
npm run deploy:sepolia
```
完成後會自動產生:
- `code/onchain/deployed.json`
- `code/frontend/deployed.json` ← **前端就會自動改讀鏈上真實價**

把 `deployed.json` 印出的 `ORACLE_ADDRESS` 填回 `.env`。

## 持續餵價(真實預言機)
```bash
npm run feed:sepolia
```
會抓 TWSE 全市場收盤價、批次寫上鏈,每 10 分鐘更新一次(可調 `FEED_LIMIT`)。

## 更新前端
`deployed.json` 產生後:
```bash
cd ../frontend
git add -A && git commit -m "add deployed.json" && git push
```
Vercel 會自動重新部署,線上版即顯示**鏈上真實台股價**並可對已上架台股買賣。

## 注意
- TWSE 為**日收盤/延遲價**、假日不更新(demo 已標示)。
- 「全部台股」務實作法:預言機可餵全市場報價(`FEED_LIMIT` 控制批量),可交易代幣則為 `stocks.js` 的精選清單(部署越多越吃 gas)。
- 進階(Phase 3):可把 feeder 換成 Chainlink Functions 做去中心化餵價。
