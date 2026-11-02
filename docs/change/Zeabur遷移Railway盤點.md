# Zeabur → Railway 遷移：第一階段盤點與規劃

> 撰寫日期：2026-10-21
> 盤點依據：`origin/main` @ `fb05616`（內容與 `feature/consultation-and-seminar-split` @ `ada346e` 相同）
> 範圍：唯讀盤點。未連線 Zeabur／Railway、未變更雲端資源、正式資料或 DNS。
> 本文件只列變數**名稱**，不含任何真實值。請勿在本文件填入秘密值。
> ⚠️ 第 4、7、8 節的備份與回復做法已由 [Zeabur遷移Railway第二階段.md](Zeabur遷移Railway第二階段.md) 修正，衝突時以第二階段為準。

**重點摘要**

- 程式不會把資料寫在容器硬碟上（不需要 Volume）。系統裡沒有 Redis、Worker、排程。
- 非搬不可的只有三樣：**MySQL、環境變數、DNS**。
- 風險最高的是**測試環境用到正式 S3 金鑰**：在測試環境刪一張輪播圖，正式環境的圖會一起被刪。

本文件中「✓」代表有程式碼可查的事實；「推測」或「待確認」會另外標明。

---

## 1. 正式版本

| 項目 | 狀態 |
|---|---|
| `origin/main` | `fb05616`（2026-10-01，PR #9） |
| `feature/consultation-and-seminar-split` | `ada346e`，檔案內容與 `origin/main` 完全一樣 |
| 本機 `main` | `3357927`，比 `origin/main` 落後 14 個 commit，已過時，需先 `git pull` |
| 未提交的修改 | 未追蹤檔：`docs/環境變數.md`、`docs/前端環境變數.md`、`需求說明.md`。內容未檢視，看檔名可能含真實值，**commit 前務必先檢查** |
| `.env` | 沒有被 git 追蹤（`backend/.gitignore` 有排除）✓ |
| **Zeabur 實際部署的版本** | **⚠️ 未知**。舊 runbook 記載部署分支為 `integration/monorepo`，但該分支停在 `9852046`（2026-08-28），比 main 舊很多。需到 Zeabur 確認實際綁定的分支與 commit |

## 2. 服務清單

| 服務 | 目錄 | 執行環境 | 建置 | 啟動 | Port |
|---|---|---|---|---|---|
| Frontend（Nuxt 3.12.2 SSR，Nitro node-server） | `frontend` | Node 未鎖版本（無 `engines`、無 `.nvmrc`），推測用 Node 22 | `npm ci` → `npm run build`（安裝時會自動跑 `nuxt prepare`） | `node .output/server/index.mjs`（package.json **沒有** `start` script） | 讀 `PORT`，預設 3000 |
| Backend（Express 5） | `backend` | Node ≥22，Dockerfile 用 `node:22-alpine` ✓ | `backend/Dockerfile` 多階段建置，最後一階為 `production` ✓ | `node dist/server.js`（**不會**自動跑 migration）✓ | 讀 `PORT`，預設 8080，監聽 `0.0.0.0` ✓ |
| MySQL | — | 正式版本**未知**；本機用 `mysql:8.0.33` | — | — | 3306 |
| Redis／Worker／排程 | **沒有** | 程式中找不到 Redis、queue、cron、`setInterval`；寄信在 request 中直接寄出 | | | |

**依賴關係**

- 瀏覽器 → Frontend（SSR）
- 瀏覽器、Frontend SSR → Backend（透過 `NUXT_PUBLIC_API_BASE_URL`）
- Backend → MySQL、SMTP、S3
- **瀏覽器 → S3**：後台上傳輪播圖時，瀏覽器用 presigned URL 直接把檔案傳到 S3
- 瀏覽器 → CloudFront（讀圖）

> 首頁 SSR 會向 Backend 抓輪播資料，Backend 掛掉時首頁也會受影響。

## 3. 環境變數（只列名稱）

| 變數 | 用途 | 服務 | 敏感 | 建議輪替 |
|---|---|---|---|---|
| `NODE_ENV` | 必須是 `production` | 後端、前端 | 否 | — |
| `PORT` | 監聽 port，Railway 會自動注入 | 後端、前端 | 否 | — |
| `LOG_LEVEL` | log 等級 | 後端 | 否 | — |
| `DB_HOST` / `DB_PORT` / `DB_DATABASE` | 資料庫連線 | 後端 | 中 | 換新主機，值會跟著變 |
| `DB_USER` / `DB_PASSWORD` | 資料庫帳密 | 後端 | **是** | 新資料庫使用新帳密 |
| `DB_CONNECTION_LIMIT` | 連線池大小 | 後端 | 否 | — |
| `JWT_SECRET` | 簽發登入 token（必填，至少 16 字元） | 後端 | **最高** | 沿用＝已登入者不會被登出；換新＝所有人須重新登入。可擇一，懷疑外洩過就換 |
| `JWT_EXPIRES_IN` / `BCRYPT_SALT_ROUNDS` | token 有效期、密碼雜湊強度 | 後端 | 否 | — |
| `CORS_ALLOWED_ORIGINS` | 允許的前端來源，逗號分隔；空值＝全部擋掉 | 後端 | 否 | 測試期間需加上 Railway 測試網域 |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_ENCRYPTION` | SMTP 伺服器 | 後端 | 否 | — |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | SMTP 帳號、Gmail 應用程式密碼 | 後端 | **是** | 建議切換後換新 |
| `MAIL_FROM_ADDRESS` / `MAIL_FROM_NAME` / `RECIPIENT_EMAIL` | 寄件人、收件人。報名與免費諮詢兩種通知信都寄給 `RECIPIENT_EMAIL` | 後端 | 否 | — |
| `AWS_REGION` / `AWS_S3_BUCKET` | S3 位置 | 後端 | 中 | — |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM 金鑰（權限應只到 `carousel/*`） | 後端 | **是** | 建議發一組新的給 Railway，切換後停用舊的 |
| `AWS_S3_PUBLIC_BASE_URL` | CloudFront 網址，結尾不可有 `/` | 後端 | 否 | — |
| `NUXT_PUBLIC_API_BASE_URL` | 後端網址 | 前端 | 否（瀏覽器看得到） | 切換時會改 |
| `NUXT_PUBLIC_SITE_URL` | canonical 網址 | 前端 | 否 | 測試環境**不可**設成正式網域 |
| `NUXT_PUBLIC_GTM_ID` | GTM 容器 ID | 前端 | 否 | 測試環境留空 |

> 以下變數就算沒設，服務也照常啟動、不會報錯，只是功能會悄悄失效：
> - MAIL 沒設 → 不寄信
> - AWS 沒設 → 上傳輪播圖回 503
> - CORS 沒設 → 後台完全打不到 API

## 4. 資料與檔案

**資料庫**

- MySQL，正式版本未知。
- 舊表 MyISAM、新表 InnoDB 混用。~~另有 view 與 trigger~~ → **更正：view、trigger、routine 皆為 0**，見[第二階段文件](Zeabur遷移Railway第二階段.md) §0。
- `007` 使用 JSON 欄位，需要 MySQL ≥ 5.7.8。
- 後端設定 `dateStrings: true`，日期以字串讀出、不轉時區，因此**新舊資料庫的 `time_zone` 必須一致**。

**Migration 工具**

- 自寫的 raw SQL 執行器 [backend/scripts/migrate.ts](../../backend/scripts/migrate.ts)。
- 以 `node_schema_migrations` 表記錄已執行的檔案。
- `NODE_ENV=production` 時預設拒絕執行，需加 `--allow-production` 才會跑。
- 目前有 001～007。`006_create_carousel_table`、`007_create_consultations_table` 是新功能的表，**需確認正式資料庫是否已有這兩張表**。

**本機硬碟寫入**

- 後端：log 寫 stdout；migrate 只讀檔。
- 前端：沒有寫檔。`swr: 0` 使用 Nitro 記憶體快取；`@nuxt/content` 只在 build 時讀檔。
- **找不到任何依賴容器硬碟保存資料的程式，不需要 Volume**（MySQL 本身除外）。

**上傳**

- 沒有上傳目錄。
- 瀏覽器以 presigned PUT 直接上傳到私有 S3，路徑為 `carousel/{desktop|mobile}/{uuid}.{ext}`。
- 公開讀圖經由 CloudFront。
- 刪除輪播時，後端會呼叫 `DeleteObject`，**真的刪除 S3 上的檔案**。

**舊資料欄位**

- Laravel 遺留的 `page_files.file` 與 `imageUrl`，路徑可能指向舊主機，需抽查。

## 5. 外部整合

| 整合 | 狀況 |
|---|---|
| AWS S3 + CloudFront | 使用中。前端 SEO 圖片把 `d1vjl2px6hqzku.cloudfront.net` 寫死在程式裡；輪播圖網址由 `AWS_S3_PUBLIC_BASE_URL` 組成。**S3 bucket 的 CORS 設定需允許來源網域**，否則瀏覽器上傳會被擋，測試網域需先加入 |
| Gmail SMTP | 程式碼為一般 SMTP；使用 Gmail 是依據文件紀錄（`smtp.gmail.com`） |
| Resend | 沒有 |
| OAuth | 沒有。`oauth_*` 是 Laravel Passport 遺留的表，Node 改用 JWT，未串接任何 OAuth 服務 |
| Webhook | 沒有 |
| GTM、Google Search Console | GTM 由環境變數設定；Search Console 為 `nuxt.config.ts` 中的 meta 驗證，與主機無關 |
| Facebook Messenger | 只是一個連結 icon。`nuxt-facebook-chat` 有安裝但未放入 modules |

**與 Zeabur 綁定的設定**

- 程式碼中**沒有** zeabur 網域、內網主機名稱或 IP。
- 綁定都在環境變數的**值**裡：`DB_HOST`、`NUXT_PUBLIC_API_BASE_URL`、`CORS_ALLOWED_ORIGINS`。
- 文件另記載舊網址 `jinfengv2.zeabur.app`。

**依賴反向代理的程式**

- 後端設定 `trust proxy 1`。
- 前端 `redirect-www` 依 `x-forwarded-proto` 判斷 http 並導向 https。

## 6. Railway 部署對照

| | Backend | Frontend | MySQL |
|---|---|---|---|
| Root Directory | `backend` ✓ | `frontend` ✓ | — |
| 建置 | 偵測到 Dockerfile 即直接使用 ✓ | 自動偵測 Nuxt（推測）；build 指令 `npm run build` | Railway MySQL template |
| 啟動 | Dockerfile 的 CMD ✓ | **需手動設定** `node .output/server/index.mjs` | — |
| PORT | 讀 `PORT`，監聽 0.0.0.0 ✓ | Nitro 讀 `PORT` ✓ | 走內網連線 |
| 健康檢查 | 設 `/health` ✓；Dockerfile 的 HEALTHCHECK 推測 Railway 不採用 | `/`（會連帶依賴 Backend） | — |
| Volume | 不需要 ✓ | 不需要 ✓ | **需要**（template 自動掛載） |
| Node 版本 | 由 Dockerfile 決定為 22 ✓ | 待確認；建議以環境變數指定 22，不動程式碼 | 待確認 template 版本，需與正式環境主版本一致 |
| Watch paths | 建議設 `backend/**` | 建議設 `frontend/**` | — |

**推測、需實測**

- Railway 內網連線（`*.railway.internal`）用 mysql2 能否正常連線。
- Railway 是否送出 `x-forwarded-proto`。
- `sharp 0.32.6` 原生模組在 Railway 能否安裝（目前可能已無程式使用）。

## 7. 搬遷計畫

前提：系統沒有排程，不必擔心重複執行；**唯一要防的是新舊兩邊同時寫入資料**。
會寫入資料的地方：前台報名表、免費諮詢表、後台各項 CRUD、輪播上傳與刪除。

1. **備份**
   - 使用 `mysqldump --triggers --routines --events --lock-tables`（MyISAM 不支援 `--single-transaction`）。
   - 另外記錄：MySQL 版本、`sql_mode`、`time_zone`、字元集；每張表的筆數與最大 ID；Zeabur 上所有環境變數的名稱。
2. **還原演練**
   - 在 Railway 開一個獨立的測試 project，匯入 dump。
   - 執行 `npm run db:verify`，並比對筆數。
   - dump 內含客戶個資，須依個資標準處理。
3. **測試部署**
   - Railway 上建立 backend、frontend、MySQL 三個服務。
   - `MAIL_HOST` 留空（不寄信）。
   - `NUXT_PUBLIC_GTM_ID` 留空。
   - `NUXT_PUBLIC_SITE_URL` 設為測試網域。
   - **S3 不可使用正式金鑰。** 測試資料庫是正式資料的複本，輪播紀錄指向同一批 S3 檔案，在測試環境刪除會刪到正式圖片。可留空（上傳回 503），或另開測試 bucket。
4. **驗收**
   - 依 `QA測試.md` 測試：前台每一頁、表單送出、後台登入與 CRUD、輪播顯示、www 與 http 導向、sitemap、`/health`、`/ready`。
   - 以測試信箱與測試 bucket 各驗一次寄信與上傳。
5. **正式資料同步（停機窗口）**
   - 提前 24～48 小時調低 DNS TTL。
   - 公告維護時段。
   - **停止 Zeabur backend**，確保 Zeabur 不再有任何寫入。
   - 做最後一次 dump，匯入 Railway，核對筆數與最大 ID，**記下切換時間點與每張表的最大 ID**。
   - Railway 換上正式環境變數、開啟寄信、換上新的 S3 金鑰。
6. **DNS 切換**
   - 在 Railway 新增自訂網域、修改 DNS、等待 SSL 憑證簽發。
   - DNS 生效期間可能仍有使用者連到 Zeabur 前端，以下擇一處理：
     - 將 Zeabur 前端的 `NUXT_PUBLIC_API_BASE_URL` 改指 Railway 後端，所有寫入都進新資料庫；
     - 或維持 Zeabur 後端停機，這些使用者送表單會失敗，但資料不會分裂。
7. **觀察 24～72 小時**
   - 錯誤 log、表單是否確實寫入新資料庫、通知信是否收到、輪播上傳與刪除、GTM 與 Search Console。
8. **關閉舊環境**
   - Zeabur 先**暫停、不要刪除**，保留 1～2 週，連同最後一份 dump。
   - 確認無誤後，停用舊的 AWS、Gmail 金鑰，再刪除 Zeabur 服務。

## 8. 回復計畫

- **切換前**
  - 正式環境未曾變動，捨棄 Railway 資源即可。
- **切換後，新環境尚未收到資料**
  - 將 DNS 與 API 網址改回 Zeabur，重新啟動 Zeabur backend。
  - Zeabur 資料庫自停機起未變動，可直接使用。
- **切換後，新環境已有資料**
  1. 先讓 Railway 無法再寫入（停止 Railway backend）。
  2. 依第 7 節第 5 步記下的最大 ID 與切換時間，從 Railway 匯出新增或修改的資料（`contact*`、`consultations`、`faq`、`carousel`、`users` 等）。
  3. 匯入 Zeabur。Zeabur 在此期間沒有寫入，ID 會接續編號，不會撞號。
  4. 確認筆數後再切回 Zeabur。
  - 輪播圖都在同一個 S3 bucket，不需搬檔案。在 Railway 上刪除的輪播，需在 Zeabur 資料庫同步刪除該筆紀錄。

---

## 待補充資訊（無法從程式碼確認）

| # | 項目 | 查看位置 | 用途 |
|---|---|---|---|
| 1 | Zeabur 前後端各綁哪個分支、部署哪個 commit | Zeabur 服務頁 | 確認正式版本是否等於 `origin/main` |
| 2 | 正式 MySQL 版本、`sql_mode`、`time_zone`、`lower_case_table_names`、字元集 | Zeabur MySQL（唯讀查詢） | 新資料庫需設定一致 |
| 3 | 正式資料庫是否有 `carousel`、`consultations`、`node_schema_migrations` 表 | 唯讀 `SHOW TABLES` | 確認 006、007 是否已上線 |
| 4 | 資料庫大小、各表筆數 | 同上 | 估算停機窗口長度 |
| 5 | Zeabur 實際設定的環境變數**名稱**清單（不需給值） | Zeabur 環境變數頁 | 找出程式碼以外的設定 |
| 6 | 後端對外網址是 `*.zeabur.app` 還是自訂網域（例如 api.…） | Zeabur 網域設定 | 決定 DNS 切換範圍 |
| 7 | `DB_HOST` 使用內網或公開 host | Zeabur | 了解目前連線方式 |
| 8 | DNS 代管商、apex 網域是否支援 CNAME flattening 或 ALIAS、目前 TTL | 網域商 | Railway 自訂網域在根網域需要此功能 |
| 9 | S3 bucket 的 CORS 允許來源；CloudFront 的 origin 設定 | AWS Console | 測試與正式網域上傳需能通 |
| 10 | `AWS_S3_PUBLIC_BASE_URL` 是 `d1vjl2…cloudfront.net` 還是 `cdn.laborservice5690.com` | Zeabur 環境變數 | 程式碼與文件範例不一致 |
| 11 | 寄信是否確定使用 Gmail、寄件帳號、是否設定 SPF/DKIM | Zeabur 環境變數、DNS | 確認寄信能否照舊 |
| 12 | Zeabur 是否有程式碼以外的設定（cron、額外服務、自訂 start command、健康檢查路徑） | Zeabur 服務頁 | 程式碼中找不到 |
| 13 | 可停機的時段 | 你與客戶 | 安排停機窗口 |
| 14 | Railway 方案（private networking、資料庫備份功能） | Railway | 決定備份策略 |
