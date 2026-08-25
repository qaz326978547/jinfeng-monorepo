# database-schema.md — 資料庫結構規格

> 來源：對 Zeabur 正式資料庫執行唯讀 `information_schema` / `SHOW CREATE TABLE` 查詢。完整機器可讀版本見 `database-schema.json`。所有表格結構完全保留正式資料庫現況——**不重新命名、不正規化、不刪除看似未使用的欄位**。

**正式資料庫共 25 張表**，分類如下：

- **`API_USED_TABLE`**（6 張）：資料表被 `/api` 端點直接使用，需要在新 Node 專案完整支援讀寫。
- **`AUTH_RELATED_TABLE`**（6 張）：與登入/授權相關，但屬於 Laravel Passport 的內部機制。新專案重新設計驗證系統，**不需要**操作這些表；保留只是為了不修改既有資料庫結構（schema 完整性）。
- **`FRAMEWORK_METADATA_TABLE`**（3 張）：Laravel 框架自身使用的表，與本專案業務邏輯無關。
- **`LEGACY_OR_EXTERNAL_TABLE`**（9 張）：本專案原始碼完全沒有引用，疑似另一套系統共用同一資料庫。保留結構、不建立對應 API，除非未來取得需求方對這些表的用途說明。
- **`UNCONFIRMED_TABLE`**（1 張）：用途或使用狀態尚未能從程式碼 100% 確認。

全域確認事項：正式資料庫目前沒有任何生效中的 View、Trigger、Stored Procedure/Function，也沒有任何生效中的外鍵約束（唯讀查詢已確認 0 筆）。已知問題見 `known-legacy-issues.md`。


## API_USED_TABLE

資料表被 `/api` 端點直接使用，需要在新 Node 專案完整支援讀寫。

### `contact`

- **用途**：講座/課程報名主表。
- **Storage engine**：MyISAM
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：手動 `del` tinyint 旗標（非 ORM 內建 soft delete）
- **使用此資料表的 API**：POST /api/v2/contact, GET /api/v2/admin/contact, GET /api/v2/admin/contact/{id}, PUT /api/v2/admin/contact/{id}, DELETE /api/v2/admin/contact, GET /api/v2/admin/contact/search/search-company

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | no | no | - | yes | PK |
| 2 | `class` | text | 65535 | no | no | - | no | - |
| 3 | `quest` | text | 65535 | no | no | - | no | - |
| 4 | `company` | varchar | 60 | no | no | - | no | - |
| 5 | `tel` | varchar | 60 | no | no | - | no | - |
| 6 | `num` | varchar | 10 | no | no | - | no | - |
| 7 | `last5` | varchar | 5 | no | yes | - | no | - |
| 8 | `ticket` | varchar | 5 | no | yes | 2 | no | - |
| 9 | `ticket_name` | varchar | 30 | no | yes | - | no | - |
| 10 | `ticket_no` | varchar | 30 | no | yes | - | no | - |
| 11 | `ticket_address` | varchar | 60 | no | yes | - | no | - |
| 12 | `from` | varchar | 120 | no | yes | - | no | - |
| 13 | `suggest_name` | varchar | 30 | no | yes | - | no | - |
| 14 | `del` | tinyint | 3 | no | no | 0 | no | - |
| 15 | `no` | int | 10 | no | no | 0 | no | - |
| 16 | `created_at` | timestamp | - | no | yes | - | no | - |
| 17 | `updated_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `contact_class`

- **用途**：報名課程分類清單。
- **Storage engine**：MyISAM
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：手動 `del` tinyint 旗標（非 ORM 內建 soft delete）
- **使用此資料表的 API**：GET /api/v2/contact-class, GET /api/v2/admin/contact-class/{id}, POST /api/v2/admin/contact-class, PUT /api/v2/admin/contact-class/{id}, DELETE /api/v2/admin/contact-class

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | no | no | - | yes | PK |
| 2 | `name` | varchar | 255 | no | no | - | no | - |
| 3 | `no` | int | 10 | no | no | 0 | no | - |
| 4 | `del` | tinyint | 3 | no | no | 0 | no | - |
| 5 | `created_at` | timestamp | - | no | yes | - | no | - |
| 6 | `updated_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `contact_list`

- **用途**：報名表單的聯絡人清單（一個 contact 對多個聯絡人）。
- **Storage engine**：MyISAM
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：無
- **使用此資料表的 API**：GET /api/v2/admin/contact-list, GET /api/v2/admin/contact-list/{id}, POST /api/v2/contact (writes rows)

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | no | no | - | yes | PK |
| 2 | `name` | varchar | 30 | no | no | - | no | - |
| 3 | `cel` | varchar | 60 | no | yes | - | no | - |
| 4 | `job` | varchar | 60 | no | yes | - | no | - |
| 5 | `email` | varchar | 60 | no | yes | - | no | - |
| 6 | `no` | int | 10 | no | no | 0 | no | - |
| 7 | `cid` | int | 10 | no | no | - | no | MUL |
| 8 | `created_at` | timestamp | - | no | yes | - | no | - |
| 9 | `updated_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `contact_list_cid_index` (INDEX): cid
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `contact_quest`

- **用途**：報名表單的「問題」選項清單。
- **Storage engine**：MyISAM
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：手動 `del` tinyint 旗標（非 ORM 內建 soft delete）
- **使用此資料表的 API**：GET /api/v2/contact-quest

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | no | no | - | yes | PK |
| 2 | `name` | varchar | 255 | no | no | - | no | - |
| 3 | `no` | int | 10 | no | no | - | no | - |
| 4 | `del` | tinyint | 3 | no | no | - | no | - |
| 5 | `created_at` | timestamp | - | no | yes | - | no | - |
| 6 | `updated_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `faq`

- **用途**：常見問答內容。
- **Storage engine**：MyISAM
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：手動 `del` tinyint 旗標（非 ORM 內建 soft delete）
- **使用此資料表的 API**：GET /api/v2/faq

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | no | no | - | yes | PK |
| 2 | `class_id` | int | 10 | no | no | 0 | no | MUL |
| 3 | `name` | varchar | 255 | no | no | - | no | - |
| 4 | `date` | timestamp | - | no | yes | - | no | - |
| 5 | `pic` | varchar | 255 | no | yes | - | no | - |
| 6 | `pic_alt` | varchar | 255 | no | yes | - | no | - |
| 7 | `file` | varchar | 255 | no | yes | - | no | - |
| 8 | `utube` | text | 65535 | no | yes | - | no | - |
| 9 | `s_info` | text | 65535 | no | yes | - | no | - |
| 10 | `info` | text | 65535 | no | no | - | no | - |
| 11 | `info2` | text | 65535 | no | yes | - | no | - |
| 12 | `info3` | text | 65535 | no | yes | - | no | - |
| 13 | `info4` | text | 65535 | no | yes | - | no | - |
| 14 | `info5` | text | 65535 | no | yes | - | no | - |
| 15 | `be_click` | int | 10 | no | yes | - | no | - |
| 16 | `act` | tinyint | 3 | no | yes | - | no | - |
| 17 | `p_home` | tinyint | 3 | no | yes | - | no | - |
| 18 | `p_new` | tinyint | 3 | no | yes | - | no | - |
| 19 | `p_hot` | tinyint | 3 | no | yes | - | no | - |
| 20 | `p_run` | tinyint | 3 | no | yes | - | no | - |
| 21 | `no` | int | 10 | no | no | - | no | - |
| 22 | `del` | tinyint | 3 | no | yes | - | no | - |
| 23 | `created_at` | timestamp | - | no | yes | - | no | - |
| 24 | `updated_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id
- `upid` (INDEX): class_id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `seo`

- **用途**：SEO meta 資訊。
- **Storage engine**：MyISAM
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：手動 `del` tinyint 旗標（非 ORM 內建 soft delete）
- **使用此資料表的 API**：GET /api/v2/seo

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | no | no | - | yes | PK |
| 2 | `class_id` | int | 10 | no | yes | - | no | MUL |
| 3 | `relate_id` | int | 10 | no | no | - | no | - |
| 4 | `tag` | varchar | 20 | no | no | - | no | - |
| 5 | `name` | varchar | 150 | no | no | - | no | - |
| 6 | `title` | varchar | 255 | no | no | - | no | - |
| 7 | `description` | text | 65535 | no | no | - | no | - |
| 8 | `url` | varchar | 255 | no | no | - | no | - |
| 9 | `type` | varchar | 255 | no | no | - | no | - |
| 10 | `keyword` | varchar | 255 | no | no | - | no | - |
| 11 | `pic` | varchar | 120 | no | no | - | no | - |
| 12 | `pic_alt` | varchar | 255 | no | no | - | no | - |
| 13 | `del` | tinyint | 3 | no | no | - | no | - |
| 14 | `created_at` | timestamp | - | no | yes | - | no | - |
| 15 | `updated_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id
- `upid` (INDEX): class_id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）


## AUTH_RELATED_TABLE

與登入/授權相關，但屬於 Laravel Passport 的內部機制。新專案重新設計驗證系統，**不需要**操作這些表；保留只是為了不修改既有資料庫結構（schema 完整性）。

### `oauth_access_tokens`

- **用途**：Laravel Passport 簽發的 access token 紀錄。新專案改用自有驗證機制，不會寫入此表，僅為 schema 完整性保留（不刪除既有表）。
- **Storage engine**：InnoDB
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：無
- **使用此資料表的 API**：POST /api/v2/auth/login (write), POST /api/v2/auth/logout (write)

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | varchar | 100 | no | no | - | no | PK |
| 2 | `user_id` | bigint | 19 | no | yes | - | no | MUL |
| 3 | `client_id` | int | 10 | yes | no | - | no | - |
| 4 | `name` | varchar | 255 | no | yes | - | no | - |
| 5 | `scopes` | text | 65535 | no | yes | - | no | - |
| 6 | `revoked` | tinyint | 3 | no | no | - | no | - |
| 7 | `created_at` | timestamp | - | no | yes | - | no | - |
| 8 | `updated_at` | timestamp | - | no | yes | - | no | - |
| 9 | `expires_at` | datetime | - | no | yes | - | no | - |

**Indexes**：
- `oauth_access_tokens_user_id_index` (INDEX): user_id
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `oauth_auth_codes`

- **用途**：Laravel Passport OAuth Authorization Code。新專案不使用，僅為 schema 完整性保留。
- **Storage engine**：InnoDB
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：無 / 無
- **Soft delete**：無
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | varchar | 100 | no | no | - | no | PK |
| 2 | `user_id` | bigint | 19 | no | no | - | no | - |
| 3 | `client_id` | int | 10 | yes | no | - | no | - |
| 4 | `scopes` | text | 65535 | no | yes | - | no | - |
| 5 | `revoked` | tinyint | 3 | no | no | - | no | - |
| 6 | `expires_at` | datetime | - | no | yes | - | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `oauth_clients`

- **用途**：Laravel Passport OAuth client 清單。新專案不使用，僅為 schema 完整性保留。
- **Storage engine**：InnoDB
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：無
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | yes | no | - | yes | PK |
| 2 | `user_id` | bigint | 19 | no | yes | - | no | MUL |
| 3 | `name` | varchar | 255 | no | no | - | no | - |
| 4 | `secret` | varchar | 100 | no | no | - | no | - |
| 5 | `redirect` | text | 65535 | no | no | - | no | - |
| 6 | `personal_access_client` | tinyint | 3 | no | no | - | no | - |
| 7 | `password_client` | tinyint | 3 | no | no | - | no | - |
| 8 | `revoked` | tinyint | 3 | no | no | - | no | - |
| 9 | `created_at` | timestamp | - | no | yes | - | no | - |
| 10 | `updated_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `oauth_clients_user_id_index` (INDEX): user_id
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `oauth_personal_access_clients`

- **用途**：標記哪個 oauth_clients 是 Personal Access Client。新專案不使用，僅為 schema 完整性保留。
- **Storage engine**：InnoDB
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：無
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | yes | no | - | yes | PK |
| 2 | `client_id` | int | 10 | yes | no | - | no | MUL |
| 3 | `created_at` | timestamp | - | no | yes | - | no | - |
| 4 | `updated_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `oauth_personal_access_clients_client_id_index` (INDEX): client_id
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `oauth_refresh_tokens`

- **用途**：Laravel Passport refresh token。新專案不使用，僅為 schema 完整性保留。
- **Storage engine**：InnoDB
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：無 / 無
- **Soft delete**：無
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | varchar | 100 | no | no | - | no | PK |
| 2 | `access_token_id` | varchar | 100 | no | no | - | no | MUL |
| 3 | `revoked` | tinyint | 3 | no | no | - | no | - |
| 4 | `expires_at` | datetime | - | no | yes | - | no | - |

**Indexes**：
- `oauth_refresh_tokens_access_token_id_index` (INDEX): access_token_id
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `users`

- **用途**：應用程式使用者帳號（含 is_admin 旗標）。新專案沿用此表存放帳號/密碼，登入邏輯重新實作，但資料表本身保留。
- **Storage engine**：InnoDB
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：無
- **使用此資料表的 API**：POST /api/v2/auth/login, POST /api/v2/auth/register, POST /api/v2/auth/logout (indirect)

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | yes | no | - | yes | PK |
| 2 | `name` | varchar | 255 | no | no | - | no | - |
| 3 | `email` | varchar | 255 | no | no | - | no | UNI |
| 4 | `password` | varchar | 255 | no | no | - | no | - |
| 5 | `remember_token` | varchar | 100 | no | yes | - | no | - |
| 6 | `created_at` | timestamp | - | no | yes | - | no | - |
| 7 | `updated_at` | timestamp | - | no | yes | - | no | - |
| 8 | `is_admin` | tinyint | 3 | no | no | 0 | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id
- `users_email_unique` (UNIQUE): email

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）


## FRAMEWORK_METADATA_TABLE

Laravel 框架自身使用的表，與本專案業務邏輯無關。

### `jobs`

- **用途**：Laravel 佇列表，用於非同步寄送報名通知信。新專案若採用不同的 queue 機制（例如 BullMQ + Redis）則不需要此表，僅為 schema 完整性保留。
- **Storage engine**：InnoDB
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 無
- **Soft delete**：無
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | bigint | 20 | yes | no | - | yes | PK |
| 2 | `queue` | varchar | 255 | no | no | - | no | MUL |
| 3 | `payload` | longtext | 4294967295 | no | no | - | no | - |
| 4 | `attempts` | tinyint | 3 | yes | no | - | no | - |
| 5 | `reserved_at` | int | 10 | yes | yes | - | no | - |
| 6 | `available_at` | int | 10 | yes | no | - | no | - |
| 7 | `created_at` | int | 10 | yes | no | - | no | - |

**Indexes**：
- `jobs_queue_index` (INDEX): queue
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `migrations`

- **用途**：UNCONFIRMED
- **Storage engine**：InnoDB
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：無 / 無
- **Soft delete**：無
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | yes | no | - | yes | PK |
| 2 | `migration` | varchar | 255 | no | no | - | no | - |
| 3 | `batch` | int | 10 | no | no | - | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `password_resets`

- **用途**：Laravel 內建忘記密碼 token 表。新專案若不做忘記密碼功能可不使用，但保留結構供未來需要時使用。
- **Storage engine**：InnoDB
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 無
- **Soft delete**：無
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `email` | varchar | 255 | no | no | - | no | MUL |
| 2 | `token` | varchar | 255 | no | no | - | no | - |
| 3 | `created_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `password_resets_email_index` (INDEX): email

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）


## LEGACY_OR_EXTERNAL_TABLE

本專案原始碼完全沒有引用，疑似另一套系統共用同一資料庫。保留結構、不建立對應 API，除非未來取得需求方對這些表的用途說明。

### `admin`

- **用途**：UNCONFIRMED — 疑似另一套（非本專案）後台系統的管理員帳號表。
- **Storage engine**：MyISAM
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：無
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | no | no | - | yes | PK |
| 2 | `account` | varchar | 30 | no | no |  | no | UNI |
| 3 | `password` | varchar | 120 | no | yes | - | no | - |
| 4 | `m_pass_rem` | tinyint | 3 | no | no | 0 | no | - |
| 5 | `m_pass_ans` | varchar | 30 | no | no |  | no | - |
| 6 | `created_at` | timestamp | - | no | yes | - | no | - |
| 7 | `updated_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `m_username` (UNIQUE): account
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `browse`

- **用途**：UNCONFIRMED — 疑似瀏覽區塊/輪播設定。
- **Storage engine**：MyISAM
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：手動 `del` tinyint 旗標（非 ORM 內建 soft delete）
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | no | no | - | yes | PK |
| 2 | `name` | varchar | 60 | no | no | - | no | - |
| 3 | `start_num` | int | 10 | no | no | - | no | - |
| 4 | `link` | text | 65535 | no | no | - | no | - |
| 5 | `pic` | varchar | 255 | no | no | - | no | - |
| 6 | `act` | tinyint | 3 | no | no | - | no | - |
| 7 | `no` | int | 10 | no | no | - | no | - |
| 8 | `del` | tinyint | 3 | no | no | - | no | - |
| 9 | `created_at` | timestamp | - | no | yes | - | no | - |
| 10 | `updated_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `browse_record`

- **用途**：UNCONFIRMED — 疑似瀏覽次數統計紀錄。
- **Storage engine**：MyISAM
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：無
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | no | no | - | yes | PK |
| 2 | `num` | int | 10 | no | no | - | no | - |
| 3 | `date` | date | - | no | no | - | no | - |
| 4 | `created_at` | timestamp | - | no | yes | - | no | - |
| 5 | `updated_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `faq_class`

- **用途**：UNCONFIRMED — 疑似 faq 的分類/方案表。
- **Storage engine**：MyISAM
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：手動 `del` tinyint 旗標（非 ORM 內建 soft delete）
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | no | no | - | yes | PK |
| 2 | `class_id` | int | 10 | no | no | - | no | MUL |
| 3 | `history` | varchar | 150 | no | no | - | no | - |
| 4 | `name` | varchar | 100 | no | no | - | no | - |
| 5 | `e_name` | varchar | 100 | no | no | - | no | - |
| 6 | `pic` | varchar | 255 | no | no | - | no | - |
| 7 | `pic_alt` | varchar | 255 | no | no | - | no | - |
| 8 | `s_info` | text | 65535 | no | no | - | no | - |
| 9 | `info` | text | 65535 | no | no | - | no | - |
| 10 | `discount` | float | 12 | no | no | - | no | - |
| 11 | `act` | tinyint | 3 | no | no | - | no | - |
| 12 | `p_home` | tinyint | 3 | no | no | - | no | - |
| 13 | `no` | int | 10 | no | no | 100 | no | - |
| 14 | `del` | tinyint | 3 | no | no | - | no | - |
| 15 | `created_at` | timestamp | - | no | yes | - | no | - |
| 16 | `updated_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id
- `upid` (INDEX): class_id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `page`

- **用途**：UNCONFIRMED — 疑似 CMS 頁面內容表。
- **Storage engine**：MyISAM
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：手動 `del` tinyint 旗標（非 ORM 內建 soft delete）
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | no | no | - | yes | PK |
| 2 | `path` | varchar | 50 | no | no | - | no | - |
| 3 | `title` | varchar | 255 | no | no | - | no | - |
| 4 | `name` | varchar | 60 | no | no | - | no | - |
| 5 | `e_name` | varchar | 255 | no | no | - | no | - |
| 6 | `sub_name` | varchar | 255 | no | no | - | no | - |
| 7 | `pic` | varchar | 255 | no | no | - | no | - |
| 8 | `pic_alt` | varchar | 255 | no | no | - | no | - |
| 9 | `file` | varchar | 255 | no | no | - | no | - |
| 10 | `link` | text | 65535 | no | no | - | no | - |
| 11 | `utube` | text | 65535 | no | no | - | no | - |
| 12 | `s_info` | text | 65535 | no | no | - | no | - |
| 13 | `info` | text | 65535 | no | no | - | no | - |
| 14 | `act` | tinyint | 3 | no | no | - | no | - |
| 15 | `no` | int | 10 | no | no | - | no | - |
| 16 | `del` | tinyint | 3 | no | no | - | no | - |
| 17 | `created_at` | timestamp | - | no | yes | - | no | - |
| 18 | `updated_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `page_files`

- **用途**：UNCONFIRMED — 疑似 page 的附加檔案。
- **Storage engine**：MyISAM
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：手動 `del` tinyint 旗標（非 ORM 內建 soft delete）
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | no | no | - | yes | PK |
| 2 | `pid` | int | 10 | no | no | - | no | MUL |
| 3 | `name` | varchar | 30 | no | no | - | no | - |
| 4 | `file` | varchar | 255 | no | no | - | no | - |
| 5 | `info` | text | 65535 | no | no | - | no | - |
| 6 | `act` | tinyint | 3 | no | no | 1 | no | - |
| 7 | `no` | int | 10 | no | no | - | no | - |
| 8 | `del` | tinyint | 3 | no | no | - | no | - |
| 9 | `created_at` | timestamp | - | no | yes | - | no | - |
| 10 | `updated_at` | timestamp | - | no | yes | - | no | - |
| 11 | `session_id` | varchar | 200 | no | no | - | no | - |
| 12 | `counts` | int | 10 | no | no | - | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id
- `upid` (INDEX): pid

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `page_pics`

- **用途**：UNCONFIRMED — 疑似 page 的圖片附件。
- **Storage engine**：MyISAM
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：手動 `del` tinyint 旗標（非 ORM 內建 soft delete）
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | no | no | - | yes | PK |
| 2 | `pid` | int | 10 | no | no | - | no | MUL |
| 3 | `name` | varchar | 30 | no | no | - | no | - |
| 4 | `pic` | varchar | 255 | no | no | - | no | - |
| 5 | `s_pic` | varchar | 255 | no | no | - | no | - |
| 6 | `info` | text | 65535 | no | no | - | no | - |
| 7 | `no` | int | 10 | no | no | - | no | - |
| 8 | `del` | tinyint | 3 | no | no | - | no | - |
| 9 | `created_at` | timestamp | - | no | yes | - | no | - |
| 10 | `updated_at` | timestamp | - | no | yes | - | no | - |
| 11 | `session_id` | varchar | 200 | no | no | - | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id
- `upid` (INDEX): pid

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `seo_class`

- **用途**：UNCONFIRMED — 疑似 seo 的分類/方案表。
- **Storage engine**：MyISAM
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：手動 `del` tinyint 旗標（非 ORM 內建 soft delete）
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | no | no | - | yes | PK |
| 2 | `class_id` | int | 10 | no | no | - | no | MUL |
| 3 | `history` | varchar | 150 | no | no | - | no | - |
| 4 | `relate_id` | int | 10 | no | no | - | no | - |
| 5 | `name` | varchar | 100 | no | no | - | no | - |
| 6 | `title` | varchar | 255 | no | no | - | no | - |
| 7 | `description` | text | 65535 | no | no | - | no | - |
| 8 | `url` | varchar | 255 | no | no | - | no | - |
| 9 | `type` | varchar | 255 | no | no | - | no | - |
| 10 | `keyword` | varchar | 255 | no | no | - | no | - |
| 11 | `pic` | varchar | 180 | no | no | - | no | - |
| 12 | `del` | tinyint | 3 | no | no | - | no | - |
| 13 | `created_at` | timestamp | - | no | yes | - | no | - |
| 14 | `updated_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id
- `upid` (INDEX): class_id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）

### `simple_setting`

- **用途**：UNCONFIRMED — 疑似系統簡易設定表（含 line_notify_token）。
- **Storage engine**：MyISAM
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：手動 `del` tinyint 旗標（非 ORM 內建 soft delete）
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | no | no | - | yes | PK |
| 2 | `name` | varchar | 255 | no | no | - | no | - |
| 3 | `line_notify_token` | varchar | 255 | no | no | - | no | - |
| 4 | `del` | tinyint | 3 | no | no | - | no | - |
| 5 | `created_at` | timestamp | - | no | yes | - | no | - |
| 6 | `updated_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）


## UNCONFIRMED_TABLE

用途或使用狀態尚未能從程式碼 100% 確認。

### `contact_img`

- **用途**：推測為報名頁面圖片素材表，目前 0 筆資料、無任何 API 使用。
- **Storage engine**：InnoDB
- **Charset / Collation**：utf8mb4 / utf8mb4_unicode_ci
- **created_at / updated_at**：有 / 有
- **Soft delete**：無
- **使用此資料表的 API**：無

| # | Column | SQL Type | Length/Precision | Unsigned | Nullable | Default | Auto Inc | Key |
|---|---|---|---|---|---|---|---|---|
| 1 | `id` | int | 10 | yes | no | - | yes | PK |
| 2 | `imageUrl` | varchar | 255 | no | no | - | no | - |
| 3 | `content` | varchar | 255 | no | no | - | no | - |
| 4 | `created_at` | timestamp | - | no | yes | - | no | - |
| 5 | `updated_at` | timestamp | - | no | yes | - | no | - |

**Indexes**：
- `PRIMARY` (PRIMARY KEY): id

**Foreign Keys**：無（正式資料庫此表目前沒有任何生效中的外鍵約束）
