# Zeabur 正式資料庫盤點報告（DigitalOcean 遷移前）

> 檢查日期：2026-10-23
> 對象：Zeabur project「Jinfeng」裡的 MySQL 服務（`service-667908be…`，2024-06-24 建立）
> 方式：用 backend 的 `mysql2` 套件連線，**只執行 SELECT／SHOW**，沒有改任何資料或設定。
> 本文件不含帳密。檢查用的 root 密碼曾貼在對話中，遷移完成後必須更換（見 §6）。
>
> **2026-10-23 更新：** 重點摘要第 4 點原本建議「舊 Laravel 的表也留著」，現在改成只搬新版用到的 10 張表，見 [NewData報告.md](NewData報告.md)。

## 重點摘要

1. **正式資料都在 `zeabur` 這個資料庫**，共 28 張表，約 0.5 MB。`AppClass` 是空的，其餘 4 個是 MySQL 系統庫，都不用搬。
2. **正式資料庫目前只有新版 Node backend 在用。** 從 2026-09-21 到今天，所有連線和查詢都來自 Node 的 `mysql2`，舊 Laravel 一次都沒有連過。
3. **舊的 jinfeng-back-v2（Laravel）可以不搬**，Redis、jinfeng-front、jinfeng-front-v2 也一樣。但要先完成 §3-3 的三項確認，再停用舊服務。
4. **`zeabur` 資料庫要整個搬，舊 Laravel 的表也留著。** 新版 backend 的 `db:verify` 會比對完整的 28 張表，而且這些表全部加起來不到 1 MB。
5. DigitalOcean Managed MySQL **只有 8.4，也不允許 MyISAM**。15 張 MyISAM 表要先轉成 InnoDB，SQL 已經寫好，也在本機測過：[convert-myisam-to-innodb.sql](convert-myisam-to-innodb.sql)。

---

## 1. 資料庫清單

| 資料庫 | 歸屬 | 表數 | 大小 | 要不要搬 |
|---|---|---|---|---|
| **`zeabur`** | 業務資料（名稱是 Zeabur 預設的，內容是金豐的資料） | 28 | 0.51 MB | ✅ 要 |
| `AppClass` | 空資料庫，用途不明 | 0 | — | ❌ 不用 |
| `mysql` | MySQL 系統庫（帳號、權限） | 38 | — | ❌ 帳號在 DO 重新建 |
| `information_schema` | MySQL 系統庫（虛擬） | — | — | ❌ |
| `performance_schema` | MySQL 系統庫（監控用，存在記憶體） | — | — | ❌ |
| `sys` | MySQL 系統庫（view） | — | — | ❌ |

Zeabur 面板上每張卡片都寫「12 資料表」，那是面板的顯示問題。實際數字以上表為準。

## 2. `zeabur` 裡的表

精確筆數是用 `COUNT(*)` 查的。「讀／寫」欄是 2026-09-21 MySQL 重啟後到今天，`performance_schema` 記錄的存取次數。

### 2-1. 新版 Node backend 會用到的表

| 表 | 引擎 | 筆數 | 讀／寫 | 用途 |
|---|---|---|---|---|
| `contact` | MyISAM | 208 | 1,462／1 | 課程報名 |
| `contact_list` | MyISAM | 325 | 0／0 | 報名人員 |
| `contact_class` | MyISAM | 40 | 14,128／14 | 課程選項 |
| `contact_quest` | MyISAM | 7 | 3,346／0 | 問題選項 |
| `faq` | MyISAM | 15 | 3,900／0 | 常見問題 |
| `seo` | MyISAM | 1 | 61,576／0 | 每頁 SEO |
| `users` | InnoDB | 3 | 2／0 | 後台登入（密碼是 Laravel 的 bcrypt，必須搬） |
| `carousel` | InnoDB | 2 | 566／0 | 首頁輪播（圖片在 S3） |
| `consultations` | InnoDB | 2 | 12／2 | 免費諮詢 |
| `node_schema_migrations` | InnoDB | 7 | 12／1 | Node migration 執行紀錄 |

### 2-2. 舊 Laravel 留下、新版沒有用到的表

| 表 | 引擎 | 筆數 | 讀／寫 | 最後寫入 |
|---|---|---|---|---|
| `admin` | MyISAM | 1 | 0／0 | 2024-06-25 |
| `browse`、`browse_record` | MyISAM | 2、374 | 0／0 | 2024-06-25 |
| `faq_class`、`seo_class` | MyISAM | 0、0 | 0／0 | 2024-06-25 |
| `page`、`page_files`、`page_pics` | MyISAM | 2、0、0 | 0／0 | 2024-06-25 |
| `simple_setting` | MyISAM | 1 | 0／0 | 2024-06-25 |
| `contact_img` | InnoDB | 0 | 0／0 | — |
| `oauth_access_tokens` | InnoDB | 68 | 0／0 | **2026-06-30**（最後一次舊後台登入） |
| `oauth_clients` 等其他 4 張 `oauth_*` | InnoDB | 6、3、0、0 | 0／0 | — |
| `migrations`（Laravel 的） | InnoDB | 12 | 0／0 | — |
| `jobs`、`password_resets` | InnoDB | 0、0 | 0／0 | — |

2024-06-25 是這個資料庫建立、匯入資料的日期。也就是說，這些表**匯入之後就沒有再被寫過**。

## 3. 正式資料庫是不是只有新版在用？

### 3-1. 結論

**是。** 從 2026-09-21 18:03 UTC（MySQL 最後一次重啟）到 2026-10-23，正式資料庫的所有流量都來自新版 Node backend，舊 Laravel 沒有任何連線。

### 3-2. 證據

| # | 檢查 | 結果 | 代表什麼 |
|---|---|---|---|
| 1 | 目前連線的 client 名稱（`session_connect_attrs`） | 全部是 `Node-MySQL-2 3.23.1`，和 [backend/package.json](../../backend/package.json) 的 `mysql2 ^3.23.1` 一致 | 現在連著的只有新版 backend。PHP／Laravel 會顯示成 `mysqlnd` |
| 2 | 重啟以來的所有 SQL（`events_statements_summary_by_digest`） | 共 42 種，全部對得上 Node 程式的寫法（例如 `desktop_image_url AS desktopImageUrl`、`node_schema_migrations`）。沒有任何 Laravel 會下的查詢 | 舊後台、舊前台這段期間都沒有送查詢進來 |
| 3 | 各表讀寫次數（`table_io_waits_summary_by_table`） | §2-2 的舊表全部是 0 讀 0 寫。Laravel 每次 API 驗證都會讀 `oauth_access_tokens`，這裡也是 0 | 舊後台沒有被使用 |
| 4 | `oauth_access_tokens` 最後一筆 | 2026-06-30 | 舊後台最後一次登入是 4 個月前 |
| 5 | 正式前端設定（[第二階段 §E-1](Zeabur遷移Railway第二階段.md)，2026-10-21 人工核對） | `www.laborservice5690.com` 的前端，`NUXT_PUBLIC_API_BASE_URL` 是 `jinfengtestback.zeabur.app`（新版 Node） | 正式網站打的是新版 API |
| 6 | 前端的 OG 圖片 | 用 CloudFront（`d1vjl2px6hqzku.cloudfront.net`），沒有用到舊表 `seo.pic`（`upload/seo/...`，舊 Laravel 的路徑） | 前端也沒有從舊 Laravel 拿圖片 |

**補充說明：**

- **連線來源 IP 不能用來判斷是誰。** 所有連線（包括這次檢查自己的連線）都顯示成 `172.31.x.x`，那是 Zeabur 對外 port 的轉址 IP，不是真正的 client。所以本報告改用 client 名稱和 SQL 內容來判斷。
- **服務分在兩個 Zeabur project（推論）。** 新版前後端的 service ID（`6a9057…`、`6a9052…`）屬於 project `6a51652e…`，建立於 2026 年。這個 MySQL 所在的「Jinfeng」project（`667908…`）建立於 2024-06-24，裡面的 jinfeng-front、jinfeng-front-v2、jinfeng-back-v2、Redis 應該都是舊系統。新版 backend 是從另一個 project，透過 MySQL 的對外 port 連進來的。這是從 ID 的時間戳推出來的，§3-3 第 1 項要人工確認。
- **觀察期只有 32 天。** `performance_schema` 存在記憶體，重啟就會清空，所以 9/21 以前的流量看不到。但舊表最後寫入時間（2024-06-25）和最後一個 token（2026-06-30）都更早，結論一致。

### 3-3. 停用舊服務前要確認的三件事

| # | 確認項目 | 怎麼確認 |
|---|---|---|
| 1 | 正式網域沒有綁在舊服務上 | Zeabur「Jinfeng」project → jinfeng-front、jinfeng-front-v2、jinfeng-back-v2 → **網路／Domains**：不應該出現 `laborservice5690.com` 或任何還在用的網域 |
| 2 | 舊後台沒有人在用 | 問負責後台的人，現在登入的是不是新版後台。舊後台最後一次登入是 2026-06-30 |
| 3 | 先停用、觀察，再刪除 | 把 jinfeng-back-v2、jinfeng-front、jinfeng-front-v2、Redis **暫停**一到兩週，確認網站、表單、後台都正常再刪掉。暫停隨時可以恢復，刪除不能 |

三項都通過，DigitalOcean 上**只需要建三個東西**：新版 frontend、新版 backend、Managed MySQL。不需要 Redis，也不需要 Laravel。

## 4. 搬到 DigitalOcean 要準備的東西

### 4-1. 來源資料庫的設定

| 項目 | Zeabur 現況 | DigitalOcean 要注意 |
|---|---|---|
| 版本 | MySQL Community **8.0.33** | DO 只有 **8.4**，等於順便升版。要回退到 Zeabur 時是 8.4 → 8.0 的降版，要先演練 |
| 編碼 | `utf8mb4` / `utf8mb4_0900_ai_ci`。表本身多數是 `utf8mb4_unicode_ci`；`admin`、`browse`、`page_files`、`simple_setting` 有 `utf8mb3` 欄位 | 8.4 仍然支援 `utf8mb3`（已列為 deprecated），dump 會原樣保留 |
| 時區 | `time_zone=SYSTEM`，系統時區是 **UTC** | backend 用了 `dateStrings: true`，所以 DO 也要設成 **UTC**（`default_time_zone='+00:00'`） |
| `sql_mode` | `IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION` | DO 預設沒有 `IGNORE_SPACE`，可以在控制台設成一樣 |
| `lower_case_table_names` | 0 | 一致 |
| 引擎 | 15 張 MyISAM | **一定要轉 InnoDB**（§5） |
| 主鍵 | `password_resets` 沒有主鍵 | DO 預設 `sql_require_primary_key=ON`（§5 第 3 段） |
| view／trigger／routine／event／外鍵 | 都沒有 | dump 很單純 |
| binlog／GTID | binlog 開啟，GTID 關閉 | dump 要加 `--set-gtid-purged=OFF` |

### 4-2. 建議流程

```text
1. 匯出   Zeabur ──mysqldump──▶ zeabur-original.sql（原始檔留著，不要改）
2. 轉換   本機 Docker mysql:8.0.33 還原 → 執行 convert-myisam-to-innodb.sql → 再 dump 成 zeabur-innodb.sql
3. 確認   grep -c 'ENGINE=MyISAM' zeabur-innodb.sql 結果要是 0
4. 匯入   zeabur-innodb.sql ──▶ DigitalOcean 測試資料庫 → 跑 db:verify、QA 測試
5. 切換   停止寫入（後台暫停操作）→ 重做 1～4 → 切換 backend 的 DB_* → 驗證
```

匯出指令（帳密放在權限 600 的 cnf 檔，不要寫在指令列）：

```bash
mysqldump --defaults-extra-file=~/secure/zeabur.cnf \
  --single-transaction --routines --triggers --events \
  --set-gtid-purged=OFF --no-tablespaces \
  --databases zeabur > zeabur-original.sql
```

注意：MyISAM 表不支援 `--single-transaction`，所以 dump 的時候如果有人送出表單，資料可能不一致。資料量很小，dump 只要幾秒；正式切換時先停止寫入就好。

### 4-3. 除了資料庫以外

| 項目 | 要不要搬 | 說明 |
|---|---|---|
| 新版 backend 的環境變數 | ✅ | `DB_*`（改成 DO 的值）、`MAIL_*`、`RECIPIENT_EMAIL`、`AWS_*`、`CORS_ALLOWED_ORIGINS` 等。完整清單見 [後端環境變數設定清單.md](../後端環境變數設定清單.md) |
| 新版 frontend 的環境變數 | ✅ | `NUXT_PUBLIC_API_BASE_URL`（改成 DO backend 的網址）、`NUXT_PUBLIC_SITE_URL`、`NUXT_PUBLIC_GTM_ID` |
| 圖片 | ❌ | 都在 AWS S3 + CloudFront，和 Zeabur 無關 |
| Redis | ❌ | 新版程式沒有用到，只有舊 Laravel 的 queue 會用 |
| jinfeng-back-v2、jinfeng-front、jinfeng-front-v2 | ❌ | 先完成 §3-3 |
| DNS | ✅ | `laborservice5690.com` 改指到 DO |
| backend 程式 | ⚠️ 要改一處 | DO 要求 TLS 連線，[database.ts](../../backend/src/config/database.ts) 要加 `ssl` 設定（見 [遷移預算 §重點 2](../digitalocean-migration-budget.md)） |

## 5. MyISAM → InnoDB 轉換

SQL 檔：[convert-myisam-to-innodb.sql](convert-myisam-to-innodb.sql)

| 段落 | 內容 |
|---|---|
| 第 1 段 | 轉換前檢查：列出 MyISAM 表、記錄筆數和 AUTO_INCREMENT |
| 第 2 段 | 15 個 `ALTER TABLE … ENGINE = InnoDB`，分成「新版有用」和「舊 Laravel」兩組 |
| 第 3 段 | `password_resets` 加一個 `INVISIBLE` 主鍵。也可以改成在 DO 關掉 `sql_require_primary_key`，或乾脆不搬這張表 |
| 第 4 段 | 轉換後檢查：非 InnoDB 的表要是 0、沒有主鍵的表要是 0、筆數和 AUTO_INCREMENT 要和轉換前一致 |

**正式庫檢查結果：** 15 張表都有主鍵；沒有 FULLTEXT／SPATIAL 索引；沒有 `0000-00-00` 日期；InnoDB `row_format=DYNAMIC`，TEXT 欄位不會超過列大小限制。

**本機測試（2026-10-23）：** 在 Docker `mysql:8.0.33` 建立和正式庫相同的 schema，插入測試資料後執行。結果：15 張表都轉成 InnoDB；筆數和 AUTO_INCREMENT 都保留；`password_resets` 加主鍵後，不帶欄位清單的 `INSERT` 照常可用。

**⚠️ 這份 SQL 只能在副本上執行，不可以在 Zeabur 正式庫執行。**

**轉換會改變的行為：**

- **交易開始生效。** 程式裡的交易（例如 `contact_class` 的批次刪除）原本對 MyISAM 無效，轉換後出錯會整筆回滾。這是好事，但行為和現在不同，要用 [QA測試.md](../../QA測試.md) 測一次表單和後台 CRUD。
- **`db:verify` 會回報差異。** 15 筆引擎差異，加上 `password_resets` 多一個欄位，都是預期內的。切換確定後，再決定要不要更新 `database-schema.json`。
- **違反 repo 現有原則。** [001_create_tables.sql](../../backend/migrations/001_create_tables.sql) 的檔頭寫「不要把 MyISAM 轉成 InnoDB」，要在遷移文件裡記錄核准。

## 6. 安全事項

| # | 事項 | 建議 |
|---|---|---|
| 1 | root 密碼曾貼在 AI 對話中 | 搬完立刻在 Zeabur 更換 root 密碼，或直接停掉 Zeabur MySQL |
| 2 | `root@'%'` 開放對外連線，新版 backend 也是用 root 連 | DO 上另外建一個 backend 專用帳號，權限只給 `zeabur` 庫的 SELECT／INSERT／UPDATE／DELETE |
| 3 | DO 資料庫的對外存取 | Trusted Sources 只放行 App Platform |
| 4 | [docs/環境變數.md](../環境變數.md) 是未追蹤檔，裡面有舊 Laravel 和 Redis 的真實密碼 | 不要 commit。舊服務刪掉後，這份檔案也可以刪掉 |

## 7. 檢查用的唯讀查詢

```sql
-- 目前連線的 client 名稱
SELECT p.ID, p.DB, a.ATTR_NAME, a.ATTR_VALUE
FROM information_schema.processlist p
JOIN performance_schema.session_connect_attrs a ON a.PROCESSLIST_ID = p.ID;

-- 重啟以來各表的讀寫次數
SELECT OBJECT_NAME, COUNT_READ, COUNT_WRITE
FROM performance_schema.table_io_waits_summary_by_table
WHERE OBJECT_SCHEMA = 'zeabur';

-- 重啟以來的所有 SQL
SELECT DIGEST_TEXT, COUNT_STAR, LAST_SEEN
FROM performance_schema.events_statements_summary_by_digest
WHERE SCHEMA_NAME = 'zeabur' ORDER BY LAST_SEEN DESC;
```
