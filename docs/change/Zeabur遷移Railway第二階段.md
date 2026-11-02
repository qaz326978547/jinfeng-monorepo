# Zeabur → Railway 遷移：第二階段｜搬遷計畫修正與還原演練準備

> 撰寫日期：2026-10-21
> 前一份：[Zeabur遷移Railway盤點.md](Zeabur遷移Railway盤點.md)（第一階段）。本文件與第一階段衝突時，以本文件為準。
> 範圍：只做本機唯讀確認。未連線正式環境、未切 DNS、未執行 migration、未建立任何雲端資源、未修改程式碼。
> 文件中所有指令都是**待審閱範本**，尚未執行。`<...>` 為佔位符，**請勿在本文件或任何 commit 中填入真實值**。
> 修訂 2026-10-21（審閱後）：腳本補上錯誤處理；線上演練的筆數差異改為記錄並解釋；移除對正式 bucket 的刪除測試；`DB_*` 改用 env 檔；回復演練對齊 Zeabur 的精確版本；停寫確認擴大範圍（§A-9）；新增 P0／P1 執行結果（§E）。

---

## 0. 對第一階段的更正

| 第一階段寫法 | 更正 | 依據 |
|---|---|---|
| 正式資料庫「另有 view 與 trigger」 | **view、trigger、stored routine 都是 0**（2026-07-21 唯讀檢查的結果）。仍須用 §C-1 的查詢重新確認，因為之後可能有人手動建立 | `backend/migrations/004_create_views.sql`、`005_create_triggers.sql` 檔頭註解 |
| 備份一律加 `--lock-tables`，不用 `--single-transaction` | 改為依情境選擇：演練用 `--single-transaction`，正式切換時先停止寫入再加 `--lock-tables`（見 §C-2） | 本文件 §C-2 |
| 回復時以「最大 ID」追蹤異動 | **不採用**。改為停寫後回復整份資料庫（見 §A-8） | 最大 ID 抓不到 UPDATE 和 DELETE |
| 測試環境換一組金鑰就能隔離 S3 | **不夠**。必須另開測試 bucket、限制權限、改寫複製資料庫裡的圖片網址（見 §A-3） | 刪除時用的 bucket 由環境變數決定，要刪的 key 則由資料庫決定 |
| 前端健康檢查設成 `/` | 改為另外新增 `/healthz`（見 §A-7） | 轉址規則和 SSR 會連帶依賴後端 |

**表引擎（以 migration 為準）：** 舊表 MyISAM 15 張，新表 InnoDB 11 張（含 `carousel`、`consultations`），字元集全部是 `utf8mb4_unicode_ci`。
**外鍵：** 1 條（`003_create_foreign_keys.sql`）。

---

## A. 修正版搬遷計畫

### A-1. 正式部署 commit（必要確認項）

- **在確認之前，不假設 `origin/main`（`fb05616`）就是正式版本。** 遠端參照的時間是本機最後一次 fetch 的時間：2026-10-21 17:33。
- 本機狀態（唯讀檢查）：
  - 目前分支 `feature/consultation-and-seminar-split` @ `ada346e`。
  - 本機 `main` 停在 `3357927`。
  - 只有**未追蹤**檔案，沒有已追蹤但未提交的修改：`docs/change/`、`docs/環境變數.md`、`docs/前端環境變數.md`、`需求說明.md`。
- **保護本機內容的原則：**
  - 不執行 `git pull`、`git checkout`、`git reset`、`git clean`。
  - 未追蹤檔不會被 fetch 影響。但 `git clean` 或切換到含同名檔案的分支會蓋掉它們。
  - 如果要先備份，請自己把這幾個檔案複製到 repo 外。`docs/環境變數.md` 可能含有秘密值，不要放進 git、也不要上傳到雲端硬碟。
- **確認方式（待審閱，都不會動到工作目錄）：**

```bash
# 1. 只更新遠端參照，不動工作目錄
git fetch origin

# 2. 拿到 Zeabur 頁面上顯示的 commit SHA 後（前後端各一個）：
git cat-file -t <ZEABUR_FRONTEND_SHA>            # 確認 commit 存在
git merge-base --is-ancestor <ZEABUR_FRONTEND_SHA> origin/main && echo "在 main 上"
git diff --stat <ZEABUR_FRONTEND_SHA> origin/main -- frontend   # 與 main 的差異

# 3. 需要檢視正式版本時，用另一個 worktree，不切換目前的分支
git worktree add ../jinfeng-prod-snapshot <ZEABUR_BACKEND_SHA>
```

- **通過條件：** 前後端的正式 SHA 都已記錄，並且知道它們和 `origin/main` 差在哪裡。如果正式版本不是 main，要另外決定：Railway 先部署跟正式**完全一樣的 SHA**（建議，符合「維持既有功能」），還是部署 main。

### A-2. 寄信：Railway 方案與 SMTP 限制

**事實：** Railway 官方文件說明，SMTP 只在 **Pro 以上**開放。Free、Trial、Hobby 方案會封鎖 port 25、465、587、2525，只能改用 HTTPS API 的寄信服務。社群回報指出，升級 Pro 之後要**重新部署**才會解除封鎖。目前程式是 nodemailer 走 SMTP（Gmail），**在 Hobby 上會直接寄不出去**；程式裡有 fallback，所以只會記一筆 log、不會報錯。

| | 方案一：Railway Pro + 保留 Gmail SMTP | 方案二：Railway Hobby + 改用 Resend HTTPS API |
|---|---|---|
| Railway 費用 | $20／人／月（含 $20 用量額度） | $5／月（含 $5 用量額度） |
| 寄信費用 | $0（沿用 Gmail） | Resend Free：$0，3,000 封／月、**每天上限 100 封**、1 個網域。超過要升級 Pro：$20／月，50,000 封 |
| 程式改動 | **不用改** | `mail-transport.ts` 從 SMTP 改成 Resend API（官方 SDK 或直接 `fetch`）；`env.ts` 和 `.env.example` 新增 `RESEND_API_KEY`；測試要一起改。估計 0.5～1 人天 |
| DNS 改動 | 不用 | 要在 `laborservice5690.com`（或寄信用的子網域）加 SPF、DKIM，建議也加 DMARC。這是**正式 DNS 的變更**，需要另外核准 |
| 寄件人 | 沿用 Gmail 帳號 | 必須改成已驗證網域的地址，例如 `no-reply@<已驗證網域>`，不能再用 gmail.com |
| 風險 | 社群有零星回報 Pro 升級後仍被擋，需要重新部署並實測 | 新網域剛開始寄信時信譽較低，通知信可能進垃圾信匣 |
| 和本次原則是否一致 | ✅ 維持既有功能、不改程式 | ⚠️ 會混入寄信程式的改動 |

**建議：** 這次遷移採方案一，「搬家」和「改程式」分開做。如果想把每月成本降下來，等搬遷穩定後再另開一張單改用 Resend。
**價格會變動**，決定前請到官網確認：[Railway Pricing](https://docs.railway.com/reference/pricing)、[Resend Pricing](https://resend.com/pricing)。

### A-3. 測試環境的 S3 隔離

**為什麼換金鑰不夠：** 刪除流程是先從資料庫讀出 `desktop_image_key` 和 `mobile_image_key`，再對 `AWS_S3_BUCKET` 送出 `DeleteObject`（`admin-carousel.service.ts`）。更新輪播時，舊圖也會被刪掉。只要測試環境的金鑰**有權限**碰正式 bucket，資料庫又是正式資料的複本，刪的就是正式的圖。

**規劃：**

1. **獨立的測試 bucket** `<TEST_BUCKET>`。最好放在另一個 AWS 帳號；至少要是不同 bucket。保持 Block Public Access 開啟。
2. **測試用 CloudFront**（用 OAC 連到測試 bucket），網址就是測試環境的 `AWS_S3_PUBLIC_BASE_URL`。如果暫時不開，上傳測試只能驗證 PUT 有沒有成功，看不到圖。
3. **測試 IAM user 的權限**：只允許測試 bucket，並**明確禁止**任何正式 bucket 的操作：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::<TEST_BUCKET>/carousel/*" },
    { "Effect": "Deny",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::<PROD_BUCKET>", "arn:aws:s3:::<PROD_BUCKET>/*"] }
  ]
}
```

4. **測試 bucket 的 CORS**：只允許 Railway 測試前端的網域，method 只開 `PUT`，header 只開 `Content-Type`。
5. **複製圖片（單向：正式 → 測試）**：由維運人員用另一組身分執行。這組身分對正式 bucket 只有讀取權（`s3:GetObject`、`s3:ListBucket`），對測試 bucket 有寫入權。**不可以加 `--delete`，也不可以把方向寫反**：

```bash
aws s3 sync s3://<PROD_BUCKET>/carousel/ s3://<TEST_BUCKET>/carousel/ --profile <ops-copy-profile>
```

6. **改寫測試資料庫裡的圖片網址**：只在測試資料庫執行，執行前先確認連到的是哪個資料庫：

```sql
SELECT DATABASE();   -- 必須是 <TEST_DB>，不是就停止
SELECT COUNT(*) FROM carousel
 WHERE desktop_image_url LIKE '<PROD_PUBLIC_BASE_URL>/%' OR mobile_image_url LIKE '<PROD_PUBLIC_BASE_URL>/%';
UPDATE carousel
   SET desktop_image_url = REPLACE(desktop_image_url, '<PROD_PUBLIC_BASE_URL>/', '<TEST_PUBLIC_BASE_URL>/'),
       mobile_image_url  = REPLACE(mobile_image_url,  '<PROD_PUBLIC_BASE_URL>/', '<TEST_PUBLIC_BASE_URL>/');
SELECT COUNT(*) FROM carousel WHERE desktop_image_url LIKE '<PROD_PUBLIC_BASE_URL>/%';  -- 應該是 0
```

   `*_image_key` 不用改，因為 key 會在 bucket 之間原樣複製。
7. **正式 bucket 的保護**：在測試開始前先開啟 **Versioning**（見 §A-8）。這樣就算隔離失效，刪掉的圖也還救得回來。
8. **測試資料庫的個資**：裡面有真實客戶資料和管理員的密碼雜湊。存取要限制在必要的人；演練結束後刪除，或改用去識別化的版本。

**驗證隔離：不對正式 bucket 做任何寫入或刪除測試。** 改用下面三種不會動到資料的方法：

```bash
# 1) 政策檢查：用 IAM Access Analyzer 驗證測試 user 的政策語法，並人工確認
#    Allow 只到 <TEST_BUCKET>/carousel/*，而且有對 <PROD_BUCKET> 的明確 Deny
aws accessanalyzer validate-policy --policy-type IDENTITY_POLICY --policy-document file://test-s3-policy.json

# 2) IAM 模擬：只計算權限，不會真的送出請求。對正式 ARN 的每個動作都必須是 explicitDeny
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::<ACCOUNT_ID>:user/<TEST_IAM_USER> \
  --action-names s3:PutObject s3:DeleteObject s3:GetObject s3:ListBucket \
  --resource-arns arn:aws:s3:::<PROD_BUCKET> arn:aws:s3:::<PROD_BUCKET>/carousel/x \
  --query 'EvaluationResults[].[EvalActionName,EvalResourceName,EvalDecision]' --output table
#    再對 <TEST_BUCKET>/carousel/x 模擬一次：Put、Get、Delete 都應該是 allowed

# 3) 非破壞性的實際請求（用測試金鑰的 profile，只讀）：預期 403／AccessDenied
aws s3api head-bucket --bucket <PROD_BUCKET> --profile <test-app-profile>
aws s3api list-objects-v2 --bucket <PROD_BUCKET> --max-items 1 --profile <test-app-profile>
```

- 第 2 步需要操作者有 `iam:SimulatePrincipalPolicy` 權限，用的是**維運身分**，不是測試 user。
- 部署測試環境前，再確認 Railway 測試服務的 `AWS_S3_BUCKET` 是 `<TEST_BUCKET>`。

**通過條件：**
- 政策檢查沒有錯誤。
- 模擬結果裡，正式 ARN 的所有動作都是 `explicitDeny`，測試 ARN 的動作都是 `allowed`。
- 非破壞性請求都回 403。
- 測試資料庫裡沒有任何指向正式 CDN 的輪播網址。

### A-4. 正式資料庫唯讀盤點

查詢內容見 **§C-1**。原則：

- 只查 metadata：`information_schema` 和系統變數。**不 SELECT 客戶資料表、`users`、`oauth_*`、`password_resets`**。
- 筆數分兩種：
  - **估計值**：`information_schema.TABLES.TABLE_ROWS`。MyISAM 是精確值，InnoDB 只是估計，平常就能查。
  - **精確值**：`COUNT(*)`。MyISAM 不帶 WHERE 時直接讀 metadata，很快；InnoDB 要掃整張表。先看估計值，再挑離峰時間對**指定的表**跑。
- 不執行 `ANALYZE TABLE`、`OPTIMIZE TABLE`、`CHECK TABLE`。它們會鎖表或寫入統計資料。

### A-5. 一致性備份

方法與指令見 **§C-2**。重點：MyISAM 不支援交易，`--single-transaction` 只對 InnoDB 有效。**唯一能保證跨引擎一致的做法是先停止寫入**，所以正式切換一定要先停 Zeabur backend 再 dump。

### A-6. 搬遷階段總覽（修正版）

| 階段 | 內容 | 影響正式環境？ | 需要你核准？ |
|---|---|---|---|
| P0 | 確認正式 SHA，保護本機檔案（§A-1） | 否 | — |
| P1 | 在正式資料庫跑唯讀盤點（§C-1） | 唯讀、負載極低 | 是（要連正式資料庫） |
| P2 | 決策：Railway 方案和寄信（§A-2）；Railway MySQL 版本和正式**同一個主版本**（§C-2-4） | 否 | 是 |
| P3 | 隔離還原演練：Railway 測試 project、測試 bucket（§C-3） | 只讀正式資料庫和正式 bucket | 是（會產生費用） |
| P4 | 測試部署與驗收；新增前端 `/healthz`（§A-7，需要改程式） | 否 | 是（程式改動） |
| P5 | 切換前準備：調低 DNS TTL、開啟正式 bucket Versioning、發新的 AWS 和 Gmail 金鑰、建 Railway 正式 project | 調 TTL 和開 Versioning 不影響功能 | 是 |
| P6 | 停寫切換：停 Zeabur backend → 最終 dump → 還原 → 驗證 → 切 DNS | **會停機** | 是 |
| P7 | 觀察 24～72 小時 | — | — |
| P8 | Zeabur 先暫停（不刪除）保留 1～2 週 → 停用舊金鑰 → 刪除 | 是 | 是 |

**P6 的細節：**

1. 公告維護時段。
2. **停止 Zeabur backend**：前台表單和後台會暫時無法使用，前台頁面仍然顯示，但首頁輪播可能因為抓不到後端而受影響。
3. **停寫確認**：照 §A-9 逐項確認。只看 backend 和 PROCESSLIST 是不夠的。
4. 最終 dump（§C-2，切換模式）。
5. 還原到 Railway，跑驗證（§C-3 第 6 步）。
6. 在 Zeabur 端也跑 `CHECKSUM TABLE`，兩邊比對（Zeabur 已經停止寫入，跑這個不影響服務）。
7. 啟動 Railway backend。
8. 切 DNS。DNS 生效期間，Zeabur 前端仍可能收到流量，兩種做法擇一：讓 Zeabur 前端的 API 指向 Railway 後端；或者讓它保持在後端停機狀態。**Zeabur backend 不可以再啟動。**

### A-7. 健康檢查與前端轉址

**事實：** Railway 的健康檢查請求，Host header 是 `healthcheck.railway.app`，而且必須回 **200** 才算通過（[官方文件](https://docs.railway.com/reference/healthchecks)）。

| 檢查項目 | 結果 |
|---|---|
| 後端 `/health` | 沒有 Host 過濾，也不會轉址。CORS 只針對帶 `Origin` header 的請求，健康檢查不受影響。✅ 沿用 `/health`（不要用 `/ready`，否則資料庫還沒還原前就無法部署） |
| 前端 `redirect-www.global.ts` | 只在 `NODE_ENV=production` 時生效。Host 不是 `www.` 開頭，所以 Host 這部分沒問題。**但如果健康檢查的請求帶了 `x-forwarded-proto: http`，就會被 301 轉到 `https://healthcheck.railway.app/`，健康檢查失敗。** Railway 內部的健康檢查請求有沒有帶這個 header 未知 → **待實測** |
| 前端 `/` | 會跑完整 SSR，還要呼叫後端抓輪播資料。如果拿來當健康檢查，**前端能不能部署成功會被後端狀態綁住**，而且回應比較慢 |
| `server/middleware/blockBadPaths.ts` | 附帶發現：`allowedPatterns` 裡有 `'/'`，所有路徑都符合，**這個 middleware 實際上不會擋任何請求**。不影響健康檢查。這次不修，記錄下來另外處理 |

**方案：新增獨立的健康檢查路徑 `/healthz`（P4 實作，需要核准）**

- 新增 Nitro server route `frontend/server/routes/healthz.get.ts`，直接回 `200 { status: 'ok' }`。**不呼叫後端，不碰 SSR。**
- Server route 不會經過 Nuxt 的 route middleware（`redirect-www`、`auth` 等），所以不受 Host 和 `x-forwarded-proto` 影響。Server middleware 會跑 `helmet` 和 `blockBadPaths`，但兩者都不會擋這個路徑。
- Railway 前端服務的 Healthcheck Path 設成 `/healthz`。
- sitemap 模組只收錄 pages，推測不會收錄 server route，部署後要確認 `/sitemap.xml` 裡沒有它。
- 改動很小，只新增一個檔案、不改既有行為，符合「不重構」原則。

---

## B. 我需要你補充的最少資訊

| # | 項目 | 用途 | 卡住哪個階段 |
|---|---|---|---|
| 1 | ~~前後端的 commit SHA~~ → GitHub 紀錄顯示兩者都是 `fb05616`（§E-1）。**只剩**在 Zeabur Deployments 頁確認 Running 的是這筆、綁定的分支，以及前端 `NUXT_PUBLIC_API_BASE_URL` 指向哪個網域 | 決定 Railway 要部署哪個版本 | P0 |
| 2 | Zeabur MySQL 能不能從外部連線（有沒有公開 port），從哪台機器連；那個帳號有沒有 `LOCK TABLES` 和 `CREATE` 權限 | dump、盤點、回復到新資料庫都需要 | P1、P3 |
| 3 | §C-1 查詢的輸出結果（只有 metadata，可以直接貼給我） | 確認版本、時區、引擎、容量 | P2 |
| 4 | Railway 方案選哪一個：Pro 保留 Gmail，或 Hobby 改用 Resend | 決定要不要改寄信程式和 DNS | P2 |
| 5 | AWS：正式 bucket 有沒有開 Versioning；可不可以建立測試 bucket、IAM user、測試 CloudFront | 測試隔離與 S3 回復 | P3 |
| 6 | 可以停機的時段，以及能接受停多久 | 安排 P6 | P6 |

第一階段表格裡的其他項目（DNS 代管商、CloudFront 網址、SPF/DKIM 等）可以到 P5 前再補。

---

## C. 資料庫備份與隔離還原演練步驟

### C-1. 正式資料庫唯讀盤點查詢（待審閱，尚未執行）

> 連線用的帳密請放在權限 600 的 option file 裡（`--defaults-extra-file`），**不要寫在指令列上**，避免留在 shell history 和 process list。
> 最好使用只有 `SELECT` 權限的帳號。

```sql
-- 1) 版本與伺服器設定
SELECT VERSION() AS version, @@version_comment AS distribution,
       @@global.sql_mode  AS global_sql_mode,  @@session.sql_mode  AS session_sql_mode,
       @@global.time_zone AS global_tz, @@session.time_zone AS session_tz, @@system_time_zone AS system_tz,
       NOW() AS now_session, UTC_TIMESTAMP() AS now_utc,
       @@lower_case_table_names AS lower_case_table_names,
       @@character_set_server, @@collation_server,
       @@character_set_database, @@collation_database,
       @@default_storage_engine, @@explicit_defaults_for_timestamp,
       @@event_scheduler;
-- 以下這兩個變數在某些發行版不存在，單獨查，報錯可以忽略
SELECT @@gtid_mode;
SELECT @@log_bin;

-- 2) 資料庫預設字元集
SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
  FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE();

-- 3) 每張表：引擎、估計筆數、容量（不讀資料列）
SET SESSION information_schema_stats_expiry = 0;   -- MySQL 8：避免讀到快取的統計；只影響這個連線
SELECT TABLE_NAME, ENGINE, ROW_FORMAT,
       TABLE_ROWS AS est_rows,  -- MyISAM 是精確值；InnoDB 是估計值
       ROUND(DATA_LENGTH/1024/1024, 2)  AS data_mb,
       ROUND(INDEX_LENGTH/1024/1024, 2) AS index_mb,
       AUTO_INCREMENT, TABLE_COLLATION, UPDATE_TIME
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
 ORDER BY TABLE_NAME;

SELECT ENGINE, COUNT(*) AS tables,
       ROUND(SUM(DATA_LENGTH + INDEX_LENGTH)/1024/1024, 2) AS total_mb
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() GROUP BY ENGINE;

-- 4) 欄位層級和預設不同的 collation（預期 0 筆）
SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND COLLATION_NAME IS NOT NULL
   AND COLLATION_NAME <> 'utf8mb4_unicode_ci';

-- 5) view、trigger、routine、event 與 DEFINER（預期全部 0 筆）
SELECT TABLE_NAME, DEFINER, SECURITY_TYPE FROM information_schema.VIEWS    WHERE TABLE_SCHEMA   = DATABASE();
SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE, DEFINER FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE();
SELECT ROUTINE_NAME, ROUTINE_TYPE, DEFINER FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE();
SELECT EVENT_NAME, STATUS, DEFINER         FROM information_schema.EVENTS   WHERE EVENT_SCHEMA   = DATABASE();

-- 6) migration 紀錄：先確認表存在，存在才查
SELECT TABLE_NAME FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('node_schema_migrations', 'migrations', 'carousel', 'consultations');
SELECT filename, applied_at FROM node_schema_migrations ORDER BY filename;   -- 表存在才執行
SELECT MAX(batch) AS laravel_last_batch, COUNT(*) AS laravel_migrations FROM migrations;  -- Laravel 遺留，存在才執行

-- 7) 目前帳號的權限（MySQL 8 的輸出不含密碼）
SHOW GRANTS FOR CURRENT_USER();

-- 8) 目前的連線（確認有沒有應用程式以外的連線；停寫後也用這個確認）
SELECT USER, HOST, DB, COMMAND, TIME FROM information_schema.PROCESSLIST WHERE DB = DATABASE();
```

**精確筆數（第 3 步確認規模後，挑離峰時間跑）：**

```sql
-- MyISAM 表：直接讀 metadata，幾乎沒有成本
-- InnoDB 表：會掃描，只在估計值 < 數十萬筆時直接跑
-- 只輸出數字，不輸出資料內容
SELECT 'contact' AS t, COUNT(*) AS n, MAX(id) AS max_id FROM contact
UNION ALL SELECT 'consultations', COUNT(*), MAX(id) FROM consultations
UNION ALL SELECT 'carousel',      COUNT(*), MAX(id) FROM carousel;
-- 依第 3 步的表名清單補齊其他表；沒有 id 欄位的表就拿掉 MAX(id)
```

### C-2. 一致性備份（待審閱，尚未執行）

**C-2-1. 兩種模式**

| | 演練模式（P3） | 切換模式（P6） |
|---|---|---|
| 正式服務 | 照常運作 | **已經停止 Zeabur backend** |
| 參數 | `--single-transaction` | `--lock-tables`（`--opt` 預設就有） |
| 一致性 | InnoDB 一致；MyISAM 在 dump 期間如果有人寫入，可能和 InnoDB 不同步 | 完全一致（因為沒有寫入） |
| 對正式服務的影響 | 不鎖表，只多一些 I/O | 鎖住期間所有寫入都會卡住。但服務已經停了，所以沒影響 |
| 用途 | 驗證流程和相容性；資料不需要和正式完全同步 | 正式資料的最終版本 |

**服務正常運作時不要用 `--lock-tables`：** 它會對整個資料庫加 READ lock，dump 期間前台表單送出、後台編輯都會卡住，等到 dump 結束才會繼續或逾時。資料量小的話可能只卡幾秒，但最好不要在線上做。
`--lock-all-tables`（`FLUSH TABLES WITH READ LOCK`）需要 `RELOAD` 權限，代管的資料庫通常不給，這裡不採用。

**C-2-2. 需要的權限（dump 帳號）**

| 權限 | 為什麼需要 |
|---|---|
| `SELECT` | 讀資料 |
| `LOCK TABLES` | 切換模式的 `--lock-tables` |
| `SHOW VIEW` | 有 view 才需要（預期沒有） |
| `TRIGGER` | `--triggers` |
| `EVENT` | `--events` |
| `PROCESS` | 不加 `--no-tablespaces` 時才需要；下面的指令有加，所以不需要 |

**C-2-3. 指令範本**

連線資訊放在 option file（權限 600、放在 repo 外、用完就刪）：

```ini
# ~/secure/zeabur-ro.cnf
[client]
host=<ZEABUR_DB_HOST>
port=<ZEABUR_DB_PORT>
user=<DUMP_USER>
password=<不要寫進任何文件>
```

**備份腳本** `~/secure/dump.sh`（放在 repo 外）：

```bash
#!/usr/bin/env bash
# 用法：dump.sh rehearsal|cutover <DB_NAME>
set -euo pipefail
umask 077

MODE="${1:?mode: rehearsal|cutover}"
DB="${2:?db name}"
CNF="$HOME/secure/zeabur-ro.cnf"
TS="$(date +%Y%m%d_%H%M%S)"
OUT="$HOME/secure/dump_${MODE}_${TS}.sql.gz"
ERR="$HOME/secure/dump_${MODE}_${TS}.stderr.log"

[ "$(stat -f '%Lp' "$CNF" 2>/dev/null || stat -c '%a' "$CNF")" = "600" ] || { echo "cnf 權限必須是 600" >&2; exit 2; }

case "$MODE" in
  rehearsal) LOCK_OPT="--single-transaction" ;;
  cutover)   LOCK_OPT="--lock-tables" ;;   # 只在 §A-9 停寫確認全部通過後才可使用
  *) echo "unknown mode" >&2; exit 2 ;;
esac

mysqldump --version >&2   # client 主版本必須 >= server 主版本

# pipefail：只要 mysqldump 或 gzip 任一個失敗，整條 pipeline 就會失敗
if ! mysqldump --defaults-extra-file="$CNF" $LOCK_OPT \
      --routines --triggers --events \
      --no-tablespaces --set-gtid-purged=OFF \
      --default-character-set=utf8mb4 --hex-blob --tz-utc \
      "$DB" 2>"$ERR" | gzip -c > "$OUT"; then
  echo "FAIL: mysqldump/gzip 的退出碼不是 0，看 $ERR" >&2; exit 1
fi

# stderr 有任何內容都要人工看過；有 error 或 warning 就直接判定失敗
if [ -s "$ERR" ]; then
  if grep -qiE 'error|warning|denied|couldn.t' "$ERR"; then
    echo "FAIL: stderr 有錯誤或警告，看 $ERR" >&2; exit 1
  fi
  echo "NOTE: stderr 有其他內容，請人工確認 $ERR" >&2
fi

gzip -t "$OUT" || { echo "FAIL: gzip -t 檢查失敗" >&2; exit 1; }

# mysqldump 正常結束時，最後一行會是 "-- Dump completed on ..."
gzip -dc "$OUT" | tail -n 1 | grep -q '^-- Dump completed' \
  || { echo "FAIL: 找不到 Dump completed 結尾，dump 可能中途斷掉" >&2; exit 1; }

shasum -a 256 "$OUT" > "$OUT.sha256"
echo "OK: $OUT"
```

- 以下四項全部通過，才算備份成功：**退出碼是 0、stderr 沒有錯誤、`gzip -t` 通過、結尾有 `Dump completed`**。
- **sha256 只用來確認檔案之後沒有被改動或損毀**，不能拿來證明 dump 成功。

- 指令裡**不加 `--databases`**，dump 檔就不會帶 `CREATE DATABASE` 和 `USE`，可以還原到任何名稱的資料庫（回復時會用到）。
- 如果 server 是 5.7、client 是 8.x，要加 `--column-statistics=0`。
- 如果 server 不是 MySQL 而是 MariaDB（看第 1 步的 `version_comment`），要拿掉 `--set-gtid-purged`。
- dump 檔裡有個資：只放在加密磁碟，**不要放進 repo、聊天訊息或雲端硬碟**。

**C-2-4. 版本與 DEFINER 相容性檢查**

| 檢查 | 規則 | 不符合時怎麼辦 |
|---|---|---|
| 主版本 | Railway MySQL 必須和正式**同一個主版本**（例如都是 8.0）。往上升級（8.0 → 9.x）通常可以還原，**但回復時要從 Railway 倒回 Zeabur，降版本會失敗** | 用 Railway 的 MySQL template 指定 image 版本，對齊正式 |
| `lower_case_table_names` | 兩邊一樣。MySQL 8 **只能在初始化時設定**，之後不能改 | 表名都是小寫，風險低，但還是要比對 |
| `sql_mode` | Railway 的 global sql_mode 要設成和正式一樣。dump 檔匯入時會暫時放寬，但應用程式執行時是看 global 的值 | 在 Railway MySQL 設定 `sql_mode` |
| `time_zone` | Railway 的 global time_zone 要和正式一樣。`--tz-utc` 會保護 TIMESTAMP 的值，但後端設了 `dateStrings: true`，讀出來的時間字串是依連線時區，時區不同前台顯示的時間就會差 | 設定 `default-time-zone` |
| 預設 collation | 表和欄位都明確寫了 `utf8mb4_unicode_ci`，不會被 8.0 預設的 `utf8mb4_0900_ai_ci` 影響。第 4 步查詢會再確認 | — |
| MyISAM | MySQL 8.x 仍然支援，可以原樣保留。不要在這次搬遷順便改引擎 | — |
| DEFINER | 預期沒有任何 view、trigger、routine、event。如果第 5 步查到了，還原帳號沒有 `SET_USER_ID`（或 `SUPER`）權限時會失敗 | 還原前用 sed 拿掉 dump 檔中的 `DEFINER=...@...` 子句，或在目標資料庫建立同名帳號。**改完先檢查再匯入** |
| GTID | `--set-gtid-purged=OFF` 避免 dump 檔帶 `SET @@GLOBAL.GTID_PURGED`（那需要 SUPER 權限） | — |

### C-3. 隔離還原演練（P3，需要核准，會產生費用）

1. **建立隔離環境**：一個新的 Railway project，例如 `jinfeng-rehearsal`，**只放 MySQL**，版本照 C-2-4 對齊正式。這個 project 不跟正式 project 共用。
2. **依 C-2-4 設定**目標資料庫的 `sql_mode`、`time_zone`、`lower_case_table_names`，再用 §C-1 第 1 步的查詢確認。
3. **dump**：用演練模式（C-2-3）。
4. **還原**到 `<TEST_DB>`。腳本 `~/secure/restore.sh`：

```bash
#!/usr/bin/env bash
# 用法：restore.sh <dump.sql.gz> <target.cnf> <TARGET_DB>
set -euo pipefail
umask 077
DUMP="${1:?dump}"; CNF="${2:?cnf}"; DB="${3:?target db}"
ERR="${DUMP%.sql.gz}.restore_${DB}.stderr.log"

shasum -a 256 -c "$DUMP.sha256"                   # 確認檔案和備份當時一樣
gzip -t "$DUMP"

# 防呆：目標資料庫必須存在，而且裡面還沒有任何表
N=$(mysql --defaults-extra-file="$CNF" -N -e \
  "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB'")
[ "$N" = "0" ] || { echo "FAIL: 目標 $DB 裡已經有 $N 張表，拒絕還原" >&2; exit 1; }

START=$(date +%s)
if ! gzip -dc "$DUMP" | mysql --defaults-extra-file="$CNF" --show-warnings "$DB" 2>"$ERR"; then
  echo "FAIL: 還原的退出碼不是 0，看 $ERR" >&2; exit 1
fi
if [ -s "$ERR" ]; then
  echo "FAIL: stderr 有內容（含 warning），請人工檢查 $ERR" >&2; exit 1
fi
echo "OK: 還原花了 $(( $(date +%s) - START )) 秒"
```

5. **記錄還原花了多久**，拿來估算 P6 的停機時間。
6. **驗證**：
   - 在測試資料庫跑 §C-1 的第 3～6 步，和正式的結果逐項比對：表名、引擎、collation、view、trigger、routine 數量、migration 紀錄。**結構必須完全一致。**
   - **筆數（線上演練）：**
     - 來源和目標的查詢時間不同，演練用的又是線上 dump，**不要求一致**，包括 MyISAM。
     - **但差異不可以直接忽略**：每張表都要記下來源查詢的時間、dump 開始的時間、目標查詢的時間、兩邊的筆數和 `MAX(id)`，以及差了多少。
     - 差異要能用「dump 開始之後正式環境有新的寫入」解釋：該表的 `UPDATE_TIME` 晚於 dump 開始時間，或者差異都落在 `MAX(id)` 之後。
     - **解釋不了的差異（例如目標比來源多，或差的不是新增）就停下來查清楚。**
     - 嚴格一致性只在 P6 停寫切換時驗證。
   - **`db:verify`（只會讀）：** 不在指令列放 `DB_*`。改用權限 600 的 env 檔，在 subshell 裡載入，跑完不會留在目前的 shell：

```bash
# ~/secure/railway-test.env（chmod 600，放在 repo 外）
#   NODE_ENV=development
#   DB_HOST=<RAILWAY_TEST_DB_HOST>
#   DB_PORT=<PORT>
#   DB_USER=<USER>
#   DB_PASSWORD=<不要寫進任何文件>
#   DB_DATABASE=<TEST_DB>
#   JWT_SECRET=<loadEnv 要求至少 16 字元；這裡只用來通過驗證，填一組本機隨機產生、不會用在任何環境的值>
( set -a; . "$HOME/secure/railway-test.env"; set +a; cd backend && npm run db:verify ); echo "exit=$?"
```

     `db:verify` 比對的是 001～005 的舊 schema 快照，不包含 `carousel` 和 `consultations`。這兩張表用 §C-1 第 3、4 步的結果比對。
   - 抽查幾筆日期欄位，確認時區沒有跑掉。只看日期欄位，不輸出個資欄位。
7. **S3 隔離**：照 §A-3 第 1～6 步做。
8. **部署測試用的後端和前端**（P4）：
   - `MAIL_HOST` 留空。
   - S3 用測試 bucket 和測試金鑰。
   - `NUXT_PUBLIC_SITE_URL` 和 `CORS_ALLOWED_ORIGINS` 設成測試網域。
   - `NUXT_PUBLIC_GTM_ID` 留空。
9. **回復演練（Railway → Zeabur 方向）：**
   - 把測試資料庫再 dump 一次（用 `dump.sh`，cnf 指向測試資料庫）。
   - 還原的目標**必須和 Zeabur 的精確版本、設定一致**，因為真的要回復時，目的地就是 Zeabur：
     - 版本要對到 patch，例如 `8.0.x` 的 x 也要一樣。
     - `sql_mode`、`time_zone`、`lower_case_table_names`、字元集，用 §C-1 第 1 步在 Zeabur 查到的值。
   - 免費的做法：在本機 Docker 跑一個一樣版本的 MySQL。本機磁碟必須有加密（FileVault），演練完要把容器和 volume 刪掉：

```bash
docker run -d --name jinfeng-rollback-drill -p 127.0.0.1:3307:3306 \
  -e MYSQL_RANDOM_ROOT_PASSWORD=yes \
  mysql:<ZEABUR_EXACT_VERSION> \
  --sql-mode='<ZEABUR_GLOBAL_SQL_MODE>' \
  --default-time-zone='<ZEABUR_GLOBAL_TZ>' \
  --lower-case-table-names=<ZEABUR_LCTN> \
  --character-set-server=<ZEABUR_CHARSET> --collation-server=<ZEABUR_COLLATION>
# root 密碼在容器 log 的 "GENERATED ROOT PASSWORD" 那一行，自己查看後寫進權限 600 的 cnf，不要貼到任何地方
```

   - 用 `restore.sh` 還原，再跑第 6 步的驗證。**這次結構和筆數都必須和測試資料庫完全一致**，因為來源已經不會再有寫入。
   - 這一步驗證的是 §A-8：「從 Railway 整份倒回 Zeabur 的版本」行得通。
10. **清理**：刪除測試資料庫和本機 dump 檔（個資），**保留紀錄**：花了多久、比對結果、遇到的問題。

---

## A-8. 回復方案（修正版）

**原則：不靠最大 ID 追蹤異動。** 最大 ID 只抓得到新增，抓不到下面這些：

- UPDATE：後台改 FAQ、改課程、調整輪播排序。
- DELETE。
- 舊的 MyISAM 表沒有資料庫層級的 `updated_at` 預設值，是應用程式手動寫入的，不能完全依賴。

**改用「停止寫入，再整份資料庫回復」。**

| 時間點 | 回復方式 |
|---|---|
| **切換前**（P0～P5） | 正式環境沒有動過，捨棄 Railway 資源即可 |
| **P6 進行中**（Railway 還沒對外開放） | 不要啟動 Railway backend。重新啟動 Zeabur backend，DNS 不動。Zeabur 資料庫從停止寫入後就沒變過，可以直接使用 |
| **切換後，Railway 已經收到資料** | 見下面步驟 |

**切換後的回復步驟：**

1. **停止 Railway backend**，再依 §A-9 確認 Railway 端也完全停止寫入（服務、人工操作、events）。
2. 用切換模式（`--lock-tables`）**dump 整個 Railway 資料庫**。這份 dump 是「正式資料 + 切換後所有新增、修改、刪除」的完整狀態，不需要另外追蹤異動。
3. **還原到 Zeabur MySQL 上的新資料庫** `<PROD_DB>_rollback_<日期>`。**不要覆寫原本的資料庫**，原本那份要留著當作切換當下的備份。這需要 Zeabur 帳號有 `CREATE` 權限（見 B-2）；沒有的話，就在 Zeabur 開一個新的 MySQL service。
4. 跑 §C-3 第 6 步的驗證。
5. 把 Zeabur backend 的 `DB_DATABASE` 改成新資料庫，啟動 Zeabur backend，DNS 切回去。
6. **前提：Railway MySQL 和 Zeabur 是同一個主版本**，否則第 3 步可能因為降版本而失敗。這就是 C-2-4 要求對齊版本的原因。

**S3 已刪除物件的復原：**

- 資料庫整份回復之後，資料庫和 S3 的狀態是一致的：Railway 期間刪掉的輪播，資料庫裡也已經不在了。所以一般回復**不需要救回物件**。
- 需要救回物件的情況：
  - 回復到的是**切換前的舊資料庫**，裡面的紀錄指向 Railway 期間被刪掉的圖。
  - 誤刪。
  - 測試隔離失效。
- **前提：P5 時正式 bucket 已經開啟 Versioning。**
  - 開啟不會影響現有物件。開了之後只能暫停、不能關閉。
  - 刪除只會留下 delete marker，舊版本還在，但會一直計費。建議設 lifecycle 規則：非最新版本 30～60 天後自動刪除。
  - 加上這個雙重保險：P6 前把 `carousel/` 單向複製一份到備份位置（`aws s3 sync`，**不加 `--delete`**）。
- 復原指令（待審閱）：

```bash
# 列出切換時間之後在 carousel/ 下面產生的 delete marker
aws s3api list-object-versions --bucket <PROD_BUCKET> --prefix carousel/ \
  --query "DeleteMarkers[?IsLatest && LastModified>='<CUTOVER_ISO8601>'].[Key,VersionId]" --output text

# 逐一刪掉 delete marker，物件就會恢復成上一個版本（先人工核對清單再執行）
aws s3api delete-object --bucket <PROD_BUCKET> --key <KEY> --version-id <DELETE_MARKER_VERSION_ID>
```

**其他：**

- 寄信：已經寄出的通知信不用處理。
- 登入：如果新舊環境的 `JWT_SECRET` 一樣，回復後使用者不用重新登入。

---

## A-9. 停寫確認（P6 和回復時都要做）

只停 backend、只看 PROCESSLIST 都不夠。全部勾完，才可以用切換模式 dump。

| # | 寫入來源 | 怎麼確認 |
|---|---|---|
| 1 | Zeabur backend | 服務狀態是 Suspended／Stopped，對外網址打 `/health` 確認沒有回應 |
| 2 | **同一個 Zeabur project 裡的其他服務** | 在 Zeabur project 頁面列出所有服務，逐一檢查環境變數有沒有指向這個資料庫（看變數名稱和 host 即可）。特別注意：舊的 Laravel 服務（舊文件記載 `jinfengv2.zeabur.app`），以及前端服務是否有設定 `DB_*` |
| 3 | **其他平台** | 已經存在的 Railway project `stunning-abundance`（見 §E）、本機或其他機器上的 `.env`、CI 有沒有設定資料庫連線 |
| 4 | **人工寫入** | 公告維護期間禁止透過 Zeabur 資料庫管理介面、DB GUI（TablePlus、DBeaver 等）手動修改資料；確認誰手上有資料庫帳密 |
| 5 | **資料庫 events** | `SELECT @@event_scheduler;` 加上 §C-1 第 5 步的 EVENTS 查詢。有 event 而且 scheduler 是 ON 的話，要經過核准才能暫停（`ALTER EVENT ... DISABLE`，或請平台關閉 scheduler） |
| 6 | **連線**（多次取樣） | 每 1 分鐘查一次 PROCESSLIST，至少查 5 次。除了自己這次盤點用的連線以外，不能有其他連線。看的是 `USER`、`HOST`、`DB`、`COMMAND`，不看 `INFO` 欄位（可能帶有資料） |
| 7 | **實際有沒有寫入**（不靠連線判斷） | 相隔 5 分鐘以上查兩次，兩次結果必須完全一樣：(a) 每張表的 `UPDATE_TIME` 和 `TABLE_ROWS`；(b) 如果 `log_bin` 是 ON，而且帳號有 `REPLICATION CLIENT` 權限，比對 binlog 位置有沒有前進（8.0：`SHOW MASTER STATUS`；8.4 以上：`SHOW BINARY LOG STATUS`） |
| 8 | （選用，需要核准）強制唯讀 | 把應用程式帳號的 `INSERT`、`UPDATE`、`DELETE` 權限暫時拿掉，或設定 `read_only`。這會修改正式設定，代管的 MySQL 也不一定允許，**本輪不做**，P6 前另外決定 |

**通過條件：** 1～7 全部確認完成，而且第 6、7 項的兩次取樣都沒有變化。

---

## D. 各階段通過條件

| 階段 | 通過條件（全部符合才進下一階段） |
|---|---|
| P0 正式版本 | 前後端的正式 SHA 已記錄；和 `origin/main` 的差異已經列出；決定好 Railway 要部署哪個 SHA；本機的未追蹤檔還在 |
| P1 唯讀盤點 | §C-1 全部有結果；版本、`sql_mode`、兩種 `time_zone`、`lower_case_table_names`、字元集都已記錄；view、trigger、routine、event 的數量已確認；知道 006 和 007 有沒有上線；有容量和估計筆數 |
| P2 決策 | 選定 Railway 方案（A-2）；確定 Railway MySQL 版本，和正式同一個主版本；如果選方案二，另開寄信改動的工作 |
| P3 還原演練 | `dump.sh` 和 `restore.sh` 的四項成功檢查都通過（退出碼、stderr、`gzip -t`、`Dump completed`）；結構比對全部一致；筆數差異每一筆都有紀錄而且解釋得通（沒有解釋不了的差異）；`db:verify` 的 exit 是 0；日期時區抽查正確；回復演練（還原到和 Zeabur 精確版本、設定一致的環境）結構和筆數完全一致；記錄 dump 和還原各花多久 |
| P3 S3 隔離 | 政策檢查沒有錯誤；IAM 模擬結果是正式 ARN 全部 explicitDeny、測試 ARN 全部 allowed；用測試金鑰對正式 bucket 的非破壞性請求都回 403；測試資料庫沒有正式 CDN 網址；測試環境的上傳、更新、刪除都只影響測試 bucket。**全程沒有對正式 bucket 做任何寫入或刪除** |
| P4 測試部署 | 前端 `/healthz` 和後端 `/health` 都讓 Railway 部署成功；`QA測試.md` 的項目全部通過；www 和 http 轉址正常；sitemap 沒有收錄 `/healthz`；寄信方案實測成功（方案一：Pro 上用 Gmail 寄到測試信箱；方案二：Resend 寄出，SPF 和 DKIM 都通過） |
| P5 切換前準備 | DNS TTL 已經調低並等過舊的 TTL；正式 bucket Versioning 已開啟，`carousel/` 備份完成；新的 AWS 和 Gmail 金鑰已發，**舊的還沒停用**；Railway 正式 project 的環境變數名稱逐一核對過；停機時段已公告 |
| P6 切換 | §A-9 停寫確認全部通過；最終 dump 的 sha256 已記錄；還原後兩邊的筆數和 `CHECKSUM TABLE` 一致（版本相同時才比 checksum；版本不同就比筆數 + `MAX(id)` + 抽樣）；Railway 的 `/health` 和 `/ready` 都正常；DNS 生效後，正式網域上的表單送出能寫進 Railway 資料庫，也收得到通知信 |
| P7 觀察 | 24～72 小時沒有 5xx 激增；表單、通知信、後台 CRUD、輪播上傳和刪除都正常；GTM 有流量；Search Console 沒有新的錯誤；Zeabur backend 在這段期間一直都沒有被啟動 |
| P8 關閉 | 保留期已滿；最終 dump 已經歸檔，存放在加密的地方；舊的 AWS 和 Gmail 金鑰已停用；Zeabur 服務已刪除 |

---

## E. P0／P1 執行結果（2026-10-21）

### E-1. 正式部署版本（P0）

**資料來源：** GitHub Deployments API 和 Commit Check Runs（repo 是公開的，以未登入方式唯讀查詢）。這些紀錄是 Zeabur bot 寫進 GitHub 的。

| 服務 | Zeabur service ID | 對外網址（deployment 紀錄） | 最後一次部署 | 結果 |
|---|---|---|---|---|
| Frontend | `6a9057397b65cd2687f74641` | `https://www.laborservice5690.com`（更早的紀錄是 `jinfengfront.zeabur.app`） | `fb05616a3964e12d36b0c9b82d24ee3ab8a6ea2c`，2026-09-30 17:13:58 UTC | success |
| Backend | `6a90528831ffc31a6c92f570` | `https://jinfengtestback.zeabur.app` | `fb05616a3964e12d36b0c9b82d24ee3ab8a6ea2c`，2026-09-30 17:09:55 UTC | success |

- Zeabur project ID：`6a51652ef04125ac9a349c69`。
- **✅ 2026-10-21 已在 Zeabur 人工核對前端：** Running 的是 `fb05616`、綁定分支是 `main`、`NUXT_PUBLIC_API_BASE_URL` 是 `https://jinfengtestback.zeabur.app`。所以正式前端實際使用的就是 `jinfengtestback` 這個後端，雖然名稱看起來像測試用。
- `fb05616` 是 `origin/main` 的最新 commit（PR #9 的 merge），所以**推測**兩個服務綁定的都是 `main` 分支。
- Backend 那筆 deployment 後來被標成 `inactive`。這是因為前後端共用同一個 GitHub environment 名稱 `production`，前端部署成功時 GitHub 會把同一 environment 的上一筆自動標成 inactive。**不代表 backend 被下線。**
- **仍需要你在 Zeabur 確認**，原因有兩個：
  - 在 Zeabur 手動回滾到舊的 deployment，或手動調整，不一定會寫回 GitHub。
  - 後端網址叫 `jinfengtestback`，名稱看起來像測試用；前端的 `NUXT_PUBLIC_API_BASE_URL` 是否真的指向它，需要確認。
- 到哪裡確認：
  - Zeabur → Project `6a51652e…` → Service `6a9057…`（前端）和 `6a9052…`（後端）→ **Deployments** 分頁：最上面那筆 Running 的 commit SHA。
  - **Settings → Git**：綁定的分支。
  - 前端服務的 **Variables** 分頁：只看 `NUXT_PUBLIC_API_BASE_URL` 指向哪個網域。

**⚠️ 新發現：已經有一個 Railway project 連到這個 repo**

- 名稱 `stunning-abundance`，project ID `35b7ceaf-5600-4ea6-9d1c-82053f4cede2`，service ID `92b49007-…`。
- `main` 每次 merge 都會自動部署：`bb40d2e`（9/4）、`8e7c65f`（9/30）、`fb05616`（9/30），**三次都失敗**。推測是沒有設定 Root Directory，所以在 repo 根目錄建置。
- 正式環境沒有受影響，但有兩件事要處理：
  - 這個 project 可能會產生費用。
  - 一旦設定好、開始能部署成功，它就會**跟著 main 自動部署**。在它的環境變數確認過、不會連到正式資料庫或正式 S3 之前，不要讓它成功部署。
- 本輪沒有碰它。要沿用、改名，還是刪掉，由你決定。

### E-2. 正式資料庫連線（P1-B）

| 檢查 | 結果 |
|---|---|
| 本機 `backend/.env` | 只有 `AWS_*` 五個變數，**沒有 `DB_*`**（只讀了變數名稱和 host 分類，沒有讀值） |
| `frontend/.env` | 不存在 |
| 本機的 `mysql`、`mysqldump`、`zeabur` CLI | 都沒有安裝 |
| Docker | 有（24.0.5），可以當作 MySQL client，不用另外安裝 |
| `gh` | 有安裝，但沒有登入 |
| `docs/環境變數.md` 等未追蹤檔 | **沒有讀**（可能含秘密值） |

**結論：本機沒有現成、已授權的正式資料庫連線方式，所以本輪沒有連線，也沒有執行任何查詢。**

**建議的安全連線方式（由你自己執行，不需要把帳密給我）：**

- 方式一（最簡單）：如果 Zeabur MySQL 服務頁有內建的資料庫管理介面或查詢工具，直接在那裡執行 §E-3 的查詢，把**結果**貼給我。結果只有 metadata，沒有個資。
- 方式二：Zeabur MySQL 如果有公開的 port，就在 `~/secure/zeabur-ro.cnf`（權限 600）填好連線資訊，用 Docker 跑一個同版本的 client。cnf 以唯讀方式掛載，帳密不會出現在指令列和 shell history：

```bash
docker run --rm -i -v "$HOME/secure/zeabur-ro.cnf:/c.cnf:ro" -v "$PWD/q.sql:/q.sql:ro" \
  mysql:8.0 sh -c 'mysql --defaults-extra-file=/c.cnf -t <PROD_DB> < /q.sql'
```

- 不管用哪一種，**都不要在聊天裡貼帳密、連線字串或 env 檔內容。**

### E-3. 依版本分段執行的唯讀查詢

先跑第 0 段，看是哪個版本，再挑對應的段落。每段都只讀 metadata。

```sql
-- 第 0 段：所有版本
SELECT VERSION() AS version, @@version_comment AS distribution;
```

| 第 0 段的結果 | 要跑的段落 |
|---|---|
| MySQL 5.7.x | 1、3、4、5、6、7 |
| MySQL 8.0.x | 1、2、3、4、5、6、7 |
| MySQL 8.4 以上或 9.x | 1、2、3、4、5、6、7（第 7 段裡的 binlog 指令要換掉，見第 7 段的註解） |
| MariaDB | 1、3、4、5、6、7；第 1 段的 `@@gtid_mode` 要換成 `@@gtid_strict_mode` |

```sql
-- 第 1 段：伺服器設定（所有版本）
SELECT @@global.sql_mode AS global_sql_mode, @@session.sql_mode AS session_sql_mode,
       @@global.time_zone AS global_tz, @@session.time_zone AS session_tz,
       @@system_time_zone AS system_tz, NOW() AS now_session, UTC_TIMESTAMP() AS now_utc,
       @@lower_case_table_names AS lctn,
       @@character_set_server AS cs_server, @@collation_server AS coll_server,
       @@character_set_database AS cs_db, @@collation_database AS coll_db,
       @@default_storage_engine AS default_engine,
       @@explicit_defaults_for_timestamp AS explicit_ts,
       @@event_scheduler AS event_scheduler, @@log_bin AS log_bin;
SELECT @@gtid_mode;   -- MariaDB 改成 SELECT @@gtid_strict_mode;

-- 第 2 段：只有 MySQL 8.0 以上（關掉統計快取；只影響這個連線）
SET SESSION information_schema_stats_expiry = 0;

-- 第 3 段：資料庫預設、每張表的引擎、估計筆數、容量（所有版本）
SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
  FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE();
SELECT TABLE_NAME, ENGINE, ROW_FORMAT, TABLE_ROWS AS est_rows,
       ROUND(DATA_LENGTH/1024/1024,2) AS data_mb, ROUND(INDEX_LENGTH/1024/1024,2) AS index_mb,
       AUTO_INCREMENT, TABLE_COLLATION, UPDATE_TIME
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;
SELECT ENGINE, COUNT(*) AS tables, ROUND(SUM(DATA_LENGTH+INDEX_LENGTH)/1024/1024,2) AS total_mb
  FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() GROUP BY ENGINE;

-- 第 4 段：和預設不同的欄位 collation（所有版本，預期 0 筆）
SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND COLLATION_NAME IS NOT NULL AND COLLATION_NAME <> 'utf8mb4_unicode_ci';

-- 第 5 段：view、trigger、routine、event（所有版本，預期全部 0 筆）
SELECT 'view' AS kind, TABLE_NAME AS name, DEFINER FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE()
UNION ALL SELECT 'trigger', TRIGGER_NAME, DEFINER FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()
UNION ALL SELECT ROUTINE_TYPE, ROUTINE_NAME, DEFINER FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE()
UNION ALL SELECT 'event', EVENT_NAME, DEFINER FROM information_schema.EVENTS WHERE EVENT_SCHEMA = DATABASE();

-- 第 6 段：migration 紀錄（所有版本）。先看表存不存在，下面兩行只在表存在時執行
SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('node_schema_migrations','migrations','carousel','consultations');
SELECT filename, applied_at FROM node_schema_migrations ORDER BY filename;
SELECT COUNT(*) AS laravel_migrations, MAX(batch) AS last_batch FROM migrations;

-- 第 7 段：權限與連線（所有版本）
SHOW GRANTS FOR CURRENT_USER();
SELECT USER, HOST, DB, COMMAND, TIME FROM information_schema.PROCESSLIST;   -- 不查 INFO 欄位
-- binlog 位置（選用，需要 REPLICATION CLIENT 權限）：
--   5.7／8.0：SHOW MASTER STATUS;    8.4 以上：SHOW BINARY LOG STATUS;
```

- **精確筆數（`COUNT(*)`）這輪先不跑。** 看過第 3 段的估計筆數和容量之後，再決定哪幾張表要在離峰時間跑。
- 所有查詢都不讀任何客戶資料表、`users`、`oauth_*`、`password_resets` 的資料列。

---

## 參考來源

- Railway：[Outbound Networking（SMTP 限制）](https://docs.railway.com/networking/outbound-networking)、[Pricing Plans](https://docs.railway.com/reference/pricing)、[Healthchecks](https://docs.railway.com/reference/healthchecks)
- Railway 社群：[Hobby 方案 SMTP 被封鎖](https://station.railway.com/questions/outbound-smtp-blocked-on-my-deployment-732c27ed)、[升級 Pro 後仍被擋](https://station.railway.com/questions/outbound-smtp-port-465-still-blocked-a-580551e5)
- Resend：[Pricing](https://resend.com/pricing)、[New free tier](https://resend.com/blog/new-free-tier)

> 價格與方案限制依 2026-10 查詢的結果整理，決定前請以官網為準。
