# FormosaX 台股 RWA 代幣化平台 — 簡報速查（合約原理 ＋ Demo 帶看 ＋ QA）

> 一句話定位:把台股做成 **24/7、可碎片化、可組合 DeFi** 的真實世界資產(RWA),價格來自**真實 TWSE 預言機**,平台穩定幣**對標金管會穩定幣監理**。全跑在 **Ethereum Sepolia 測試網**,前端部署於 Vercel。
>
> 線上 DApp:https://rwa0607.vercel.app　｜　區塊瀏覽器:https://sepolia.etherscan.io

### 🔖 合約位址(Sepolia，皆 Etherscan 已驗證原始碼)
| 合約 | 位址 |
|---|---|
| RegulatedTWD(穩定幣) | `0x0ec97A83E96C7e61b4eDD6FB5Bf33ddEaF63df67` |
| PriceOracle(預言機) | `0xF1198ab9A92E21E60bB90003eDEC0887aecf2871` |
| StockFactory(工廠) | `0xF262C1BFe36c5F458e1A178fD7D71C5C43AB8c44` |
| LendingPool(借貸) | `0xBebab317ec999ced702dE87C654868a9ede9ab82` |
| StockIPO(認購) | `0x925BE0f709e4c9b38578142E9B94AFbb71aBB990` |
| dTSMC(台積電代幣) | `0x1CB2Ea6f8eB47c24387B015C75D9d1dad800dc53` |
| Uniswap v3 池(dTSMC/TWD) | `0xe69aF036F8290Ed0371f79dE8E1060211e9f5353` |

---

# 🟢 速查框(上台前 30 秒掃一遍)

**Demo 90 秒動線**:Dashboard(真實數字/即時報價)→ Trade 買一筆台積電(看上鏈動畫→Etherscan)→ Portfolio(總資產/配置圖/損益/鏈上活動)→ Risk(風險分數/建議 LTV/AI 評語)→ Stablecoin 金管會對照 →(有時間)Lending / IPO / Swap、keeper 終端機。

**QA Top 5(最可能被問)**:
1. 為什麼要用區塊鏈做台股?跟傳統/券商差在哪?
2. 股價怎麼上鏈?預言機會不會中心化、被操縱?
3. 這真的符合金管會穩定幣法規嗎?
4. 代幣有真實股票擔保嗎?跟真實金融商品差在哪?
5. 安全性如何?私鑰/合約風險、有沒有審計?

---

# Part 1 ｜ 智能合約運作原理

## 1-0 架構與資金流(一句話講完)
> 使用者先用**水龍頭領平台穩定幣 TWD** → 拿 TWD **買台股代幣**(依預言機即時價鑄造)→ 之後可以走三條路:**質押借錢**、到 **Uniswap 換手**、或**認購新股 IPO** → 最後 **贖回** 換回 TWD。
>
> 價格由鏈下 **feeder** 從 TWSE 餵進 **PriceOracle**;所有合約共用**同一顆 TWD 穩定幣 ＋ 同一顆預言機**,組成一個完整的鏈上金融樂高。

```
        TWSE 即時行情
            │  (feeder 每60秒餵價)
            ▼
       ┌─────────────┐
       │ PriceOracle │◄──────────────┐ 各台股代幣都讀同一顆預言機
       └─────────────┘               │
 領TWD     │ 報價                     │
RegulatedTWD──買幣──► StockToken(dTSMC…12檔) ──┐
   (穩定幣)         │ mint / redeem            │
       ▲           ├──► LendingPool  質押借貸  │
       │ 贖回TWD    ├──► Uniswap v3   二級市場  │
       └───────────┴──► StockIPO     新股認購 ─┘
```

## 1-1 六個合約各做什麼(白話＋關鍵函式)

**① RegulatedTWD — 受監管台幣穩定幣(6 位小數)**
- 平台的「錢」。任何人可用 `mintTWD()` 水龍頭領取(領取時自動同步儲備,維持 100% 足額)。
- 角色分權(AccessControl):發行人 `admin`、儲備簽證 `ATTESTOR_ROLE`、法遵 `COMPLIANCE_ROLE`。
- 合規能力:`attestReserves()` 儲備簽證(留時間戳＋文件雜湊)、`requestRedemption()` 持有人贖回、`setFrozen()` 凍結地址、`pause()` 全面暫停;`_update()` 在凍結/暫停時**擋下轉帳**。

**② PriceOracle — 價格預言機(Chainlink AggregatorV3 風格)**
- `updatePrices(symbols, prices, decimals)`:**只有授權 feeder** 能寫真實股價上鏈。
- `latestPrice(symbol)` → 回傳 (價格, 小數位, 更新時間)。symbol = 股票代號的 bytes32(例 `"2330"`)。

**③ StockFactory — 台股代幣工廠**
- `createStock()` 一鍵量產一檔 StockToken(一檔台股 = 一個 ERC-20),全部共用同一顆 TWD ＋ Oracle。目前已上 **12 檔**。

**④ StockToken — 單一台股代幣(18 位小數)**
- `mint(twdAmount)`:收 TWD,依 `pricePerShare()`(讀預言機即時價)鑄出代幣,含 **30 天過期價檢查**(`maxPriceAge`)。
- `redeem()`:反向贖回 TWD。`getReserveStatus()`/`getCollateralRatio()` 揭露擔保。監管:黑名單 / KYC / 暫停。

**⑤ LendingPool — 質押借貸(對標 Aave 迷你版)**
- 出借:`depositTWD()` / `withdrawTWD()`(份額制,賺利息)。
- 借款:`supplyCollateral()` 質押台股 → `borrowTWD()` 借出 → `repay()` 還款。
- 風險參數:**LTV 50%**、**清算門檻 65%**、健康因子 < 1 可被 `liquidate()` 清算;利率隨資金使用率浮動(利息以 `borrowIndex` 累積)。

**⑥ StockIPO — 新股認購(庫存模式)**
- `createOffering()` 開案 → `subscribe()` 認購窗口內出資 → `claim()` 超額採 **pro-rata 配額 ＋ 退還溢繳款**(鏈上重現抽籤/配額)。

**＋ 鏈下 feeder(`onchain/scripts/feeder.js`)**
- 抓 TWSE **MIS 即時成交價**;盤中該批次無成交(`z="-"`)時,改用**最佳買賣價中間價**估當前價(避免誤用昨收)→ 每 60 秒批次 `updatePrices()` 上鏈。

## 1-2 一筆交易的完整生命週期(授權細節 — 一定要講對)
以「買 10 股台積電」為例,**買入是 2 步驟**:
1. 前端先讀 `dTSMC.pricePerShare()` 算出要付的 TWD(= 單價 × 股數)。
2. **步驟 1/2 授權**:`TWD.approve(dTSMC 合約位址, 金額)` —— 把 TWD 的動用權**授權給 dTSMC 合約當 spender**(不是給某個人,是給那顆台積電代幣合約)。
3. **步驟 2/2 鑄造**:`dTSMC.mint(金額)` → 合約用 `transferFrom` 把你的 TWD 拉進去、即時讀 `PriceOracle.latestPrice("2330")`、依價鑄出 dTSMC、TWD 鎖進儲備。
4. 發出 `Minted` 事件 → 前端跳「簽署 → 驗證 → 上鏈」動畫 + Etherscan 連結。
> **賣出(贖回)只要 1 步**:`dTSMC.redeem(股數)` 直接燒掉你自己的代幣換回 TWD,**不需授權**(因為是燒自己的餘額,不是動別人的錢)。
>
> **為什麼要 approve?** ERC-20 的安全設計:合約不能未經你同意就動你的 TWD,所以要先 `approve` 授權額度,合約才能 `transferFrom`。這就是為什麼買入會跳兩個簽名、賣出只跳一個。

## 1-3 價格怎麼上鏈?(兩個版本 — 一定會被問,務必講清楚)

**版本 A(評估後放棄):Chainlink**
- 原本想用 Chainlink **去中心化預言機**,但兩個致命問題:
  1. **台股沒有 Chainlink 現成價格 feed** —— Chainlink 主要提供加密貨幣/外匯/美股,**沒有台股 2330 這種報價源**。
  2. 退而想用 **Chainlink Functions**(讓鏈下抓 API 再上鏈),但**測試網的 Functions 已於 2026-06-02 sunset**,新訂閱建不了;官方改推 CRE,對課程 demo 太重。
- 結論:Chainlink 這條路走不通 → 相關套件已移除。

**版本 B(現在採用):自建預言機 + 鏈下 feeder**
- 架構:`feeder.js`(Node)用 **axios 接 TWSE 官方 API** → 解析價格 → 用 ethers 呼叫 `PriceOracle.updatePrices()` 寫上鏈,**每 60 秒一次、批次餵省 gas**。
- 接哪些 API:
  - **即時價**:TWSE **MIS** `getStockInfo.jsp`(盤中成交價 `z`;該批次無成交時改用**最佳買賣價中間價**估當前價)。
  - **收盤/後備**:TWSE **OpenAPI** `STOCK_DAY_ALL`(每日收盤,MIS 失敗時兜底)。
  - **歷史走勢**:TWSE `STOCK_DAY`(近月每日收盤,畫真實走勢線)。
- 前端只讀鏈上 `latestPrice()` 顯示;`/api/twse`、`/api/history` 是 Vercel serverless 代抓(避開瀏覽器 CORS / IP 限制)。
- **一句話講法**:「Chainlink 在台股走不通(沒 feed + 測試網 sunset),所以我自己做了一顆**符合 Chainlink AggregatorV3 介面**的預言機,用鏈下 feeder 接 **TWSE 官方 API** 餵真實價。因為介面一致,之後要去中心化可無痛換成 Chainlink Functions。」

---

# Part 2 ｜ Demo 帶看腳本

## 2-1 在 DApp 帶看(rwa0607.vercel.app)
- **Dashboard**:四張指標卡是**真鏈上彙總**(資產總額 / 儲備率 100% / 借貸池 TVL / IPO 案數)、即時報價、**真實近月走勢線**。→ 台詞:「這些數字不是寫死的,是即時讀合約算的。」
- **Trade**:**當場買一筆台積電** → 展示 TxOverlay「簽署 → 區塊驗證 → 已上鏈」動畫 + 即時擔保率/儲備 → 點 Etherscan 連結。
- **Portfolio(投資組合)**:總資產淨值 + **配置甜甜圈圖** + 各台股持倉與**未實現損益** + 「**鏈上活動**」分頁(你的 mint/borrow… 事件,可點 Etherscan)。→ 台詞:「我的所有部位與每一筆操作都在鏈上彙總、可逐筆查驗。」
- **Risk(AI 估值・風險引擎)**:12 檔的年化波動/動能/**風險分數**/**建議 LTV**(對比借貸固定 50%),每檔一句 **✨ AI 評語**(Claude)。→ 台詞:「這就是題目七的量化風險模型,資料是真實 TWSE 收盤算的。」
- **Stablecoin**:儲備率 Dial(100%)+ **「對標金管會穩定幣監理要點」對照表** + 每個欄位的 Etherscan「Read Contract」連結。→ 這頁是法規亮點,務必帶到。
- **Lending / IPO(SpaceX,US$135,已結束)/ Swap(Uniswap)**:時間夠再帶。

## 2-2 在 Etherscan 帶看(最有說服力 —— 證明「不是假的」)
> 開合約頁 → **Contract → Read Contract** 分頁,現場輸入查詢。

- **PriceOracle** `0xF119…2871` → `latestPrice("2330")` → 看到**真實台積電價** + `updatedAt`**時間戳**(剛餵的時間,證明即時)。
- **RegulatedTWD** `0x0ec9…df67` → 逐項對照金管會:`reserveRatioBps`(=10000 即 100%)、`issuerName`、`licenseNo`、`custodianBank`、`lastAttestationAt`、`auditReportURI`。
- **StockToken dTSMC** `0x1CB2…dc53` → `pricePerShare`、`getReserveStatus`、`getCollateralRatio`(擔保比例)。
- **剛送出的那筆交易** → **Logs** 看 `Minted` / `ReserveAttested` 事件;切 **Code** 分頁看綠勾「**Contract Source Code Verified**」。
- **(加分)餵價終端機**:show `npm run feed:sepolia` 正在跑,印出「`台積電(2330) = … (即時)` + tx hash」→ 證明**鏈下 → 鏈上**即時餵價真的在運作。
- **(加分)清算 keeper**:另開 `cd onchain && npm run keeper:sepolia`,印借款人**健康因子表**,< 1.0 自動 `liquidate` → 展示 DeFi 自動化清算。

> ⚠️ Demo 前置:盤中(平日 09:00–13:30)先開好 feeder,錢包要有 Sepolia ETH;先自己跑一遍買賣確認順暢。

---

# Part 3 ｜ QA 預想問答(精簡條列;⚠ = 弱點誠實應對)

## 3-0 ⭐ Top 5(優先背)
> 見最上方速查框,以下 3-1～3-4 是完整題庫。

## 3-1 技術類
**Q：為什麼用區塊鏈?不能用傳統資料庫嗎?**
- 24/7 交易、可碎片化(買 0.1 股)、**可組合性**(質押/借貸/IPO/Uniswap 一條龍)、鏈上透明可驗證、去中介。

**Q：股價怎麼上鏈?預言機怎麼運作?**
- feeder 抓 TWSE MIS 即時成交價 → 寫進 PriceOracle → StockToken 依價鑄/贖,每 60 秒更新,含 30 天過期保護。

**Q：你的價格是接什麼 API?為什麼不用 Chainlink?（見 Part 1-3,務必答得出兩版本)**
- 接 **TWSE 官方 API**:MIS `getStockInfo.jsp`(即時)+ OpenAPI `STOCK_DAY_ALL`(收盤後備)+ `STOCK_DAY`(歷史走勢)。
- 不用 Chainlink 兩個原因:① 台股**沒有 Chainlink feed**;② Chainlink Functions **測試網 2026-06-02 已 sunset**、建不了新訂閱、CRE 太重。
- 我自建一顆**符合 Chainlink AggregatorV3 介面**的預言機,鏈下 feeder 餵 TWSE 真實價,介面一致 → 未來可無痛換 Chainlink Functions 去中心化。

**Q：買入是怎麼授權的?為什麼跳兩個簽名?**
- 買入 2 步:先 `TWD.approve(dTSMC 合約, 金額)` 授權,再 `dTSMC.mint()`(合約 `transferFrom` 收 TWD 鑄幣)。賣出 `redeem()` 燒自己的幣、**不需授權**(只跳一個簽名)。這是 ERC-20 標準安全設計。

**Q：feeder 沒開 / 掛掉,價格會出錯嗎?**
- 不會用到錯價:StockToken 有 `maxPriceAge = 30 天`,超過 30 天的舊價 mint 會直接 revert。所以 demo 不開 feeder 也能用 30 天,且絕不會拿過期價成交。

**Q：為什麼 TWD 是 6 位小數、台股代幣是 18 位?**
- TWD 對齊穩定幣慣例(USDC 也 6 位),台股代幣用 ERC-20 預設 18 位;合約內部自動換算估值。

**Q：一檔台股一個合約,上千檔不就上千個合約?擴展性?**
- 預言機可**餵全市場報價**;可交易代幣用**工廠(StockFactory)按需量產**精選清單(部署越多越吃 gas,故精選);未來可上 L2 降成本。

**Q：預言機是中心化的吧?會被操縱嗎?**
- ⚠ 坦承:台股**沒有 Chainlink feed**,目前是自建單一 feeder。緩解:價格與更新時間在 Etherscan 全公開可查、有過期保護。Roadmap:改 **Chainlink Functions** 去中心化餵價。

**Q：為什麼跑測試網不是主網?**
- 課程專題、避免真錢風險;架構與主網一致,可直接平移。

**Q：合約安全嗎?有審計嗎?**
- 用 OpenZeppelin 標準元件(ERC20/AccessControl/Pausable)、**16 項測試全綠**、Etherscan **已驗證原始碼**。⚠ 未經第三方專業審計(demo)。

**Q：合約可以升級嗎?**
- ⚠ 目前不可(無 Proxy),改邏輯要重部署。Roadmap:UUPS 可升級代理。

**Q：私鑰/owner 安全嗎?**
- ⚠ burner 錢包、僅測試網;單一錢包兼 owner/admin/feeder(已知弱點)→ 正式化會**拆角色 + 多簽 + 時間鎖**。

**Q：走勢圖是真的嗎?**
- 是 TWSE **STOCK_DAY 真實近月每日收盤** + 尾端接鏈上即時價;非逐筆 tick 圖(但方向與區間真實)。

## 3-2 商業 / 法規類
**Q：這符合金管會的穩定幣法規嗎?**
- 對標《虛擬資產服務法》/穩定幣監理草案要點,**每一條都對應合約上 Etherscan 可讀欄位**:100% 足額儲備、定期儲備證明(PoR)、合格保管揭露、持有人贖回權、法遵凍結/暫停、權責分離。⚠ 是 demo **對標精神**,非真實持牌發行。

**Q：RWA 代幣化在台灣合法嗎?**
- 法規仍在發展中;本作品示範**技術可行性與合規機制**,非實際發行金融商品。

**Q：為什麼要自己的穩定幣,不用 USDT/USDC?**
- 台幣計價、在地**受監管揭露**、可凍結/暫停以符合本地法遵需求。

**Q：商業模式 / 怎麼賺錢?**
- 借貸利差、交易手續費、IPO 承銷、穩定幣儲備收益。

**Q：跟券商複委託/定期定額差在哪?**
- 24/7、碎片化、可組合 DeFi、全球可及、鏈上透明、無需信任單一中介。

**Q：穩定幣的儲備真的存在嗎?怎麼證明?**
- `reserveAttestedTWD` + `reserveRatioBps` + `attestReserves`(時間戳+文件雜湊)+ `ReserveAttested` 事件;demo 中 mint 自動同步維持 100%。

**Q：如果真的要上線發行,法規上最大的障礙是什麼?**
- 發行人須持牌/核准、儲備需信託保管與區隔、KYC/AML、與券商及集保(TDCC)對接、投資人保護機制。本作品是把這些**機制**先用合約做出來示範。

**Q：怎麼防制洗錢 / 符合法遵?**
- KYC 註冊表(`kycVerified`)、可凍結個別地址(`setFrozen`)、可全面暫停流通(`pause`),所有動作鏈上留事件可稽核。

**Q：代幣化股票和真實股票,股利/投票權怎麼處理?**
- ⚠ 目前是 demo,代幣是**由 TWD 儲備擔保的合成部位**,未處理股利/股東會投票。真實化需與保管機構對接做權益對應(roadmap)。

## 3-3 DeFi 功能類
**Q：質押借貸/清算怎麼運作?**
- 存 TWD 賺息;質押台股代幣借 TWD;LTV 50%、清算線 65%、健康因子 < 1 可被清算;利率隨使用率浮動。

**Q：IPO 認購怎麼做到公平?**
- 認購窗口固定價,超額採 **pro-rata 配額 + 退還溢繳款**,鏈上重現抽籤/配額。

**Q：Uniswap 池價與預言機價會不一樣嗎?**
- 兩者獨立、可能分歧,靠套利收斂。⚠ 目前流動性薄(demo),大額會滑價。

**Q：借貸利率怎麼決定?**
- 使用率模型:借款年化 = base 2% + slope × 資金使用率;出借年化 ≈ 借款年化 × 使用率。資金越緊、利率越高。

**Q：清算誰來執行?有自動清算機器人嗎?**
- 健康因子 < 1 時,任何人可呼叫 `liquidate()` 代償、取得折價抵押(清算獎勵 5%)。⚠ 目前**只有合約函式、沒有自動 keeper bot**(roadmap)。

**Q：已經有 mint/redeem,為什麼還要 Uniswap 二級市場?**
- 提供即時流動性與**價格發現**、交易不消耗發行儲備、且可做「池價 vs 預言機價」套利讓兩邊收斂。

## 3-4 ⚠ 地雷區（被戳弱點時的標準應對）
> 弱點清單:預言機中心化、單錢包控管、流動性薄、合約不可升級、未審計、非真實股票託管、僅測試網。(AI 估值/風險已實作,見 3-5)

**統一基調(背起來)**:
> 「坦白說,這是**課程 Demo**,放在測試網。它的價值在於**端到端展示了 RWA + DeFi + 合規機制的完整技術可行性** —— 從真實股價上鏈、穩定幣足額儲備、質押借貸到 IPO,全部鏈上可驗證。要走向正式化,我們的 roadmap 是:**去中心化餵價(Chainlink Functions)、多簽 + 時間鎖、第三方審計、與券商/保管行及法規對接**。」

---

## 3-5 進階功能 QA(投資組合 / AI 風險 / 鏈上活動 / 清算 keeper)

**Q：投資組合的「未實現損益」怎麼算的?**
- 鏈上沒有成本價 → 買入時把成本記在**瀏覽器 localStorage**,用平均成本法 × 現價算損益。⚠ 坦承:是**本機估算**(只反映這台裝置的買賣);正式化需鏈上記錄成本或後端帳本。

**Q：你的「AI 估值」是真的 AI 嗎?怎麼運作?**
- 兩層:① **量化風險引擎** —— 用真實近月收盤算年化波動/動能 → 風險分數(0–100)+ 建議 LTV(決定性、可重算);② 每檔一句**白話評語由 Claude(claude-haiku-4-5)生成**。沒設 API key 也有 ① 的量化分數(優雅降級)。

**Q：建議 LTV 跟借貸的固定 50% 有什麼關係?**
- 借貸目前固定 LTV 50%;風險引擎輸出**風險驅動的建議 LTV**(低風險→高、高風險→低),可接 `LendingPool.setRiskParams` 做動態調整(roadmap)。

**Q：「鏈上活動」那些紀錄哪來的?**
- 前端用 viem `getLogs` 直接讀合約事件(`Minted` / `Borrow` / `Repay` / 質押…),依你的地址過濾,每筆可點 Etherscan。⚠ 公開 RPC 範圍受限時自動退成「用 Etherscan 查看」連結。

**Q：清算 keeper 怎麼運作?有自動清算了嗎?**
- `keeper.js` 掃 `Borrow` 事件找借款人 → 每 30 秒輪詢健康因子 → < 1.0 自動呼叫 `liquidate()`(代償取折價抵押 +5%)。補了原本「只有合約函式、沒有 bot」的缺口;仍是鏈下單機腳本(roadmap:去中心化 / 多 keeper)。

---

### 📌 一頁總結(若只記三句)
1. 真實台股價透過預言機上鏈,代幣依即時價鑄/贖,**Etherscan 全程可驗證**。
2. 平台穩定幣**對標金管會**:100% 儲備、PoR、贖回權、凍結/暫停,逐項鏈上可查。
3. 完整 DeFi 樂高(借貸/IPO/Uniswap);弱點誠實面對,並有清楚的正式化 roadmap。
