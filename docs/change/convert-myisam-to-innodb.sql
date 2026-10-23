-- convert-myisam-to-innodb.sql
--
-- ⚠️ 2026-10-23 起正式切換改用 build-newdata.sh（會刪掉 18 張舊 Laravel 表、只保留 10 張表，
--    password_resets 也不搬）。本檔保留給「保留全部 28 張表」的情境參考，見 NewData報告.md。
--
-- 用途：把 `zeabur` schema 的 15 張 MyISAM 表轉成 InnoDB，讓資料可以匯入
--       DigitalOcean Managed MySQL（不允許 MyISAM，且預設 sql_require_primary_key=ON）。
--
-- 依據：2026-10-23 對 Zeabur 正式庫（MySQL 8.0.33）做的唯讀檢查：
--   - 15 張 MyISAM 表都有 PRIMARY KEY，沒有 FULLTEXT／SPATIAL 索引，沒有 0000-00-00 日期
--   - 沒有 view／trigger／routine／event，沒有外鍵
--   - 唯一沒有主鍵的是 `password_resets`（InnoDB，0 筆，Laravel 舊表）
--
-- ⚠️ 不可以直接在 Zeabur 正式庫執行。執行位置只有兩種：
--   (A) 本機 Docker 的 MySQL 8.0.33，裡面是從正式庫 mysqldump 還原的「副本」，
--       轉完再 dump 一次，拿新的 dump 匯入 DigitalOcean。（建議）
--   (B) 已經匯入 DigitalOcean 的測試資料庫（只有在 dump 已用 sed 改掉 ENGINE=MyISAM 時才會走到這步，
--       這時第 2 段的 ALTER 都會是 no-op，只需要第 3、4 段）
--
-- 這個檔案不放在 backend/migrations/：那裡的檔案會被 `npm run db:migrate` 套用，
-- 而 001_create_tables.sql 的原則是「本機／測試庫要和正式庫的引擎一致」。
-- 轉換後 `npm run db:verify` 會回報 15 筆引擎差異（+ password_resets 多一個欄位），屬預期結果；
-- 是否同步更新 database-schema.json 快照，等 DigitalOcean 切換確定後另外處理。

USE `zeabur`;

-- MySQL 8.0 預設快取 information_schema 統計 24 小時，不關掉的話
-- table_rows／auto_increment 會是舊值或 NULL（只影響這個連線）
SET SESSION information_schema_stats_expiry = 0;

-- ---------------------------------------------------------------------------
-- 第 1 段：轉換前檢查（全部唯讀）
-- ---------------------------------------------------------------------------

-- 1-1. 應該列出 15 張 MyISAM 表
SELECT table_name, engine, table_rows
FROM information_schema.tables
WHERE table_schema = 'zeabur' AND engine = 'MyISAM'
ORDER BY table_name;

-- 1-2. 記下轉換前的精確筆數（MyISAM 的 table_rows 是精確值，但還是用 COUNT(*) 留底）
SELECT 'admin' t, COUNT(*) n FROM `admin`
UNION ALL SELECT 'browse',         COUNT(*) FROM `browse`
UNION ALL SELECT 'browse_record',  COUNT(*) FROM `browse_record`
UNION ALL SELECT 'contact',        COUNT(*) FROM `contact`
UNION ALL SELECT 'contact_class',  COUNT(*) FROM `contact_class`
UNION ALL SELECT 'contact_list',   COUNT(*) FROM `contact_list`
UNION ALL SELECT 'contact_quest',  COUNT(*) FROM `contact_quest`
UNION ALL SELECT 'faq',            COUNT(*) FROM `faq`
UNION ALL SELECT 'faq_class',      COUNT(*) FROM `faq_class`
UNION ALL SELECT 'page',           COUNT(*) FROM `page`
UNION ALL SELECT 'page_files',     COUNT(*) FROM `page_files`
UNION ALL SELECT 'page_pics',      COUNT(*) FROM `page_pics`
UNION ALL SELECT 'seo',            COUNT(*) FROM `seo`
UNION ALL SELECT 'seo_class',      COUNT(*) FROM `seo_class`
UNION ALL SELECT 'simple_setting', COUNT(*) FROM `simple_setting`;

-- 1-3. 記下轉換前的 AUTO_INCREMENT（ALTER 會保留，轉完用第 4-3 段比對）
SELECT table_name, auto_increment
FROM information_schema.tables
WHERE table_schema = 'zeabur' AND engine = 'MyISAM'
ORDER BY table_name;

-- ---------------------------------------------------------------------------
-- 第 2 段：引擎轉換
-- 每張表都是完整重建；資料量 < 1 MB，整段幾秒內完成。
-- MyISAM 不支援交易，ALTER 本身是原子的（失敗會保留原表），可以逐張重跑。
-- ---------------------------------------------------------------------------

-- 新版 backend 有使用的表
ALTER TABLE `contact`        ENGINE = InnoDB;
ALTER TABLE `contact_class`  ENGINE = InnoDB;
ALTER TABLE `contact_list`   ENGINE = InnoDB;
ALTER TABLE `contact_quest`  ENGINE = InnoDB;
ALTER TABLE `faq`            ENGINE = InnoDB;
ALTER TABLE `seo`            ENGINE = InnoDB;

-- 舊 Laravel 留下、新版 backend 沒有使用的表（保留結構與資料，只換引擎）
ALTER TABLE `admin`          ENGINE = InnoDB;
ALTER TABLE `browse`         ENGINE = InnoDB;
ALTER TABLE `browse_record`  ENGINE = InnoDB;
ALTER TABLE `faq_class`      ENGINE = InnoDB;
ALTER TABLE `page`           ENGINE = InnoDB;
ALTER TABLE `page_files`     ENGINE = InnoDB;
ALTER TABLE `page_pics`      ENGINE = InnoDB;
ALTER TABLE `seo_class`      ENGINE = InnoDB;
ALTER TABLE `simple_setting` ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- 第 3 段：password_resets 補主鍵（二選一）
--
-- 選項 A（本檔採用）：加一個 INVISIBLE 主鍵。`SELECT *` 看不到它，
--   不帶欄位清單的 INSERT 也照常可用（本機 8.0.33 實測）。需要 MySQL ≥ 8.0.23。
-- 選項 B：不跑這段，改在 DigitalOcean 控制台把 sql_require_primary_key 關掉。
-- 選項 C：這張表 0 筆、只有舊 Laravel 會用，也可以不搬（dump 時用 --ignore-table 排除）。
--   但 db:verify 會回報少一張表。
-- ---------------------------------------------------------------------------

ALTER TABLE `password_resets`
  ADD COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT INVISIBLE FIRST,
  ADD PRIMARY KEY (`id`);

-- ---------------------------------------------------------------------------
-- 第 4 段：轉換後檢查（全部唯讀）
-- ---------------------------------------------------------------------------

-- 4-1. 應該回傳 0 列
SELECT table_name, engine
FROM information_schema.tables
WHERE table_schema = 'zeabur' AND engine <> 'InnoDB' AND table_type = 'BASE TABLE';

-- 4-2. 應該回傳 0 列（沒有主鍵的表）
SELECT t.table_name
FROM information_schema.tables t
LEFT JOIN information_schema.table_constraints k
  ON k.table_schema = t.table_schema AND k.table_name = t.table_name
 AND k.constraint_type = 'PRIMARY KEY'
WHERE t.table_schema = 'zeabur' AND t.table_type = 'BASE TABLE' AND k.constraint_name IS NULL;

-- 4-3. 筆數與 AUTO_INCREMENT：重跑第 1-2 段，結果要和轉換前完全相同；
--      auto_increment 至少要等於轉換前的值
SELECT table_name, engine, auto_increment
FROM information_schema.tables
WHERE table_schema = 'zeabur'
ORDER BY table_name;
