-- 007_create_labor_news_table.sql
--
-- New table for the admin-managed "勞資 News" (labor/employment news) feature. Like
-- 006_create_carousel_table.sql, this has no legacy counterpart — it is a brand-new
-- Node/Admin feature (see specs/backend/laravel-to-node-parity.md convention for
-- "new, not legacy parity" features).
--
-- No image support in this first version (imageKey/imageUrl are deliberately omitted —
-- to be added as a separate migration later if/when the feature grows one).
--
-- sort_order has no UNIQUE constraint on purpose: admins are allowed to give two rows the
-- same sort_order (ties are broken by published_at DESC, then id DESC — see the ORDER BY
-- used by every list query in labor-news.repository.ts), so editing one row's sort_order
-- never risks a unique-constraint conflict with another.
--
-- ENGINE=InnoDB + DB-level created_at/updated_at defaults, same rationale as the carousel
-- table: this is a new table with no legacy constraint, so it can do both correctly from
-- the start.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `labor_news` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(500) NOT NULL,
  `source_name` varchar(255) NOT NULL,
  `source_url` varchar(2048) NOT NULL,
  `published_at` date NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_labor_news_active_sort_published` (`is_active`, `sort_order`, `published_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
