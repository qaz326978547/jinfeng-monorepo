# NewData 報告：只保留新版使用的資料表，以及正式切換程序

> 日期：2026-10-23
> 讀者：負責這次遷移的技術人員與專案團隊
> 來源備份與產出檔都放在 repo 外：`~/secure/jinfeng-db-backups/2026-10-23/`（見 §8）
> 前一份報告：[Zeabur正式資料庫盤點報告.md](Zeabur正式資料庫盤點報告.md)

## 重點摘要

1. 新版 Node backend 只用到 **10 張表**。其餘 18 張是舊 Laravel 的表，加上空資料庫 `AppClass`，都已經從 NewData.sql 拿掉。保留的表**欄位一個都沒刪**。
2. **`db:verify` 的快照改成以這 10 張表、全部 InnoDB 為準。** verifier 原本只比對表、引擎、欄位型別和 NULL，現在另外檢查**索引、主鍵、AUTO_INCREMENT**。對 DigitalOcean 的資料和全新環境都檢查通過，人為破壞的情況也都抓得到（§5）。
3. **`001_create_tables.sql` 現在只建 7 張表，全部 InnoDB。** 已經跑過 001 的環境**不會**因為這次修改而刪表，原因是 migration 只依檔名記錄，不會重跑（§6）。
4. **切換當天用 [build-newdata.sh](build-newdata.sh) 重新產生 NewData.sql，再用 [reconcile-counts.sql](reconcile-counts.sql) 做三方核對。** 暫停寫入和回復方案都已經在本機演練過（§7）。
5. **data.sql、_manifest.json、NewData.sql 都已經移到 repo 外。** SHA-256 確認一致後才刪掉 repo 裡的副本，這三個檔案從來沒有被 Git 追蹤過（§8）。

---

## 1. 保留的 10 張表

| 表 | 筆數 | AUTO_INCREMENT | 引擎（原 → 新） | 用在哪裡 | 程式怎麼讀 |
|---|---|---|---|---|---|
| `contact` | 208 | 303 | MyISAM → InnoDB | 課程報名、後台報名管理 | `SELECT *` |
| `contact_list` | 325 | 345 | MyISAM → InnoDB | 報名的聯絡人 | `SELECT *` |
| `contact_class` | 40 | 83 | MyISAM → InnoDB | 課程場次選項、後台管理 | `SELECT *` |
| `contact_quest` | 7 | 8 | MyISAM → InnoDB | 報名表的問題選項 | `SELECT *` |
| `faq` | 15 | 16 | MyISAM → InnoDB | 常見問題、後台管理 | 只讀 `id, name, info, no` |
| `seo` | 1 | 2 | MyISAM → InnoDB | 每一頁的 SEO | `SELECT *` |
| `users` | 3 | 7 | InnoDB | 後台登入 | `id, email, password, is_admin`；新增時寫 `name` |
| `carousel` | 2 | 3 | InnoDB | 首頁輪播 | migration 006 |
| `consultations` | 2 | 3 | InnoDB | 免費諮詢 | migration 007 |
| `node_schema_migrations` | 7 | — | InnoDB | 記錄 001～007 已經執行過 | `npm run db:migrate` |

筆數是 2026-10-23 15:20 UTC 備份當下的值。判斷依據有兩個：`backend/src` 裡 9 個 `*.repository.ts` 的所有 SQL，以及正式庫 `performance_schema` 從 2026-09-21 起的實際查詢紀錄。兩邊的結果一致。

所有表都沒有外鍵。`contact_list.cid` 對應 `contact.id`，但只靠程式維護。

### 1-1. 用不到、但刻意沒刪的欄位

| 表 | 沒用到的欄位 | 為什麼不刪 |
|---|---|---|
| `faq` | `class_id`、`date`、`pic`、`pic_alt`、`file`、`utube`、`s_info`、`info2`～`info5`、`be_click`、`act`、`p_home`、`p_new`、`p_hot`、`p_run`、`del` | 跟這次遷移無關，刪了反而要多改快照、migration 和測試 |
| `users` | `remember_token` | Laravel「記住我」功能用的，新版改用 JWT |
| `seo`、`contact`、`contact_*` | 無法從程式碼確定 | 這幾張是 `SELECT *`，整列會回傳給前端，刪了會改變 API 的回應 |

## 2. 拿掉的 18 張表

| 表 | 筆數 | 原本的用途 |
|---|---|---|
| `admin` | 1 | 舊後台帳號（新版用 `users`） |
| `browse`、`browse_record` | 2、374 | 舊網站的瀏覽統計，2024-06-25 之後就沒有再寫入 |
| `page`、`page_files`、`page_pics` | 2、0、0 | 舊網站的頁面內容 |
| `faq_class`、`seo_class` | 0、0 | 舊分類 |
| `simple_setting` | 1 | 舊的 LINE Notify 設定 |
| `contact_img` | 0 | 舊的報名附件 |
| `oauth_*`（5 張） | 68、0、6、3、0 | Laravel Passport；最後一筆 token 是 2026-06-30 |
| `migrations` | 12 | Laravel 自己的 migration 紀錄 |
| `jobs` | 0 | Laravel queue |
| `password_resets` | 0 | Laravel 忘記密碼。這是唯一沒有主鍵的表，拿掉之後 DigitalOcean 的主鍵限制就不用另外處理 |

這些表的原始資料都還保存在 `~/secure/jinfeng-db-backups/2026-10-23/data.sql`。

## 3. 產生方式：[build-newdata.sh](build-newdata.sh)

```bash
docs/change/build-newdata.sh <Zeabur 備份.sql> <輸出 NewData.sql>
```

| 步驟 | 內容 |
|---|---|
| 1 | 開一個一次性的 Docker `mysql:8.0.33`（跟 Zeabur 同版本），不連任何遠端資料庫 |
| 2 | 還原備份 |
| 3 | 刪掉 `AppClass` 和那 18 張表，6 張 MyISAM 表改成 InnoDB |
| 4 | 自動檢查：一定要剛好剩 10 張表、全部 InnoDB、每張都有主鍵，不符合就中止 |
| 5 | 用 `mysqldump --single-transaction --set-gtid-purged=OFF --no-tablespaces --skip-dump-date --hex-blob` 匯出並加上檔頭；檔案裡只要還有 `ENGINE=MyISAM` 就中止 |
| 6 | 跑 [reconcile-counts.sql](reconcile-counts.sql)，印出每張表的筆數、最大 id、AUTO_INCREMENT 和 checksum，再印出 NewData.sql 的 SHA-256 |

輸出檔如果已經存在，script 會拒絕覆蓋。產出的 NewData.sql **沒有 `CREATE DATABASE`／`USE`**，匯入時自己指定資料庫。

**重現性：** 拿 2026-10-23 的備份重跑一次，產生的內容跟手動做的 NewData.sql **完全一樣**，只有檔頭不同。

**核對 SQL：** 同一份 `reconcile-counts.sql` 分別在原始 MyISAM（8.0.33）和 NewData（8.4）上執行，19 列結果完全一樣。checksum 不受引擎和版本影響。

## 4. 匯入與 API 驗證（MySQL 8.4，模擬 DigitalOcean）

環境：Docker `mysql:8.4`，加上 `--sql-require-primary-key=ON --default-time-zone=+00:00`。

| 檢查 | 結果 |
|---|---|
| 匯入 NewData.sql | ✅ 沒有錯誤；筆數、AUTO_INCREMENT 都跟備份一樣 |
| `GET /ready`、`/api/v2/seo`、`/faq`、`/contact-class`、`/contact-quest`、`/carousels` | ✅ 200 |
| `POST /api/v2/auth/login` | ✅ 200（用只建在本機容器裡的測試帳號） |
| 後台列表：`contact`（total=208）、`contact-list`、`faq`、`carousels`、`consultations` | ✅ 200，筆數正確 |
| `POST /api/v2/contact`（交易：同時寫 contact 和 contact_list） | ✅ 201，新 id 從 303／345 接著往下 |
| `POST /api/v2/consultations`、後台 contact-class 新增／修改／刪除、faq 新增 | ✅ 201／200 |
| `created_at` | ✅ 跟 `UTC_TIMESTAMP()` 一致 |

## 5. 決定 1：`db:verify` 的 schema 快照與檢查

> **2026-10-24 更新：** 新增 migration 008（`contact_idempotency_keys`）之後，快照變成 **11 張表**。原本 10 張表的內容完全沒變。下面的數字是 10 月 23 日當時的狀態。

### 5-1. 改了什麼

| 檔案 | 變更 |
|---|---|
| [database-schema.json](../../backend/src/infrastructure/database/schema/database-schema.json) | 從 25 張表（舊 Zeabur，MyISAM 和 InnoDB 混用）改成 **10 張表、全部 InnoDB**：110 個欄位、16 個索引（每張表都有 `PRIMARY`） |
| [schema-verifier.ts](../../backend/src/infrastructure/database/schema-verifier.ts) | 新增 3 種檢查：`autoIncrementMismatches`、`missingIndexes`（主鍵不見了也會算在這裡）、`indexMismatches`（唯一性、是不是主鍵、欄位順序） |
| [schema/README.md](../../backend/src/infrastructure/database/schema/README.md) | 說明快照的來源、會檢查哪些項目、跟 specs 那份歷史快照的關係 |
| [schema-verifier.test.ts](../../backend/tests/unit/schema-verifier.test.ts) | 新增 7 個單元測試 |

快照是用唯讀查詢從「NewData 匯入 8.0.33 之後」的 `information_schema` 產生的。原本就有的 7 張表，除了 6 張的引擎從 MyISAM 改成 InnoDB，**欄位和索引跟舊快照完全一樣**。

`specs/backend/migration-history/database-schema.json` 是 Zeabur 正式庫的歷史紀錄（2026-07-21），**保留原樣不動**。

### 5-2. 檢查項目

| 項目 | 以前 | 現在 |
|---|---|---|
| 表存在、引擎 | ✅ | ✅ |
| 欄位存在、`DATA_TYPE`、NULL 設定 | ✅ | ✅ |
| AUTO_INCREMENT 屬性 | ❌ 有記錄但沒比對 | ✅ |
| 主鍵 | ❌ 有記錄但沒比對 | ✅ |
| 一般索引、唯一索引（含欄位順序） | ❌ 有記錄但沒比對 | ✅ |
| 欄位長度（`COLUMN_TYPE`）、預設值 | ❌ | ❌ 有記錄但沒比對（這次的需求範圍外） |
| 快照以外的多餘表 | 不檢查 | 不檢查（舊環境留著的 Laravel 表不會被報錯） |

AUTO_INCREMENT 檢查的是欄位有沒有這個屬性，**不是**下一個編號。下一個編號屬於資料，在 §7 用 `reconcile-counts.sql` 核對。

### 5-3. 驗證結果

| 情境 | 結果 |
|---|---|
| NewData 匯入 MySQL 8.0.33 | ✅ OK |
| NewData 匯入 MySQL 8.4（`sql_require_primary_key=ON`） | ✅ OK |
| 空白資料庫跑 `db:migrate`（8.0.33 和 8.4 各一次） | ✅ OK |
| 原始 Zeabur 備份（data.sql） | ❌ 如預期：6 張表的引擎不符 |
| 故意破壞一份 NewData 副本 | ❌ 如預期，全部抓到：缺主鍵、缺索引、唯一索引被改成一般索引、AUTO_INCREMENT 被拿掉、NULL 設定改變 |
| backend 全部測試 | ✅ 28 個檔案、323 個測試 |
| `tsc --noEmit`、`eslint`、`npm run build`、`openapi:validate` | ✅ |

## 6. 決定 2：`001_create_tables.sql`

### 6-1. migration 的執行方式（修改前先確認過）

- **只有 `npm run db:migrate`（[scripts/migrate.ts](../../backend/scripts/migrate.ts)）一種方式。** docker-compose 沒有掛 initdb，Dockerfile 和程式啟動時也不會自動跑 migration。
- **只依檔名記錄已執行的檔案。** 記錄在 `node_schema_migrations`，**不比對檔案內容（沒有 checksum）**，也沒有 rollback 或 reset。
- 所以 001 已經有紀錄的環境，**這次修改完全不會被執行，不會刪表也不會改引擎。** 我在新的 001 裡也刻意不放任何 `DROP` 或 `ALTER`。
- 正式庫（Zeabur 和匯入後的 DO）的 `node_schema_migrations` 都記著 001～007，所以 migrate 會全部跳過。
- `NODE_ENV=production` 時，migrate 預設拒絕執行。

### 6-2. 改了什麼

| 檔案 | 變更 |
|---|---|
| [001_create_tables.sql](../../backend/migrations/001_create_tables.sql) | 只建 7 張表（`users`、`contact`、`contact_class`、`contact_quest`、`contact_list`、`faq`、`seo`），全部 InnoDB。欄位、索引一字不改。檔頭改寫：說明 2026-10-23 的變更、拿掉哪些表、其他表從哪裡建，以及「已經執行過的環境不會變」 |
| [006_create_carousel_table.sql](../../backend/migrations/006_create_carousel_table.sql) | 只改註解（原本寫「001 全部是 MyISAM」） |
| [transaction.ts](../../backend/src/infrastructure/database/transaction.ts) | 只改註解：現在全部是 InnoDB，交易真的會生效 |
| [laravel-to-node-parity.md](../../specs/backend/laravel-to-node-parity.md) | `users_email_unique` 的行號：45 → 48 |
| [openapi.yaml](../../specs/shared/api-contracts/openapi.yaml) | `contact_list.cid` 的 description 拿掉「MyISAM」字樣。schema 本身沒改，前端不受影響 |

002～005 原本就只有註解，不會執行任何東西，所以不用改。

### 6-3. 驗證結果

| 情境 | 結果 |
|---|---|
| **空白資料庫完整初始化**（8.0.33 和 8.4）：`db:migrate` → `db:verify` | ✅ 001～007 都套用成功，剛好建出 10 張 InnoDB 表，`db:verify` OK |
| 再跑一次 `db:migrate` | ✅ 7 個檔案全部 skip（冪等） |
| **模擬既有環境**：先用舊版 001 建庫並寫入一筆資料，再用新版跑 `db:migrate` | ✅ 001 被 skip，002～007 照常套用。原本 25 張表變 27 張，`admin` 等舊表還在，資料也還在。**沒有任何表被刪除** |
| 既有環境跑 `db:verify` | 如預期：回報 6 張表還是 MyISAM |

**本機既有的開發環境：** 如果要跟新版一致，請重建資料庫：`docker compose down -v` 之後再跑 `db:migrate`。注意這會清掉本機的測試資料。不重建也能用，只是交易對那 6 張表還是無效，而且 `db:verify` 會一直報引擎差異。

## 7. 決定 3：正式切換程序與回復方案

### 7-1. 原則

- **Zeabur 一旦凍結就不再解凍。** 唯一的例外是 §7-4 R-A：DO 還沒開始服務就決定中止切換。這樣兩邊永遠不會同時被寫入。
- **資料要三方一致才能開放寫入**：凍結後的 Zeabur、build-newdata.sh 第 6 步、DO 匯入後，三份 `reconcile-counts.sql` 結果要一模一樣。
- **切換後保留 Zeabur 當回復目標**，觀察期內維持凍結狀態，不要刪除。

### 7-2. 前置作業（D-7 ～ D-1）

| # | 工作 | 完成標準 |
|---|---|---|
| P1 | 建 DO Managed MySQL 8.4：`default_time_zone='+00:00'`，`sql_mode` 照 Zeabur 設定，Trusted Sources 只放行 App Platform | 控制台設定截圖 |
| P2 | 建 DO 帳號：`doadmin` 只拿來匯入和調整權限；backend 用專屬帳號，只給這個資料庫的 `SELECT, INSERT, UPDATE, DELETE` | `SHOW GRANTS` |
| P3 | backend 的 TLS 修改（2026-10-24 已完成，見 [報名防重複與DB連線變更.md](報名防重複與DB連線變更.md)）**合併並部署到 DO**。DO backend 的環境變數設定：`DB_SSL=true`、`DB_HOST` 填控制台顯示的叢集主機名稱（不能填 IP）、`DB_SSL_CA` 貼上叢集的 CA certificate | DO 的 backend `/ready` 回 200；用 `SHOW SESSION STATUS LIKE 'Ssl_version'` 確認是 TLSv1.2 以上 |
| P4 | 實測 DO 上能不能寄信（[遷移預算 §重點 3](../digitalocean-migration-budget.md)） | 報名和諮詢的通知信都收得到 |
| P5 | **完整演練一次** §7-3 的 S3～S10，用當天最新的備份，匯入 DO 的**演練用**資料庫 | 三方核對一致、`db:verify` OK、[QA測試.md](../../QA測試.md) 通過，並記錄每一步花多久 |
| P6 | 停用舊服務：jinfeng-back-v2、Redis、jinfeng-front、jinfeng-front-v2（先完成[前一份報告 §3-3](Zeabur正式資料庫盤點報告.md)） | Zeabur 顯示已暫停 |
| P7 | DNS TTL 調到 300 秒，至少提前 48 小時 | DNS 查詢確認 |
| P8 | 跟金豐約好維護時段（離峰），通知後台使用者當天不要操作 | 書面確認 |

**背景排程：** 新版 backend 沒有 cron、queue、`setInterval`，所以不用處理。舊 Laravel 的 queue 和排程只會在 jinfeng-back-v2 裡跑，P6 停用之後就不會再有了。

### 7-3. 切換當天

| 步驟 | 動作 | 指令／確認 | 不通過就 |
|---|---|---|---|
| S1 | 公告維護開始；確認後台沒有人在操作 | — | — |
| S2 | 確認 P6 的舊服務都還是暫停狀態 | Zeabur 面板 | 先暫停 |
| S3 | **凍結 Zeabur 寫入** | Zeabur MySQL：`SET GLOBAL super_read_only = ON;` 然後 `SELECT @@global.super_read_only;` 結果要是 `1` | R-A |
| S4 | 確認沒有寫入了 | 隔 1 分鐘跑兩次 `reconcile-counts.sql`，兩次結果要一樣；`SHOW PROCESSLIST` 沒有在執行的寫入 | 重做 S3 |
| S5 | 留下來源基準 | Zeabur 跑 `reconcile-counts.sql` → 存成 `zeabur-final.txt` | — |
| S6 | 最終備份 | Zeabur 面板備份，或用 `mysqldump`（見[前一份報告 §4-2](Zeabur正式資料庫盤點報告.md)）→ 存到 `~/secure/jinfeng-db-backups/<日期>/data.sql`，並記錄 SHA-256 | R-A |
| S7 | 產生 NewData | `docs/change/build-newdata.sh <data.sql> <NewData.sql>`；第 6 步的輸出要跟 `zeabur-final.txt` 完全一樣 | R-A |
| S8 | 匯入 DO（**新建、空的**正式資料庫） | `mysql --defaults-extra-file=~/secure/do-admin.cnf --ssl-mode=REQUIRED <db> < NewData.sql` | 刪掉這個資料庫重新匯入；還是不行就 R-A |
| S8b | 套用 Node 版新增的 migration | `DB_*`（含 `DB_SSL`、`DB_SSL_CA`）指向 DO，執行 `npm run db:migrate -- --allow-production`。應該顯示 001～007 skip、**只套用 008**（`contact_idempotency_keys`）。NewData.sql 來自 Zeabur，本來就沒有這張表 | R-A |
| S9 | 資料核對 | DO 跑 `reconcile-counts.sql`，結果要跟 `zeabur-final.txt` 完全一樣（008 的新表不在核對範圍內）；跑 `npm run db:verify`，要顯示 OK（快照是 11 張表，所以 S8b 沒做的話會回報少一張表） | R-A |
| S10 | API 驗證（用 DO backend 的預設網址，網址先不要公開） | `/ready`；`GET seo/faq/contact-class/contact-quest/carousels`；用真的管理員帳號登入；後台列表的筆數要跟 S5 一致；送出一筆標記「切換測試」的報名（帶 `Idempotency-Key`），確認回應是 `notification: "sent"`、而且有收到信；用同一個 key 再送一次，應該回 `replayed: true`。最後用 SQL 刪掉這筆 contact、對應的 contact_list 和 `contact_idempotency_keys`，刪完重跑一次 S9 | R-A |
| S11 | **開放新版寫入（切換流量）** | DO frontend 的 `NUXT_PUBLIC_API_BASE_URL` 指向 DO backend；把 `www.laborservice5690.com` 的 DNS 指到 DO；確認 `CORS_ALLOWED_ORIGINS` | R-B |
| S12 | 公告維護結束；觀察 log、表單、通知信 | 實際送一筆報名，確認有收到信 | R-B |

**S3 的實測結果**（在跟 Zeabur 一樣的條件下：8.0.33、MyISAM、backend 用 root 連線）：

| 狀態 | 結果 |
|---|---|
| 凍結中，讀取 | `GET seo`、`GET faq` 都回 200，網站正常瀏覽 |
| 凍結中，寫入 | 送出報名、諮詢都回 500（`ERROR 1290 … --super-read-only`），連 root 也寫不進去 |
| 凍結中，備份 | `mysqldump` 正常 |
| 解除凍結 | 立刻可以寫入 |

**S3 要注意：**
- **`SET GLOBAL` 不是永久設定。** Zeabur 的 MySQL 一重啟就會恢復可寫。所以觀察期內每次重啟後都要重新設定，可以用 `SELECT @@global.super_read_only` 確認。
- **凍結期間送出的表單會失敗。** 所以要先公告、挑離峰時段，並把 P5 實測的時間放進公告。
- **DNS 生效前不會有資料寫錯地方。** 這段期間還連到 Zeabur 的使用者只能讀，寫入會被 S3 擋下來，不會寫進錯誤的資料庫。

### 7-4. 回復方案

**R-A：S11 之前中止**（DO 還沒有正式寫入）

1. Zeabur：`SET GLOBAL super_read_only = OFF; SET GLOBAL read_only = OFF;`
2. 公告維護結束，網站繼續用 Zeabur。
3. DO 匯入的資料不用（下次重做 S6 起的步驟時再刪掉重建）。**不會有任何資料遺失。**

**R-B：S11 之後回退到 Zeabur**（DO 上已經有新的報名，或是後台的修改）

| 步驟 | 動作 |
|---|---|
| B1 | **凍結 DO 寫入**：用 `doadmin` 執行 `REVOKE INSERT, UPDATE, DELETE ON <db>.* FROM '<backend 帳號>'@'%';`（Managed MySQL 不能用 `super_read_only`） |
| B2 | DO 跑 `reconcile-counts.sql` → 存成 `do-final.txt`；同時記下 9 張業務表的 AUTO_INCREMENT |
| B3 | 匯出 DO 的 9 張業務表（**只匯出資料**）：`mysqldump --no-create-info --skip-triggers --set-gtid-purged=OFF --no-tablespaces --single-transaction <db> carousel consultations contact contact_class contact_list contact_quest faq seo users > do-delta.sql` |
| B4 | 暫停 Zeabur 上的新版 backend 服務；Zeabur MySQL 設 `super_read_only = OFF` |
| B5 | Zeabur 執行：先對這 9 張表各跑一次 `DELETE FROM <表>;`，再匯入 `do-delta.sql`，最後每張表 `ALTER TABLE <表> AUTO_INCREMENT = <B2 的值>;` |
| B6 | Zeabur 跑 `reconcile-counts.sql`，要跟 `do-final.txt` 完全一樣 |
| B7 | 恢復 Zeabur backend；DNS 和 `NUXT_PUBLIC_API_BASE_URL` 改回 Zeabur；公告 |

**`contact_idempotency_keys` 不用回退。** Zeabur 沒有這張表，Zeabur 上跑的程式遇到這種情況會自動略過防重複，報名照常寫入（已測試）。B3 只匯出 9 張業務表就好。

**為什麼回退是整張表覆蓋，而不是只補新的 id：** 只補 id 比較大的資料，會漏掉後台在 DO 上做的**修改和刪除**，例如改課程名稱、刪 FAQ、改諮詢狀態。資料量很小（不到 1 MB），整張表覆蓋最可靠。

**本機演練結果：** DO 副本（8.4、InnoDB）上做了三種操作：新增報名＋聯絡人、修改課程名稱、刪除一筆 FAQ、改諮詢狀態。照 B3～B5 覆蓋回 Zeabur 副本（8.0.33、MyISAM）之後：
- `reconcile-counts.sql` 兩邊**完全一樣**（筆數、最大 id、AUTO_INCREMENT、checksum）。
- 修改和刪除都有正確反映到 Zeabur。
- Zeabur 的舊 Laravel 表（`admin`、`oauth_*`）和 MyISAM 引擎都沒有被動到。
- 從 8.4 匯出、匯入 8.0 沒有問題，因為只是一般的 INSERT。

**B5 要注意：** MyISAM 沒有交易，匯入如果中途失敗，會留下一部分資料。這時從 B5 第一步整段重跑就好，因為第一步會先 DELETE，所以重跑結果一樣。如果還是失敗，就用 S6 的最終備份把 Zeabur 還原回切換前的狀態，再手動補上 `do-delta.sql` 裡的資料。

### 7-5. 觀察期與收尾

- **觀察期建議 14 天。** 這段期間 Zeabur MySQL 保持凍結、不刪除，每次重啟後都要確認 `super_read_only=1`。
- **觀察期結束後**：停掉 Zeabur MySQL、更換 root 密碼（它曾經出現在對話中）、刪除 Zeabur project。
- 最終備份依 §8 的方式保存。

## 8. 決定 4：備份檔移出 repo

| 檔案 | SHA-256 | 新位置 |
|---|---|---|
| `data.sql`（Zeabur 原始備份） | `289d6de605f8e2917747d6d2e7c747d1e9f32806613fbe9ab5aa32bd61f5b43c` | `~/secure/jinfeng-db-backups/2026-10-23/` |
| `_manifest.json`（Zeabur 備份的說明檔，跟 data.sql 是同一份備份） | `f2af139e11dddfabe17175cdf4a1111170b87c845456e11e9547c1def7631dd6` | 同上 |
| `NewData.sql` | `7496772f74e1a7d897fa79caa1d1866f0524b3907b9b959773ab9f121ba55ba4` | 同上 |

**處理順序：**
1. 確認這三個檔案**都沒有被 Git 追蹤**，所有分支的 commit 裡也都找不到，也沒有被 staged。
2. 用 `cp -p` 複製到新位置。
3. 在原位置算 SHA-256，存成 `SHA256SUMS`。
4. 在新位置用 `shasum -c` 驗證全部 OK，再用 `cmp` 逐位元比對確認一致。
5. 以上都通過後，才刪除 `docs/change/` 裡的三個檔案。

**權限：** 目錄是 `700`，檔案是 `600`，只有本機帳號能讀。位置不在 `~/Documents` 底下，所以不會被 iCloud 同步。

**`.gitignore`：** 已經加上 `docs/change/*.sql` 和 `docs/change/_manifest.json`，只放行 `convert-myisam-to-innodb.sql` 和 `reconcile-counts.sql`（這兩個不含資料）。要注意的是，`.gitignore` 只會擋住還沒被追蹤的檔案，已經被追蹤的檔案它擋不了。這次已經先確認過這三個檔案都沒被追蹤。

**建議：**
- 確認 macOS 的 FileVault 有開啟。
- 另外存一份加密副本到公司指定的位置（例如加密壓縮檔或公司雲端的受控資料夾）。
- 訂好保存期限，例如觀察期結束後 6 個月刪除，並記錄是誰負責保管。

**切換當天的最終備份**（§7-3 S6）也照同樣的方式放到 `~/secure/jinfeng-db-backups/<日期>/`。

## 9. 還沒完成的事

| # | 事項 | 誰 |
|---|---|---|
| 1 | ~~backend 的 TLS 修改（§7-2 P3）~~ 2026-10-24 已在本機完成並測試，還沒 commit 和部署 | 開發 |
| 2 | 實測 DO 能不能寄信（§7-2 P4） | 開發 |
| 3 | 完成前一份報告 §3-3 的確認，然後停用舊服務（§7-2 P6） | 你／金豐 |
| 4 | 決定維護時段並通知金豐（§7-2 P8） | 你 |
| 5 | 這次的程式和文件變更還沒 commit | 你決定 |
