# Zeabur → DigitalOcean App Platform：遷移評估與月費預算

> 撰寫日期：2026-10-23
> 盤點依據：`feature/consultation-and-seminar-split` @ `ada346e`（檔案內容與 `origin/main` @ `fb05616` 相同，也就是 Zeabur 目前部署的版本，見 [Zeabur遷移Railway第二階段.md](change/Zeabur遷移Railway第二階段.md) §E-1）。
> 範圍：只做唯讀盤點與文件。沒有修改程式、沒有連線 Zeabur 或 DigitalOcean、沒有建立雲端資源、沒有讀取任何 `.env` 的值。
> 本文件只列變數**名稱**。請勿在本文件填入任何秘密值或正式個資。
> 價格查詢日期：**2026-10-23**。DigitalOcean 正在調整資料庫方案（見 §2-4），決定前請再到官網確認一次。

## 重點摘要

1. **可以搬，但資料庫不是原樣搬過去。** DigitalOcean Managed MySQL 目前**只支援 8.4**，而且**不允許 MyISAM**。正式資料庫有 15 張 MyISAM 表，匯入前必須轉成 InnoDB。這違反 repo 目前「不要把 MyISAM 轉 InnoDB」的原則（[001_create_tables.sql](../backend/migrations/001_create_tables.sql) 檔頭），需要你核准。
2. **後端至少要改一處程式**：Managed MySQL 要求 TLS 連線，但 [database.ts](../backend/src/config/database.ts) 的連線池沒有 `ssl` 設定。
3. **寄信可能會失效**：DigitalOcean 對 Droplet 封鎖 SMTP 25／465／587。App Platform 是否同樣封鎖，官方沒有寫明，需要實測。如果被擋，就要改用 HTTPS API 寄信（例如 Resend），這會改到程式和 DNS。
4. **月費（只算 DigitalOcean）**：最低可行 **約 $25／月**，建議起步 **約 $39／月（含常駐測試環境約 $64）**，成長後 **約 $138／月起**。Zeabur 現在每月花多少**沒有資料**，所以目前**無法算出搬遷後是省錢還是多花錢**。

本文件中「✓」代表有程式碼或官方文件可查的事實；「推測」「待確認」「待實測」會另外標明。

---

## 1. 程式與服務清單

### 1-1. 服務總覽

| 元件 | 目錄 | 技術 | 建置與啟動 | Port | 依據 |
|---|---|---|---|---|---|
| Frontend | `frontend/` | Nuxt 3（`ssr: true`）、Nitro node-server | `npm ci` → `npm run build`（`postinstall` 會跑 `nuxt prepare`）。啟動是 `node .output/server/index.mjs`，package.json **沒有** `start` script ✓ | 讀 `PORT`，預設 3000 | [nuxt.config.ts](../frontend/nuxt.config.ts)、[package.json](../frontend/package.json) |
| Backend | `backend/` | Node ≥22、Express 5、TypeScript | [Dockerfile](../backend/Dockerfile) 多階段建置，最後一階是 `production`，`CMD node dist/server.js` ✓ | 讀 `PORT`，預設 8080，監聽 `0.0.0.0` ✓ | [server.ts](../backend/src/server.ts)、[env.ts](../backend/src/config/env.ts) |
| MySQL | — | 正式版本**未知**。本機是 `mysql:8.0.33` | — | 3306 | [docker-compose.yml](../backend/docker-compose.yml) |
| Worker | **沒有** ✓ | 寄信在 request 裡直接送出，沒有 queue | | | `backend/src` 搜尋不到 `setInterval`、cron、queue、redis |
| 排程 | **沒有** ✓ | | | | 同上 |
| Redis | **沒有** ✓ | | | | 同上 |

### 1-2. 前端：能不能靜態部署？

**結論：目前必須用 SSR（App Platform 的 Service），不能直接改成 Static Site。**

| 理由 | 依據 |
|---|---|
| 首頁在 SSR 時向後端抓輪播資料 | [pages/index.vue:178](../frontend/pages/index.vue#L178) `useFetch('/carousels')` |
| 每一頁的 layout 在 SSR 時向後端抓 SEO 資料 | [layouts/default.vue:26](../frontend/layouts/default.vue#L26) `useFetch('/seo')` |
| FAQ、報名表單選項也是 SSR 抓資料 | [pages/faq.vue:48](../frontend/pages/faq.vue#L48)、[components/SignUpClassForm.vue:500](../frontend/components/SignUpClassForm.vue#L500) |
| `www` 與 http 轉址在 server 端執行 | [middleware/redirect-www.global.ts](../frontend/middleware/redirect-www.global.ts) |
| Nitro server middleware（helmet、擋惡意路徑） | [server/middleware/](../frontend/server/middleware/) |
| 首頁刻意不快取，後台改輪播要立刻反映 | [nuxt.config.ts](../frontend/nuxt.config.ts) `routeRules` 的註解 |

如果改用 `nuxt generate` 靜態輸出，後台每改一次輪播、SEO、FAQ，都要重新建置才會反映。這是**功能改變**，不放在這次遷移，列為可以延後評估的項目（§2-6）。

### 1-3. 部署前後的工作

| 工作 | 現況 | 依據 |
|---|---|---|
| DB migration | **不會自動執行**。是自己寫的 raw SQL 執行器，用 `node_schema_migrations` 表記錄。`NODE_ENV=production` 時要加 `--allow-production` 才會跑 ✓ | [scripts/migrate.ts:7](../backend/scripts/migrate.ts#L7)、[:33](../backend/scripts/migrate.ts#L33) |
| migration 能不能在正式 image 裡跑 | **不能**。`db:migrate` 用的是 `tsx`（devDependency），但 production image 只裝 `--omit=dev` 的套件 ✓ | [package.json](../backend/package.json)、[Dockerfile](../backend/Dockerfile) |
| Schema 驗證 | `npm run db:verify` 會比對表的**引擎**；轉成 InnoDB 後會回報 15 筆差異 ✓ | [schema-verifier.ts:114](../backend/src/infrastructure/database/schema-verifier.ts#L114) |
| 健康檢查 | 後端有 `/health`（不碰 DB）和 `/ready`（會 ping DB）✓。前端沒有專用路徑 | [routes/health/](../backend/src/routes/health/) |
| 前端 build 時讀檔 | `@nuxt/content` 有載入，但 `frontend/content/` 不存在，只在 build 時讀 ✓ | [nuxt.config.ts](../frontend/nuxt.config.ts) |

### 1-4. 資料庫

| 項目 | 現況 | 依據 |
|---|---|---|
| 引擎 | MySQL（正式版本未知） | — |
| ORM | **沒有**。直接用 `mysql2` 寫 SQL ✓ | [package.json](../backend/package.json) |
| 表引擎 | MyISAM 15 張、InnoDB 11 張（含 `carousel`、`consultations`），另有 Laravel 的 `migrations` 表（正式有、repo 沒建）✓ | [001_create_tables.sql](../backend/migrations/001_create_tables.sql)、[006](../backend/migrations/006_create_carousel_table.sql)、[007](../backend/migrations/007_create_consultations_table.sql) |
| 沒有主鍵的表 | `password_resets`（只有一般索引）✓ | [001_create_tables.sql:48-53](../backend/migrations/001_create_tables.sql#L48-L53) |
| 外鍵 | 實際上**沒有**（003 檔沒有任何指令）✓ | [003_create_foreign_keys.sql](../backend/migrations/003_create_foreign_keys.sql) |
| view／trigger／routine | 0（2026-07-21 唯讀檢查的結果，需重新確認） | [第二階段 §0](change/Zeabur遷移Railway第二階段.md) |
| JSON 欄位 | `consultations` 使用，需要 MySQL ≥ 5.7.8 ✓ | [007](../backend/migrations/007_create_consultations_table.sql) |
| 日期 | `dateStrings: true`，日期以字串讀出，所以**新舊資料庫的 `time_zone` 必須一致** ✓ | [database.ts:18](../backend/src/config/database.ts#L18) |
| TLS | 連線池**沒有** `ssl` 設定 ✓ | [database.ts](../backend/src/config/database.ts) |
| 連線池 | `DB_CONNECTION_LIMIT` 預設 10 ✓ | [env.ts](../backend/src/config/env.ts) |
| 交易 | 有程式使用交易，但對 MyISAM 表交易不會生效 ✓ | [transaction.ts](../backend/src/infrastructure/database/transaction.ts)、`contact.service.ts` |

### 1-5. 檔案、上傳與 Session

| 項目 | 現況 | 依據 |
|---|---|---|
| 本機永久檔案 | **沒有**。後端 log 寫 stdout，前端不寫檔 ✓ | `backend/src`、`frontend` 搜尋不到 `writeFile`、`createWriteStream` |
| 上傳目錄 | **沒有**。瀏覽器用 presigned URL 直接 PUT 到私有 S3，路徑 `carousel/...`；讀圖經 CloudFront ✓ | [admin-carousel.service.ts:164-179](../backend/src/modules/carousel/admin-carousel.service.ts#L164-L179) |
| 刪除 | 後端呼叫 `DeleteObject`，**真的會刪 S3 的檔案** ✓ | [admin-carousel.service.ts:148](../backend/src/modules/carousel/admin-carousel.service.ts#L148) |
| Session | **沒有 server session**。登入用 JWT，token 存在瀏覽器 `localStorage` ✓ | [store/useAuthStore.ts](../frontend/store/useAuthStore.ts)、[middleware/auth.global.ts](../frontend/middleware/auth.global.ts) |
| 記憶體內狀態 | 表單送出的 rate limiter 存在程序記憶體（`Map`），**多個 instance 之間不共用** ✓ | [rate-limit.ts](../backend/src/middleware/rate-limit.ts) |
| 反向代理 | 後端 `trust proxy 1` ✓；前端依 `x-forwarded-proto` 判斷 http | [app.ts:39](../backend/src/app.ts#L39)、[redirect-www.global.ts](../frontend/middleware/redirect-www.global.ts) |

### 1-6. Monorepo

| 項目 | 現況 | 依據 |
|---|---|---|
| 共用套件 | **沒有**。沒有 npm workspaces，前後端各自有 `package-lock.json` ✓ | [README.md](../README.md)、根 [package.json](../package.json) 只有 proxy scripts |
| 建置目錄 | 前端 Source Directory = `frontend`，輸出 `.output/`；後端 Source Directory = `backend`，輸出 `dist/` ✓ | — |
| 共用規格 | `specs/shared/api-contracts`（只有文件，不參與建置） | — |

### 1-7. 外部服務

| 服務 | 用途 | 搬遷後 |
|---|---|---|
| AWS S3 + CloudFront | 輪播圖儲存與讀取 | **保留**，不需要搬 |
| Gmail SMTP（依文件紀錄） | 報名、免費諮詢通知信 | 能不能保留**待實測**（§2-3） |
| GTM、Google Search Console | 追蹤、驗證 | 保留，和主機無關 |
| GitHub | 原始碼、自動部署 | 保留 |
| Railway `stunning-abundance` | 之前建立、部署都失敗的 project | 和這次無關，但可能有費用（見 [第二階段 §E-1](change/Zeabur遷移Railway第二階段.md)） |

---

## 2. DigitalOcean 適配與修改項目

### 2-1. 元件對應

| 元件 | App Platform 元件類型 | 建置方式 | 健康檢查 | 備註 |
|---|---|---|---|---|
| Frontend | **Service** | Node.js buildpack（推測可自動偵測），或之後另建 Dockerfile | HTTP `/healthz`（需新增，見 §2-5）；新增前先用 TCP | Run command 要手動設 `node .output/server/index.mjs` |
| Backend | **Service** | 沿用現有 Dockerfile ✓ | HTTP `/health` ✓（不要用 `/ready`，否則資料庫出問題時無法部署） | Dockerfile 的 `HEALTHCHECK` 指令推測不被採用，以 App Spec 設定為準 |
| MySQL | **Managed Database（MySQL）** | — | — | App Platform 的 dev database 只支援 PostgreSQL，不能用 ✓ |
| Worker | 不需要 | | | |
| 排程 | 不需要 | | | |
| Migration | **這次不設成 Job**，維持人工執行 | | | production image 沒有 `tsx`（§1-3）。要做成 PRE_DEPLOY Job 得先改建置，列為延後項目 |
| 靜態檔 | 不需要 Static Site 元件 | | | 前端靜態資源由 Nuxt 服務本身送出 |
| 物件儲存 | 不需要 Spaces | | | 沿用 AWS S3。改用 Spaces 列為延後項目 |

### 2-2. 平台限制對照

| 限制（官方） | 對本專案的影響 |
|---|---|
| 容器檔案系統是暫時的，不保留資料，上限 4 GiB | 無影響：沒有本機永久檔案、上傳不經過容器 ✓ |
| 只支援 **Linux AMD64** image | 後端用 `node:22-alpine`（multi-arch），在 App Platform 上建置會是 AMD64 ✓。**本機若是 Apple Silicon，不要在本機 build 再推 image**，讓平台從原始碼建置 |
| 建置：8 核、15 GiB RAM、24 GiB 磁碟，1 小時逾時 | 足夠 |
| 不能在容器開 SMTP、SSH、SFTP port | 這是指對內開 port，本專案不需要 |
| 上傳到 app 的檔案 600 秒逾時 | 無影響：上傳直接到 S3 |
| `$5` 與 `$10` 的 shared 方案是固定 CPU，**只能跑 1 個 instance** | 最低配置無法水平擴充（§3） |

### 2-3. 寄信（SMTP）

- **官方事實：** DigitalOcean 對 **Droplet** 預設封鎖 SMTP 25、465、587，建議改用第三方寄信服務。官方頁面**沒有提到 App Platform**。
- **社群回報：** 有用戶反映 nodemailer 搭配 Gmail SMTP 在 DigitalOcean 上連線逾時，但都是 Droplet 的案例。
- **本專案的風險：** [mail-transport.ts](../backend/src/infrastructure/mail/mail-transport.ts) 用 nodemailer 走 SMTP。程式有 fallback，寄不出去時只記 log、不會報錯，所以**被擋了也不容易發現**。
- **處理方式：**
  1. 測試環境用測試信箱實際寄一次（`MAIL_PORT` 587 和 465 都試）。這是 **P4 必過條件**。
  2. 如果被擋：改用 HTTPS API 寄信。和 Railway 評估時的「方案二」相同，大約 0.5～1 人天，還要在網域加 SPF、DKIM（[第二階段 §A-2](change/Zeabur遷移Railway第二階段.md)）。Gmail 沒有提供 2525 port，不能換 port 繞過。

### 2-4. 資料庫相容性（最大的變動）

| 項目 | DigitalOcean 規定（官方） | 本專案現況 | 必須處理 |
|---|---|---|---|
| 版本 | **只支援 MySQL 8.4**。8.0 叢集從 2026-10-30 起強制升級 | 正式版本未知，本機 8.0.33 | 如果正式是 8.0，這次遷移等於**順便升級到 8.4**。回復到 Zeabur 時是 8.4 → 8.0 的**降版**，必須演練 |
| 儲存引擎 | **不能使用 MyISAM** | 15 張 MyISAM 表 | dump 檔裡的 `ENGINE=MyISAM` 改成 `ENGINE=InnoDB` 再匯入。**需要你核准**（違反 repo 現有原則） |
| 主鍵 | 新建的表**必須有主鍵**（`sql_require_primary_key` 預設開啟，只能用 API 關閉） | `password_resets` 沒有主鍵 | 二選一：(a) 用 API 關掉這個設定（單節點可以；多節點官方強烈建議不要關）；(b) 匯入前幫這張表加主鍵。建議 (a) |
| TLS | 要求加密連線（推測，連線字串為 `ssl-mode=REQUIRED`，待實測確認） | 連線池沒有 `ssl` | **必須改程式**：新增 `ssl` 設定與 CA 憑證的環境變數（§2-6） |
| `sql_mode` | 預設包含 `ANSI_QUOTES`、`PIPES_AS_CONCAT`、`ONLY_FULL_GROUP_BY`、`STRICT_ALL_TABLES` 等；可用控制台或 API 修改 | 正式值未知 | 改成和正式一樣。已檢查 repository 的 SQL，沒有雙引號字串、`||`、`GROUP BY`，風險低，但仍建議對齊 |
| `time_zone` | 可用 API 設定 `default_time_zone` | 正式值未知 | **必須和正式一樣**（`dateStrings: true`） |
| `root` | 不能使用 root | — | 用 doadmin 或另建應用程式帳號 |
| 連線數 | 1 GiB 方案 75 條 | 連線池 10 條／instance | 足夠 |
| 備份 | 每日自動備份；PITR 只能回到最近 7 天 | — | 外加：切換前自行 dump 一份，存在加密的地方 |
| 方案異動 | Standard Edition 從 **2026-11-30 起（所有帳號）**，新叢集不能超過 4 GiB、不能加 standby 或唯讀節點。要高可用得用 Advanced Edition（$130／月起） | — | 影響情境 C 的高可用選項（§3） |

**MyISAM 轉 InnoDB 會改變什麼：**

- **外鍵：** 不會多出外鍵，003 沒有實際建立任何外鍵 ✓。刪除行為不會變。
- **交易：** 原本對 MyISAM 表無效的交易會開始生效。出錯時會整筆回滾，不會留下寫一半的資料。這通常是好事，但**行為和現在不同**，需要用 `QA測試.md` 驗證表單與後台 CRUD。
- **鎖定：** 從表鎖變成列鎖，對這個流量規模沒有負面影響。
- **`db:verify`：** 會回報 15 筆引擎差異，需要更新 schema 快照，或在驗證時接受這些差異。
- **回復到 Zeabur：** 倒回去時是 InnoDB，不是 MyISAM。如果要完全回到原狀，dump 時要再改回 MyISAM。

### 2-5. 連接埠、健康檢查與代理

| 項目 | 處理 |
|---|---|
| 後端 port | App Spec `http_port: 8080` ✓ |
| 前端 port | App Spec `http_port` 設成 3000，或讓平台注入 `PORT`（Nitro 會讀）✓ |
| 後端健康檢查 | `http_path: /health` ✓ |
| 前端健康檢查 | 新增 `frontend/server/routes/healthz.get.ts`，直接回 200，不經過 SSR 和 route middleware（和 [第二階段 §A-7](change/Zeabur遷移Railway第二階段.md) 相同）。健康檢查請求的 Host header、是否帶 `x-forwarded-proto`、是否跟隨轉址，官方文件沒有寫 → **待實測** |
| `trust proxy 1` | App Platform 前面有 Cloudflare 和負載平衡器，`X-Forwarded-For` 可能不只一層。如果 `req.ip` 拿到的是代理的 IP，所有人會共用同一個 rate limit 額度 → **待實測**（部署後印出 `req.ip`，和自己的公網 IP 比對） |
| `x-forwarded-proto` | 前端轉址依賴這個 header → **待實測**（打 `http://` 網址確認有 301 轉到 https，而且沒有無限轉址） |
| Node 版本 | 前端沒有 `engines`、沒有 `.nvmrc`，buildpack 可能選用預設版本 → 建議在 App Spec 或環境變數指定 22 |

### 2-6. 修改項目分類

**必須修改（不改就無法上線，或會造成資料錯誤）：**

| # | 項目 | 類型 | 估計工時 |
|---|---|---|---|
| M1 | 後端 MySQL 連線加 TLS：`buildPoolOptions` 新增 `ssl`，新增 CA 憑證環境變數，更新 `env.ts`、`.env.example`、測試 | 程式 | 0.25～0.5 人天 |
| M2 | MyISAM → InnoDB：dump 後轉換引擎、處理 `password_resets` 主鍵（或關掉 `sql_require_primary_key`）、更新 `db:verify` 的 schema 快照 | 資料／腳本 | 0.5～1 人天 |
| M3 | 資料庫參數對齊：`sql_mode`、`default_time_zone` | 設定 | 0.25 人天 |
| M4 | 前端新增 `/healthz` | 程式（新增一個檔案） | 0.1～0.25 人天 |
| M5 | 寫 App Spec（兩個 Service、Source Directory、run command、port、健康檢查、Node 版本、環境變數名稱） | 設定 | 0.5 人天 |
| M6 | 寄信實測；被擋就改 HTTPS API 寄信並設定 SPF／DKIM | 條件式（程式＋DNS） | 0～1.5 人天 |
| M7 | S3 bucket 的 CORS 加上 DigitalOcean 測試網域；測試環境用獨立 bucket（[第二階段 §A-3](change/Zeabur遷移Railway第二階段.md)） | AWS 設定 | 0.5 人天 |

**可以延後優化（不影響這次上線）：**

| # | 項目 | 原因 |
|---|---|---|
| L1 | 把 migration 做成 App Platform PRE_DEPLOY Job | 需要改 Dockerfile 或把 migrate 編譯成 JS；目前人工執行即可 |
| L2 | rate limiter 改成跨 instance 共用（例如 DB 或 Valkey） | 只有在後端跑 2 個以上 instance 時才需要 |
| L3 | 前端改靜態輸出或加快取 | 會改變後台編輯後的生效時間 |
| L4 | 輪播圖改用 Spaces | S3 運作正常，搬圖會增加風險 |
| L5 | 前端改用 Dockerfile 建置 | buildpack 可用時不急 |
| L6 | 移除可能沒在用的 `sharp`、修 `blockBadPaths` 沒有作用的問題 | 和遷移無關 |

---

## 3. 月費估算

### 3-1. 價格依據（2026-10-23 查詢）

| 項目 | 單價 | 來源 |
|---|---|---|
| App Platform shared 512 MiB／1 vCPU（固定 CPU，只能 1 instance） | $5.00／月，含 50 GiB 對外流量 | [App Platform Pricing](https://www.digitalocean.com/pricing/app-platform) |
| App Platform shared 1 GiB（固定 CPU，只能 1 instance） | $10.00／月，含 100 GiB | 同上 |
| App Platform shared 1 GiB（可多 instance） | $12.00／月，含 150 GiB | 同上 |
| App Platform shared 2 GiB | $25.00／月，含 200 GiB | 同上 |
| App Platform dedicated 最小（512 MiB） | $29.00／月 | [App Platform Pricing docs](https://docs.digitalocean.com/products/app-platform/details/pricing/) |
| App Platform 對外流量超額 | $0.02／GiB；流量額度以 team 合併計算；按秒計費 | 同上 |
| Managed MySQL Standard 1 GiB／1 vCPU，10～30 GiB 磁碟 | $15.15／月（$0.02254／時）。文件頁寫「$15.00 起」，以價格頁的時價換算為準 | [Managed Databases Pricing](https://www.digitalocean.com/pricing/managed-databases)、[MySQL Pricing docs](https://docs.digitalocean.com/products/databases/mysql/details/pricing/) |
| Managed MySQL Standard 2 GiB／1 vCPU，30～60 GiB | $30.45／月 | 同上 |
| Managed MySQL Standard 4 GiB／2 vCPU，60～120 GiB | $60.90／月 | 同上 |
| Managed MySQL 額外磁碟 | $0.215／GiB／月（每次 10 GiB） | 同上 |
| Managed MySQL Advanced Edition | $130／月起（8 GiB／2 vCPU），可加 2 個 standby，每個節點同價 | [MySQL Pricing docs](https://docs.digitalocean.com/products/databases/mysql/details/pricing/) |
| 資料庫流量 | 不計入對外流量額度 | 同上 |
| Spaces（這次不使用） | $5／月，含 250 GiB 儲存、1 TiB 流量 | [Spaces Pricing](https://www.digitalocean.com/pricing/spaces-object-storage) |
| Resend（條件式，如果 SMTP 被擋） | Free $0（每天 100 封）；Pro $20／月 | 依 2026-10-21 [第二階段文件](change/Zeabur遷移Railway第二階段.md) 的查詢，**這次沒有重新查核，待確認** |

**計價假設：**

- 幣別以**美元**為主。台幣換算假設 **1 USD = 32.5 TWD**（假設值，未查核當日匯率，請以實際帳單為準）。
- **未納入：** 稅金（DigitalOcean 是否依帳單地址加收營業稅，**待確認**）、信用卡海外交易手續費（通常約 1.5%，依發卡銀行）、超出假設的流量。
- **RAM 規格沒有實際用量依據。** 下面的規格是情境假設，不是從 package.json 推算的。需要 Zeabur 的 CPU／記憶體歷史數據才能確定（§6）。

### 3-2. 情境 A：最低可行配置

適用：流量很低，能接受單一 instance、沒有常駐測試環境。

| 元件 | 規格 | 數量 | 單價 | 計算式 | 月費 |
|---|---|---|---|---|---|
| Frontend Service | shared 512 MiB | 1 | $5.00 | 5 × 1 | $5.00 |
| Backend Service | shared 512 MiB | 1 | $5.00 | 5 × 1 | $5.00 |
| MySQL（運算＋10 GiB 磁碟） | Standard 1 GiB 單節點 | 1 | $15.15 | 15.15 × 1 | $15.15 |
| 額外 DB 磁碟 | 不需要（假設資料 < 10 GiB，待確認） | 0 | $0.215／GiB | 0 | $0.00 |
| 物件儲存 | 沿用 AWS S3（不在 DO 計費） | — | — | — | $0.00 |
| 對外流量 | 額度 50 + 50 = 100 GiB；假設用量 < 100 GiB | — | $0.02／GiB | 0 | $0.00 |
| Worker／排程／Job | 沒有 | 0 | — | — | $0.00 |
| 測試環境 | 只在遷移期間臨時開（算在 §3-6） | 0 | — | — | $0.00 |
| **DigitalOcean 小計** | | | | | **$25.15（約 NT$817）** |

**風險：** Nuxt SSR 在 512 MiB 下會不會記憶體不足，目前**沒有數據**。$5 方案無法加開 instance，記憶體不足時只能往上升級規格。

### 3-3. 情境 B：建議起步配置

適用：正式環境穩定運作，前端有記憶體餘裕，保留一個可以隨時測試的環境。

| 元件 | 規格 | 數量 | 單價 | 計算式 | 月費 |
|---|---|---|---|---|---|
| Frontend Service | shared 1 GiB（可多 instance） | 1 | $12.00 | 12 × 1 | $12.00 |
| Backend Service | shared 1 GiB（可多 instance） | 1 | $12.00 | 12 × 1 | $12.00 |
| MySQL 正式 | Standard 1 GiB 單節點，含 10 GiB | 1 | $15.15 | 15.15 × 1 | $15.15 |
| 對外流量 | 額度 150 + 150 = 300 GiB；假設用量 < 300 GiB | — | $0.02／GiB | 0 | $0.00 |
| **正式環境小計** | | | | | **$39.15（約 NT$1,272）** |
| 測試 Frontend | shared 512 MiB | 1 | $5.00 | 5 × 1 | $5.00 |
| 測試 Backend | shared 512 MiB | 1 | $5.00 | 5 × 1 | $5.00 |
| 測試 MySQL | Standard 1 GiB 單節點（**獨立叢集**，不和正式共用） | 1 | $15.15 | 15.15 × 1 | $15.15 |
| **測試環境小計** | | | | | **$25.15** |
| **DigitalOcean 合計（含常駐測試）** | | | | | **$64.30（約 NT$2,090）** |

- 測試環境可以只在需要時建立、用完刪除（按秒計費），平常月費就回到 $39.15。
- 也可以在正式叢集裡另開一個 database 給測試用（$0），但測試帳號就有機會碰到正式資料，**不建議**。

### 3-4. 情境 C：流量或服務成長後

適用：流量明顯增加，需要多個 instance。以下數字全部是**情境假設**。

| 元件 | 規格 | 數量 | 單價 | 計算式 | 月費 |
|---|---|---|---|---|---|
| Frontend Service | shared 2 GiB | 2 | $25.00 | 25 × 2 | $50.00 |
| Backend Service | shared 1 GiB | 2 | $12.00 | 12 × 2 | $24.00 |
| MySQL 正式 | Standard 2 GiB 單節點，含 30 GiB | 1 | $30.45 | 30.45 × 1 | $30.45 |
| 額外 DB 磁碟 | 假設多 10 GiB | 10 GiB | $0.215 | 0.215 × 10 | $2.15 |
| 對外流量 | 額度 200×2 + 150×2 = 700 GiB；**假設用量 1,024 GiB** | 超額 324 GiB | $0.02 | 0.02 × 324 | $6.48 |
| 測試環境 | 同情境 B | 1 組 | $25.15 | — | $25.15 |
| **DigitalOcean 合計** | | | | | **$138.23（約 NT$4,492）** |
| 條件式：寄信 API | Resend Pro（SMTP 被擋，且每天超過 100 封時） | 1 | $20.00（待確認） | — | +$20.00 |
| 條件式：資料庫高可用 | Advanced Edition 8 GiB，1 主 + 1 standby | 2 節點 | $130.00 | 130 × 2 − 30.45 | +$229.55 |

- 後端跑 2 個 instance 時，記憶體內的 rate limiter 每個 instance 各算各的，實際上限會變成 2 倍（L2）。
- Standard Edition 從 2026-11-30 起不能再加 standby，所以**資料庫高可用的門檻是一個月 $260 起**。以這個網站的規模，建議依賴每日備份 + PITR，不買高可用。

### 3-5. 費用分類

| 分類 | 項目 | 月費 | 備註 |
|---|---|---|---|
| **本次遷移新增** | DigitalOcean App Platform + Managed MySQL | A：$25.15／B：$39.15～$64.30／C：$138.23 起 | 見上 |
| **本次遷移新增（條件式）** | 寄信 API（只有 SMTP 被擋時） | $0～$20（待確認） | Free 方案每天上限 100 封 |
| **本次遷移新增（AWS 小額）** | 測試 bucket、正式 bucket 開啟 Versioning 後保留的舊版本 | 推測每月 < $1，**待確認** | 依圖片數量與 lifecycle 天數 |
| **原本就有、搬遷後保留** | AWS S3 + CloudFront | **未知**，不變 | AWS 帳單 |
| **原本就有、搬遷後保留** | 網域與 DNS 代管 | **未知**，不變 | 網域商 |
| **原本就有、搬遷後保留** | Gmail（或 Google Workspace） | **未知**，不變 | 若 SMTP 可用 |
| **原本就有、搬遷後保留** | GTM、Search Console、GitHub（公開 repo） | $0 | |
| **原本就有、搬遷後取消** | Zeabur（前端、後端、MySQL） | **未知**（以 Z 表示） | 搬遷完成並保留期滿後取消 |
| **原本就有、待決定** | Railway `stunning-abundance` | **未知** | 與本次無關，建議另行確認是否在計費 |

**搬遷後每月淨增減 = DigitalOcean 月費 + 條件式費用 − Z。** Z 沒有資料，所以目前無法判斷是省錢還是多花。

### 3-6. 一次性：搬遷期間的雙平台重疊費用

假設時程：DigitalOcean 測試與演練 2～4 週 → 切換 → Zeabur 暫停保留 1～2 週。

| 項目 | 計算式（以情境 B 為例） | 金額 |
|---|---|---|
| DigitalOcean 正式環境提前建立 | $39.15 × 0.5～1 個月 | $19.58～$39.15 |
| DigitalOcean 測試環境（演練期間） | $25.15 × 0.5～1 個月 | $12.58～$25.15 |
| 回復演練用的本機 Docker MySQL | 本機執行 | $0 |
| Zeabur 在保留期間繼續計費 | Z × 0.25～0.5 個月（暫停後是否仍計費，**待確認**） | 0.25Z～0.5Z |
| **一次性重疊合計** | | **約 $32～$64 + 0.25Z～0.5Z** |

---

## 4. 估算依據與限制

| 項目 | 說明 |
|---|---|
| 價格查核 | 2026-10-23 查詢官方價格頁與文件，網址列在 §3-1 與「參考來源」 |
| 沒有查核到的 | Resend 價格（沿用 2026-10-21 的紀錄）、DigitalOcean 稅金、Zeabur 現行價格與帳單 |
| RAM 與 CPU | **沒有實際用量資料**。三個情境的規格都是假設，需要用 Zeabur 的監控數據驗證 |
| 流量 | **沒有歷史數據**。情境 A／B 假設在額度內，情境 C 假設每月 1 TiB |
| 資料庫容量 | 假設 < 10 GiB，需要用 [第二階段 §E-3](change/Zeabur遷移Railway第二階段.md) 第 3 段查詢確認 |
| 匯率 | 假設 1 USD = 32.5 TWD |
| 計費方式 | App Platform 與 Managed DB 都按秒或按時計費、月底結算；表中都以整月計算 |
| 未納入 | 稅金、信用卡手續費、人力成本（工時另列於 §5-5）、超出假設的流量 |

---

## 5. 搬遷計畫與風險

整體流程沿用 [第二階段](change/Zeabur遷移Railway第二階段.md) 的 P0～P8，把 Railway 換成 DigitalOcean，並加上下面這些 DigitalOcean 特有的步驟。

### 5-1. 備份與還原驗證

1. **唯讀盤點**（第二階段 §E-3）：取得正式 MySQL 版本、`sql_mode`、`time_zone`、字元集、各表引擎與容量。
2. **演練 dump**：`--single-transaction`，正式服務照常運作。
3. **轉換**（新增）：在 dump 檔把 `ENGINE=MyISAM` 改成 `ENGINE=InnoDB`。轉換後先用 `grep -c 'ENGINE=MyISAM'` 確認是 0，並保留**轉換前的原始 dump**。
4. **還原到 DigitalOcean 測試叢集**：先用 API 設定 `sql_mode`、`default_time_zone`、`sql_require_primary_key`（如果採用 §2-4 的 (a)）。
5. **驗證**：表名、collation、筆數、`MAX(id)` 和來源比對；引擎應該**全部是 InnoDB**；日期欄位抽查時區；`db:verify` 只允許出現已知的 15 筆引擎差異。
6. **回復演練**（新增重點）：把 DigitalOcean 測試資料庫 dump 出來，還原到和 Zeabur **精確版本一致**的本機 Docker MySQL。這一步驗證 **8.4 → 8.0 降版**是否可行。如果失敗，回復計畫就只能改用「切換前的 Zeabur 原始資料庫 + 手動補切換後的資料」。
7. 記錄 dump、轉換、還原各花多久，用來估算停機時間。

### 5-2. 機密輪替清單（只列名稱與用途）

| 名稱 | 用途 | 建議 |
|---|---|---|
| `DB_USER`／`DB_PASSWORD` | 後端連線 MySQL | 新叢集新帳號，不沿用 |
| （新增）DB CA 憑證變數 | 後端 TLS 連線驗證伺服器 | 由 App Platform 的資料庫綁定注入，不手動複製 |
| `JWT_SECRET` | 簽發登入 token | 沿用＝管理員不用重新登入；換新＝全部重新登入。懷疑外洩過就換 |
| `MAIL_USERNAME`／`MAIL_PASSWORD` | SMTP 寄信（Gmail 應用程式密碼） | 切換後換新、撤銷舊的 |
| （條件式）寄信 API 金鑰 | HTTPS API 寄信 | 只在 SMTP 被擋時新增 |
| `AWS_ACCESS_KEY_ID`／`AWS_SECRET_ACCESS_KEY` | 輪播圖上傳與刪除 | 給 DigitalOcean 發一組新的，權限只到 `carousel/*`；切換穩定後停用舊的 |
| 測試環境 AWS 金鑰 | 測試 bucket | 獨立 IAM user，明確禁止碰正式 bucket |
| DigitalOcean API token | 設定資料庫參數 | 只給必要權限，用完撤銷 |
| 資料庫管理帳號（doadmin） | dump、還原、維運 | 不放在應用程式；只存在密碼管理器 |

非機密但切換時要改值：`DB_HOST`、`DB_PORT`、`DB_DATABASE`、`NUXT_PUBLIC_API_BASE_URL`、`CORS_ALLOWED_ORIGINS`、`NUXT_PUBLIC_SITE_URL`、`AWS_S3_BUCKET`（測試環境）。

### 5-3. 最終資料同步與 DNS 切換

1. 提前 24～48 小時調低 DNS TTL；正式 bucket 開啟 Versioning。
2. 公告維護時段。
3. 停止 Zeabur backend，依第二階段 §A-9 完成停寫確認。
4. 切換用 dump（`--lock-tables`）→ 轉換引擎 → 還原到 DigitalOcean 正式叢集 → 驗證筆數與 `MAX(id)`。引擎不同，所以**不能用 `CHECKSUM TABLE` 比對**，改用筆數 + `MAX(id)` + 抽樣。
5. 啟動 DigitalOcean backend，確認 `/health`、`/ready`。
6. 在 App Platform 加自訂網域，等 SSL 憑證簽發，再改 DNS。根網域需要確認 DNS 代管商是否支援 CNAME flattening／ALIAS，或把 DNS 交給 DigitalOcean 管理。
7. DNS 生效期間，Zeabur 前端可能還有流量：讓它的 API 指向 DigitalOcean 後端，或維持後端停機。**Zeabur backend 不可再啟動。**

### 5-4. 回退條件

| 狀況 | 回退 |
|---|---|
| 切換前任何一項驗證不通過 | 不切換，捨棄 DigitalOcean 資源 |
| 切換中，DigitalOcean 還沒對外開放 | 重新啟動 Zeabur backend，DNS 不動 |
| 切換後 2 小時內出現：表單寫入失敗、通知信收不到且無法立即修好、5xx 持續偏高、後台無法登入 | 停止 DigitalOcean backend → dump 整份 → **還原到 Zeabur 上的新資料庫**（不覆寫原本那份）→ 切回 DNS。前提是 §5-1 第 6 步的降版演練成功 |
| 切換後發現資料庫時區錯誤（日期顯示偏移） | 先修正 `default_time_zone`；已寫入的錯誤資料要個別評估 |
| Zeabur 保留期滿 | 不再提供回退；最終 dump 加密歸檔 |

### 5-5. 工時估計（範圍）

| 階段 | 工時 | 假設與不確定性 |
|---|---|---|
| 唯讀盤點、決策 | 0.5～1 人天 | 取決於能多快連上 Zeabur MySQL |
| 必改程式（M1、M4）＋測試 | 0.5～1 人天 | |
| 資料轉換與還原演練（M2、M3、§5-1） | 1～2 人天 | 降版演練失敗的話要再加 0.5～1 人天重新設計回退 |
| App Spec、測試環境部署、S3 隔離（M5、M7） | 1～1.5 人天 | 第一次使用 App Platform 的學習成本 |
| 寄信（M6） | 0～1.5 人天 | SMTP 能用就是 0；被擋要改程式和 DNS，還要等 DNS 生效 |
| QA 驗收（`QA測試.md`） | 0.5～1 人天 | InnoDB 交易行為改變，後台 CRUD 要完整測一次 |
| 切換與觀察 | 0.5～1 人天＋停機 0.5～2 小時 | 停機時間取決於資料量，演練後才能確定 |
| 關閉舊環境 | 0.25 人天 | |
| **合計** | **約 4.5～10 人天** | 不含等待 DNS、憑證簽發與客戶確認的時間 |

### 5-6. 風險摘要

| 風險 | 可能性 | 影響 | 對策 |
|---|---|---|---|
| MyISAM 轉 InnoDB 改變了交易行為 | 中 | 中 | QA 完整測表單與後台 CRUD |
| 8.4 → 8.0 降版回退失敗 | 中 | 高 | 演練；失敗就調整回退方案 |
| SMTP 被擋，而且因為有 fallback 沒有人發現 | 中 | 高（漏接客戶諮詢） | P4 必須實際寄信；上線後第一筆表單人工確認有收到信 |
| `req.ip` 錯誤，所有人共用 rate limit 額度 | 中 | 中（正常使用者被 429 擋下） | 部署後實測 |
| 健康檢查被前端 http→https 轉址弄失敗 | 低～中 | 中（無法部署） | `/healthz` 不經過 route middleware |
| 前端 512 MiB 記憶體不足 | 未知 | 中 | 情境 B 起步用 1 GiB |
| 測試環境刪到正式 S3 的圖 | 低（照第二階段做隔離） | 高 | 獨立 bucket、明確 Deny、Versioning |

---

## 6. 結論

### 目前足以決定的事項

1. **App Platform 的元件配置**：前端與後端各一個 **Service**；不需要 Worker、Job、Static Site、Spaces、Volume。
2. **前端必須維持 SSR**，靜態化是另外的功能改動。
3. **後端沿用現有 Dockerfile**，健康檢查用 `/health`；前端新增 `/healthz`。
4. **資料庫用 Managed MySQL Standard 單節點**，不買高可用（2026-11-30 後 Standard 不能加 standby，高可用要 $260／月起）。
5. **必改項目確定是 M1～M5、M7**；M6 依實測結果決定。
6. **一定要做 MyISAM → InnoDB 與 8.4 升級**，沒有其他選擇（除非不用 Managed MySQL，改自架）。這件事需要你核准。
7. DigitalOcean 本身的月費範圍：**$25～$64（起步），成長後 $138 起**。

### 仍需補充的資料

| # | 資料 | 用途 | 從哪裡取得 |
|---|---|---|---|
| 1 | **Zeabur 每月實際帳單**（前端、後端、MySQL 分開） | 算出搬遷後的淨增減 | Zeabur Billing |
| 2 | **前後端的 CPU、記憶體使用量**（最近 30 天的平均與高峰） | 決定 512 MiB 還是 1 GiB | Zeabur 監控 |
| 3 | **每月對外流量** | 確認是否在額度內 | Zeabur 監控、CloudFront 報表 |
| 4 | 正式 MySQL 版本、`sql_mode`、`time_zone`、容量、各表引擎 | 相容性與磁碟規格 | [第二階段 §E-3](change/Zeabur遷移Railway第二階段.md) 的唯讀查詢 |
| 5 | 每月表單與通知信數量 | 判斷寄信 API 用免費方案是否足夠 | DB 筆數（只看數量）、Gmail 寄件紀錄 |
| 6 | 是否核准 MyISAM → InnoDB | M2 能不能做 | 你決定 |
| 7 | App Platform 是否封鎖 SMTP | M6 要不要做 | 測試環境實測，或詢問 DigitalOcean 客服 |
| 8 | AWS S3／CloudFront、網域、Gmail 的現行費用 | 補齊「保留費用」 | 各自帳單 |
| 9 | DigitalOcean 是否加收稅金 | 補齊總價 | 建立帳號後的帳單設定 |
| 10 | DNS 代管商、根網域是否支援 ALIAS／CNAME flattening | DNS 切換方式 | 網域商 |
| 11 | Zeabur 暫停服務後是否仍計費 | 重疊費用 | Zeabur 文件或客服 |
| 12 | Railway `stunning-abundance` 是否在計費 | 清理既有費用 | Railway 帳號 |
| 13 | 可停機時段與可接受的停機長度 | 安排切換 | 你與客戶 |

---

## 參考來源（查詢日期 2026-10-23）

- DigitalOcean：[App Platform Pricing](https://www.digitalocean.com/pricing/app-platform)、[App Platform Pricing（docs）](https://docs.digitalocean.com/products/app-platform/details/pricing/)、[App Platform Limits](https://docs.digitalocean.com/products/app-platform/details/limits/)、[Health Checks](https://docs.digitalocean.com/products/app-platform/how-to/manage-health-checks/)
- DigitalOcean：[Managed Databases Pricing](https://www.digitalocean.com/pricing/managed-databases)、[MySQL Pricing（docs）](https://docs.digitalocean.com/products/databases/mysql/details/pricing/)、[MySQL Limits](https://docs.digitalocean.com/products/databases/mysql/details/limits/)、[MySQL 概覽（8.4 強制升級、Standard Edition 異動）](https://docs.digitalocean.com/products/databases/mysql/)、[設定 SQL Mode](https://docs.digitalocean.com/products/databases/mysql/how-to/set-sql-mode/)、[MySQL Config（Terraform，含 `default_time_zone`）](https://docs.digitalocean.com/reference/terraform/reference/resources/database_mysql_config/)、[匯入資料庫](https://docs.digitalocean.com/products/databases/mysql/how-to/import-databases)
- DigitalOcean：[Spaces Pricing](https://www.digitalocean.com/pricing/spaces-object-storage)、[Why is SMTP blocked?](https://docs.digitalocean.com/support/why-is-smtp-blocked/)
- 社群（非官方）：[Managed MySQL 無法使用 MyISAM](https://digitalocean.com/community/questions/how-to-enable-myisam-for-mysql-managed-database)、[Droplet 上 nodemailer 寄信失敗](https://www.digitalocean.com/community/questions/nodemailer-stopped-working-after-migrating-from-shared-hosting-to-a-digitalocean-droplet)
- 專案內：[Zeabur遷移Railway盤點.md](change/Zeabur遷移Railway盤點.md)、[Zeabur遷移Railway第二階段.md](change/Zeabur遷移Railway第二階段.md)
