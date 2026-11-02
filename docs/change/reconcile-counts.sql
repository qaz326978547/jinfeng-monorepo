-- reconcile-counts.sql — 切換時的資料核對（唯讀）
--
-- 同一份查詢分別在三個地方執行，三份結果的每一列都要完全一樣：
--   1. Zeabur 正式庫（暫停寫入之後、備份之前）
--   2. build-newdata.sh 的第 6 步（會自動執行）
--   3. DigitalOcean 匯入之後
-- 執行前先選好資料庫（USE <db> 或在 mysql 指令列指定），本檔不寫死資料庫名稱。
--
-- 欄位：表名、精確筆數、最大 id、下一個 AUTO_INCREMENT。
-- node_schema_migrations 沒有 id，所以第 3 欄放最後一個 filename，第 4 欄為 NULL。

SET SESSION information_schema_stats_expiry = 0;
-- TIMESTAMP 欄位依連線時區顯示；三邊固定用 UTC，checksum 才會一致
SET SESSION time_zone = '+00:00';

SELECT t.tbl, t.row_count, t.max_id, i.AUTO_INCREMENT AS next_auto_increment
FROM (
  SELECT 'carousel' AS tbl, COUNT(*) AS row_count, CAST(MAX(id) AS CHAR) AS max_id FROM `carousel`
  UNION ALL SELECT 'consultations', COUNT(*), CAST(MAX(id) AS CHAR) FROM `consultations`
  UNION ALL SELECT 'contact',       COUNT(*), CAST(MAX(id) AS CHAR) FROM `contact`
  UNION ALL SELECT 'contact_class', COUNT(*), CAST(MAX(id) AS CHAR) FROM `contact_class`
  UNION ALL SELECT 'contact_list',  COUNT(*), CAST(MAX(id) AS CHAR) FROM `contact_list`
  UNION ALL SELECT 'contact_quest', COUNT(*), CAST(MAX(id) AS CHAR) FROM `contact_quest`
  UNION ALL SELECT 'faq',           COUNT(*), CAST(MAX(id) AS CHAR) FROM `faq`
  UNION ALL SELECT 'node_schema_migrations', COUNT(*), MAX(filename) FROM `node_schema_migrations`
  UNION ALL SELECT 'seo',           COUNT(*), CAST(MAX(id) AS CHAR) FROM `seo`
  UNION ALL SELECT 'users',         COUNT(*), CAST(MAX(id) AS CHAR) FROM `users`
) t
LEFT JOIN information_schema.TABLES i
  ON i.TABLE_SCHEMA = DATABASE() AND i.TABLE_NAME = t.tbl
ORDER BY t.tbl;

-- 內容核對：每張表整表的 checksum（同樣的資料、同樣的欄位 → 同樣的值，和引擎無關）
SELECT 'carousel' AS tbl, COUNT(*) AS n, BIT_XOR(CRC32(CONCAT_WS('#', id, title, desktop_image_key, desktop_image_url, mobile_image_key, mobile_image_url, link_type, link_url, sort_order, is_active, created_at, updated_at))) AS crc FROM `carousel`
UNION ALL SELECT 'consultations', COUNT(*), BIT_XOR(CRC32(CONCAT_WS('#', id, name, phone, company_name, tax_id, line_id, callback_times, message, status, created_at, updated_at))) FROM `consultations`
UNION ALL SELECT 'contact', COUNT(*), BIT_XOR(CRC32(CONCAT_WS('#', id, `class`, quest, company, tel, num, last5, ticket, ticket_name, ticket_no, ticket_address, `from`, suggest_name, del, `no`, created_at, updated_at))) FROM `contact`
UNION ALL SELECT 'contact_class', COUNT(*), BIT_XOR(CRC32(CONCAT_WS('#', id, name, `no`, del, created_at, updated_at))) FROM `contact_class`
UNION ALL SELECT 'contact_list', COUNT(*), BIT_XOR(CRC32(CONCAT_WS('#', id, name, cel, job, email, `no`, cid, created_at, updated_at))) FROM `contact_list`
UNION ALL SELECT 'contact_quest', COUNT(*), BIT_XOR(CRC32(CONCAT_WS('#', id, name, `no`, del, created_at, updated_at))) FROM `contact_quest`
UNION ALL SELECT 'faq', COUNT(*), BIT_XOR(CRC32(CONCAT_WS('#', id, class_id, name, `date`, pic, pic_alt, `file`, utube, s_info, info, info2, info3, info4, info5, be_click, act, p_home, p_new, p_hot, p_run, `no`, del, created_at, updated_at))) FROM `faq`
UNION ALL SELECT 'seo', COUNT(*), BIT_XOR(CRC32(CONCAT_WS('#', id, class_id, relate_id, tag, name, title, description, url, `type`, keyword, pic, pic_alt, del, created_at, updated_at))) FROM `seo`
UNION ALL SELECT 'users', COUNT(*), BIT_XOR(CRC32(CONCAT_WS('#', id, name, email, password, remember_token, created_at, updated_at, is_admin))) FROM `users`;
