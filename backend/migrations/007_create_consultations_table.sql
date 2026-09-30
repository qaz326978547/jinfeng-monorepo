-- 007_create_consultations_table.sql
--
-- New table for the "免費諮詢" (free consultation) public lead-capture form,
-- fully separate from the legacy contact/contact_class/contact_quest tables
-- that back course registration ("勞動法務速成講座報名") — no legacy
-- counterpart, brand-new Node/Admin feature, same treatment as
-- 006_create_carousel_table.sql.
--
-- ENGINE=InnoDB (real transactional semantics; no legacy MyISAM constraint here).
--
-- callback_times is a JSON array of enum strings (subset of
-- anytime/morning/noon/afternoon/evening) — validated server-side in Zod
-- (consultation.schemas.ts), including the "anytime is mutually exclusive
-- with all other values" and "no duplicates" rules. The DB column itself
-- just stores the array; it does not re-enforce those rules (MySQL JSON
-- columns have no array-content CHECK).
--
-- status uses the same ENUM convention as carousel.link_type (006) rather
-- than a free-text varchar, so an invalid status can never be written even
-- by a raw SQL mistake. The public POST endpoint never accepts this field
-- at all (Zod schema strips unknown keys) and the INSERT never sets it,
-- relying purely on DEFAULT 'pending'.
--
-- created_at/updated_at use DB-level DEFAULT/ON UPDATE CURRENT_TIMESTAMP
-- (new table, same convention as carousel) — no manual NOW() needed in
-- repository INSERT/UPDATE.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `consultations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `company_name` varchar(200) DEFAULT NULL,
  `tax_id` varchar(50) DEFAULT NULL,
  `line_id` varchar(100) DEFAULT NULL,
  `callback_times` json NOT NULL,
  `message` varchar(1000) DEFAULT NULL,
  `status` enum('pending','contacted','completed') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_consultations_status_created` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
