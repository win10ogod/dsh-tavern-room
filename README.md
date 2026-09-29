# DSH 酒館

將 [DSH Tavern 2.3.0](https://github.com/flizzywine/dsh-tavern/tree/5039205e19a84ba1c7766bf3de7d7014069cc88f) 的執行引擎、卡片工作台與瀏覽器相容層移植到 DSH 0.1.7-rc.2，集中在獨立的「酒館」頁面。

一個插件包包含人物卡、世界書與提示詞、劇情會話、卡片記憶、MVU、角色手機、外觀及酒館預設八個功能模組。使用 DSH 插件面板的總開關與各模組開關。停用功能保留資料；需要 MVU 的卡片在 MVU 關閉時會明確要求重新啟用。

## 使用

安裝發布包後重新載入酒館插件，從 DSH 左側的「酒館」進入。人物卡和世界書可直接匯入；「開局與歷史」提供原版開場預覽、備選開場、角色稱呼、聊天匯入和历史管理；「對話」提供故事及卡片工作台。

支援原版人物卡欄位與擴充編輯、世界書綁定與編輯、預設與正則、劇本及素材、使用者画像、寫作技能、Guide、姿勢和場景狀態、候選行動、正文修改與重生成、回滾及撤銷、原生分支、角色手機。模型、工具與技能透過 DSH 原生 Agent 執行。不包含場景生圖功能或生圖 API 配置。

卡片 HTML、JavaScript、iframe、Tavern Helper、SillyTavern facade、官方 MVU bundle 及服務端 EJS 模板沿用上游實作。腳本的執行策略與原版相同。支援範圍以該上游版本為準，不代表所有 SillyTavern 第三方擴充都已相容。

## 資料

預設目錄為 `$DSH_HOME/profile-data/tavern-room`，可用 `tavern-workspace` 的 `dataRoot` 配置修改。

- `engine/resources`：目前的人物卡、世界書、預設和劇本。
- `engine/originals`：匯入的原始檔案，包括 PNG。
- `engine/chats`：酒館對話、變數及狀態日誌。
- `engine/skills`、`engine/tools`：使用者技能與自訂擴充。
- 原生 Session：由 DSH 的 Session Persistence 管理。

0.1.x 插件已匯入的人物卡與世界書會移至完整引擎，進度保存在 `engine/room-resource-migration.json`。舊匯入資料仍保留。嵌入世界書保留在人物卡內，避免重複綁定相同外部世界書。

從 SillyTavern 複製人物卡與世界書：

```sh
node scripts/import-sillytavern.mjs --source D:/SillyTavern --data-root PATH_TO_DSH_HOME/profile-data/tavern-room
```

重新載入插件後完成引擎資料移轉。匯入器不改動來源資料；來源檔案變更時會拒絕直接覆蓋已有匯入記錄。人物卡、世界書、對話與服務金鑰不包含在發布包中。

## DSH 適配

使用 DSH 原生 Agent 預設註冊、工具作用域、會話保留與認證 API。新增訊息採用 format v4 的 producer source 和有效回合座標。

正文與工具結果的編輯以插件擁有的 surface 記錄儲存，保留原始訊息、工具參數及來源引用；酒館會還原其角色與內容供模型和頁面使用。預檢、分支及存檔讀回使用原始 DSH 事件，不修改 DSH 安裝檔或放寬原生驗證。這些酒館編輯視圖需要本插件載入。

## 開發與驗證

```sh
npm ci
npm run build
npm run check
npm pack
```

`test/session-format.test.mjs` 檢查原生儲存與工具 JSON 的還原。`scripts/*-smoke.mjs` 是使用獨立 DSH 設定檔的 Windows Edge 實測腳本，涵蓋開局、模型對話、卡片工具、JS／Helper、MVU 和原生存檔；真實生成會使用測試設定檔中的模型服務。`conversation-roundtrip.mjs` 驗證回滾、撤銷和分支。測試資料與日誌保存在未追蹤的 `artifacts/`。

`vendor/upstream/UPSTREAM.json` 記錄來源版本與 commit。`vendor/upstream/tavern-plugin/src/client` 是相容層原始碼，建置腳本生成 `lib/client.js`。

## 授權

AGPL-3.0-only。DSH Tavern 原作者及貢獻者的授權保留在 `vendor/upstream/LICENSE`；其他第三方套件保留各自授權。本插件包含對上游的 DSH 適配與獨立頁面修改。
