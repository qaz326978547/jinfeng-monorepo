-- 006_create_carousel_table.sql
--
-- New table for the admin-managed homepage carousel feature. Unlike 001-005 (verbatim
-- copies of the legacy Laravel production schema), this table has no legacy counterpart —
-- it is a brand-new Node/Admin feature (see specs/backend/laravel-to-node-parity.md
-- convention for "new, not legacy parity" features such as FAQ admin).
--
-- Rebuilt (not appended as 007) to a desktop/mobile dual-image design before this feature
-- ever reached production — there is no data to preserve and no backward-compat concern.
-- Each carousel row carries TWO images (desktop 1920x1080 16:9, mobile 700x800 7:8), not
-- two separate rows — the frontend picks the right one via a CSS <picture> breakpoint
-- (max-width: 767px), not a separate carousel entry per device.
--
-- ENGINE=InnoDB (not MyISAM): all legacy tables in 001_create_tables.sql are MyISAM because
-- that's what production already used and this migration set preserves it verbatim, but
-- transaction.ts explicitly notes MyISAM silently ignores transaction boundaries. This table
-- has no legacy constraint, so it uses InnoDB to get real transactional semantics.
--
-- created_at/updated_at use DB-level DEFAULT/ON UPDATE CURRENT_TIMESTAMP (unlike faq/contact,
-- which must set NOW() manually in every query because the legacy columns have no DB default —
-- see faq.repository.ts). A new table can just do this correctly from the start.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `carousel` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `desktop_image_key` varchar(1024) NOT NULL,
  `desktop_image_url` varchar(2048) NOT NULL,
  `mobile_image_key` varchar(1024) NOT NULL,
  `mobile_image_url` varchar(2048) NOT NULL,
  `link_type` enum('internal','external','none') NOT NULL DEFAULT 'none',
  `link_url` varchar(1000) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_carousel_active_sort` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
