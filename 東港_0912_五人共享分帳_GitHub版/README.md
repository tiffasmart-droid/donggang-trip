# 東港 9/12 五人共享分帳｜GitHub Pages 版

## 用原本的 GitHub 儲存庫部署

1. 解壓縮 ZIP，打開 GitHub 儲存庫的 Code 頁面。
2. 選 Add file → Upload files，將解壓後的所有檔案與 vendor、tests 資料夾拖入，然後 Commit changes。index.html 必須直接放在儲存庫最外層，不能只上傳 ZIP，也不要再包一層資料夾。
3. 確認最外層有 .nojekyll。若拖曳時漏掉這個檔案，可用 Add file → Create new file 建立同名空檔並提交。
4. 打開 Settings → Pages，在 Build and deployment 下，把 Source 選為 Deploy from a branch。
5. Branch 選 main（或你實際上傳檔案的分支），資料夾選 /(root)，按 Save。
6. 等待 Pages 部署完成，按同一頁的 Visit site。將這個網站網址分享給五位旅伴，選身份後進入 0912 帳本。

網站網址通常是 https://你的帳號.github.io/儲存庫名稱/，請以 Pages 顯示的網址為準。分享網站網址，不是 github.com 的程式碼頁面。

不需要建置指令、npm install、Node 伺服器或 GitHub Secrets。Supabase 設定已填入。
GitHub Free 的 Pages 通常需公開儲存庫；若你的私人儲存庫無法啟用，先確認帳號方案，不要直接改動原儲存庫的可見性。

原儲存庫若仍有 server.js、package.json、package-lock.json、data.json 或 public 舊目錄，本版不使用它們；請確認 Pages 指向新版根目錄。若已有自訂部署 workflow，請停用舊的 Node 部署流程，以免覆蓋這次的 Pages 發布。

## 加入手機主畫面

iPhone：Safari → 分享 → 加入主畫面。Android：瀏覽器選單 → 安裝應用程式／加到主畫面。第一次先連網開啟 Pages 網址。

## GitHub Pages 相容性

CSS、JavaScript、圖示、manifest、Service Worker 與邀請網址均使用相對路徑，支援 /儲存庫名稱/ 子目錄。附 .nojekyll，以原始靜態檔案發佈。

官方說明：[設定 Pages 發布來源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) · [建立 Pages 網站](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

## 已設定

- Supabase Project URL 與你提供的 Publishable key 已寫入 `config.js`。
- 資料來源：`public.trip_expenses`，固定 `room_code = '0912'`。
- 成員編號：0 粉粉、1 旅伴2、2 旅伴3、3 旅伴4、4 旅伴5。
- 要改名稱，修改 `config.js` 的 `names` 再重新部署。**不要改變成員順序**，既有帳目的付款人與分帳對象是以 0～4 編號儲存。
- 現有資料表沒有名稱欄位，因此移除「第一個人在線改名」輸入功能，改由同一份設定供所有手機使用。
- 原 ZIP 的 `data.json` 為空，無舊帳需匯入。

## 操作與同步

- 新增先驗證金額及參與者，待資料庫回覆成功後才清空輸入。按鈕防止連點；同一份失敗草稿重試使用相同 UUID，避免重複新增。
- 新增寫入 `id, room_code, title, amount, payer, participants, category`；`created_at` 使用資料庫預設值。刪除同時限制房間與主鍵。
- 讀取依 `created_at`、`id` 排序並分頁，不只讀前 1,000 筆。
- Realtime 訂閱 INSERT／UPDATE 的 0912 房間事件；DELETE 不依賴刪除列的 `room_code`，收到後重新讀取 0912。依 [Supabase 文件](https://supabase.com/docs/guides/realtime/postgres-changes) 處理刪除事件與 RLS 的舊列資料限制。
- 訂閱成功、恢復網路、返回 App、手動重新整理都補讀；前景每 15 秒補讀，彌補暫時漏接事件。
- 同步或資料驗證失敗時，保留畫面上最後成功取得的帳目並顯示錯誤，停用新增／刪除直到恢復；該畫面的結算可能不是最新。
- 離線只可開啟已快取的 App 外殼；不儲存離線待送帳目。重新開啟時必須連線才能讀取帳本。Service Worker 不快取 Supabase API 或帳目資料。
- 若新增顯示「未確認成功」，先重新整理確認帳目，再重送。未確認時不要重載頁面或改動草稿，以保留同一個請求 ID。

## 結算規則

金額最多小數兩位，以整數「分」計算。每筆均分至分，餘分依參與者編號由小到大分配，確保總額守恆。五人結算窮舉可行的收付配對，選擇轉帳筆數最少的一組。App 只提供轉帳建議，不會執行付款，也不記錄轉帳完成狀態。

## 更新 PWA

重新部署時，修改 `sw.js` 的 CACHE 版本字串，再上傳完整資料夾。已安裝的手機請連網開啟一次，關閉所有該網站頁面及 App 後再開啟，讓新版接手。新 worker 啟用時會移除舊版 `donggang-` 快取。

## 驗證結果（2026-09-09）

- 真實 Supabase：SELECT、新增、刪除、兩個獨立用戶端的 INSERT／DELETE Realtime 更新皆通過；測試列已刪除並確認不存在。
- 最少轉帳：2,401 組五人餘額與獨立的零和分組演算法比對通過，另測試小數餘分與輸入限制。
- 前端程式：房間限制、分頁、失敗保留資料、重新整理競態、離開取消訂閱、付款人不被重設、資料文字跳脫通過。
- PWA 檔案、圖示及本機套件齊備；未執行實體 iPhone／Android 安裝或瀏覽器視覺測試。
- 可選的開發驗證：有 Node.js 24 時執行 `node tests/check.cjs`。**部署及使用完全不需要 Node.js。**

## 檔案

`index.html` 保留原海洋與鮪魚視覺及底部導覽；`app.js` 處理畫面；`store.js` 處理 Supabase；`core.js` 處理金額及結算；`config.js` 為共用設定；`vendor/supabase.js` 是固定版本 2.57.4 的官方前端套件，授權檔同附。

已移除原本的 `server.js`、Express、Socket.IO 及伺服器用的 `data.json`。RLS／publication 沿用現有設定，未變更資料庫結構或政策。Publishable key 是前端公開用的金鑰；不要換成 service_role 或 secret key。目前按你的 anon RLS 使用共同帳本，0912 是房間識別碼，不是登入密碼。
