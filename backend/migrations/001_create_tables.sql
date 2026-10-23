-- 001_create_tables.sql
--
-- Creates the 7 legacy tables the Node backend actually reads/writes. Column names, types,
-- lengths, defaults, character sets, and indexes are copied verbatim from the Zeabur production
-- MySQL database ("zeabur" schema, READ-ONLY `SHOW CREATE TABLE`, 2026-07-21) — do NOT rename,
-- retype, re-normalize, or drop columns that look unused: several repositories use `SELECT *`
-- and return the whole row through the API.
--
-- 2026-10-23 — DigitalOcean migration (docs/change/NewData報告.md):
--   * Every table is now ENGINE=InnoDB. DigitalOcean Managed MySQL rejects MyISAM, and
--     production's six former MyISAM tables (contact, contact_class, contact_quest,
--     contact_list, faq, seo) were converted when the data was moved there. Transactions in
--     contact.repository.ts / contact-class.repository.ts are therefore real now.
--   * The 17 tables only the old Laravel app used are no longer created here: admin, browse,
--     browse_record, contact_img, faq_class, jobs, oauth_access_tokens, oauth_auth_codes,
--     oauth_clients, oauth_personal_access_clients, oauth_refresh_tokens, page, page_files,
--     page_pics, password_resets, seo_class, simple_setting. (Laravel's own `migrations` table
--     was never created by this file.) Their last data is archived in the pre-migration Zeabur
--     backup, outside the repo.
--   * The other tables in the reference snapshot come from elsewhere: `carousel` (006),
--     `consultations` (007), `contact_idempotency_keys` (008), `node_schema_migrations`
--     (scripts/migrate.ts). The full expected
--     schema is src/infrastructure/database/schema/database-schema.json (`npm run db:verify`).
--
-- Editing this file does NOT touch databases that already applied it: scripts/migrate.ts
-- tracks applied files by filename in `node_schema_migrations` and never re-runs or diffs them.
-- A database created from the previous version keeps its legacy tables and MyISAM engines —
-- `db:verify` reports the engine difference; recreate the database to pick up this version.
--
-- `IF NOT EXISTS` is added so this script is safe to run repeatedly against a fresh local/test
-- database. Never run migrations against the old Zeabur production database.

SET NAMES utf8mb4;

-- ============================================================
-- Admin login (originally Laravel's users table)
-- ============================================================

CREATE TABLE IF NOT EXISTS `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `remember_token` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `is_admin` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Business tables used by the API
-- ============================================================

CREATE TABLE IF NOT EXISTS `contact` (
  `id` int NOT NULL AUTO_INCREMENT,
  `class` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `quest` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `company` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tel` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `num` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `last5` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ticket` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '2',
  `ticket_name` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ticket_no` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ticket_address` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `from` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `suggest_name` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `del` tinyint(1) NOT NULL DEFAULT '0',
  `no` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contact_class` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `no` int NOT NULL DEFAULT '0',
  `del` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contact_quest` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `no` int NOT NULL,
  `del` tinyint(1) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contact_list` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `cel` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `job` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `no` int NOT NULL DEFAULT '0',
  `cid` int NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `contact_list_cid_index` (`cid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `faq` (
  `id` int NOT NULL AUTO_INCREMENT,
  `class_id` int NOT NULL DEFAULT '0',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` timestamp NULL DEFAULT NULL,
  `pic` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pic_alt` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `utube` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `s_info` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `info` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `info2` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `info3` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `info4` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `info5` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `be_click` int DEFAULT NULL,
  `act` tinyint(1) DEFAULT NULL,
  `p_home` tinyint(1) DEFAULT NULL,
  `p_new` tinyint(1) DEFAULT NULL,
  `p_hot` tinyint(1) DEFAULT NULL,
  `p_run` tinyint(1) DEFAULT NULL,
  `no` int NOT NULL,
  `del` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `upid` (`class_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `seo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `class_id` int DEFAULT NULL,
  `relate_id` int NOT NULL,
  `tag` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `keyword` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `pic` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `pic_alt` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `del` tinyint(1) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `upid` (`class_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
