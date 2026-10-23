-- 008_create_contact_idempotency_keys_table.sql
--
-- Duplicate-submission guard for POST /api/v2/contact (2026-10-24). One row per distinct
-- registration attempt that sent an `Idempotency-Key` header:
--
--   * The key is inserted as the FIRST statement of the registration transaction. A second
--     request with the same key — a double click, or a retry after a timeout — blocks on the
--     primary key until the first transaction finishes, then gets ER_DUP_ENTRY and is answered
--     with the registration that the first request created (no second contact row, no second
--     email). If the first transaction rolled back, the second one simply proceeds.
--   * `request_hash` (SHA-256 of the validated body) lets the API refuse a reused key that
--     arrives with different data (409) instead of silently replaying the wrong registration.
--   * A new form submission gets a new key from the frontend, so a genuine second
--     registration by the same company / person is never blocked.
--
-- `contact_id` is NULL only inside the still-open transaction that inserted the row; it is set
-- before commit. No FK to `contact` (contact rows can be deleted by admins; contact has never
-- had FKs). Rows are tiny (~100 B) and one per registration; `created_at` is indexed so old
-- keys can be purged later if ever needed.
--
-- InnoDB is required: the row lock on the primary key is what serialises concurrent
-- duplicates.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `contact_idempotency_keys` (
  `idempotency_key` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `request_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `contact_id` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idempotency_key`),
  KEY `idx_contact_idempotency_keys_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
