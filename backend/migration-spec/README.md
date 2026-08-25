# Migration Spec — Node.js 重建規格文件

## 1. 文件目的

給一個全新的 Node.js 22 + TypeScript + Express + Zod 專案使用的重建規格。目標是讓新專案：

- 保留原本 `/api` 路徑、HTTP method、request/response 欄位名稱與型別、主要商業邏輯
- 保留原本資料庫 table/column 名稱、型別、預設值、nullable、index、primary key
- 直接連接 Zeabur 上既有的 MySQL 資料庫，不修改其結構
- 可透過 Docker 在本機建立相同 schema 的測試資料庫

登入與授權**不**要求相容舊系統（Laravel Passport），由新專案重新設計，詳見各文件內的
`AUTH_REIMPLEMENTATION_REQUIRED` 標記。

## 2. API 數量

**19 個** `/api` 端點（實際路徑皆為 `/api/v2/...`），全部記錄於 `api-specification.md` 與
`openapi.yaml`。

## 3. API 覆蓋率

**19 / 19（100%）**——`routes/api.php` 定義的每一個端點都已建檔，沒有遺漏。

## 4. 資料表數量

正式資料庫共 **25 張表**（唯讀 `information_schema` 查詢確認）。分類詳見
`database-schema.md`：

| 分類 | 數量 |
|---|---|
| `API_USED_TABLE` | 6 |
| `AUTH_RELATED_TABLE` | 6 |
| `FRAMEWORK_METADATA_TABLE` | 3 |
| `LEGACY_OR_EXTERNAL_TABLE` | 9 |
| `UNCONFIRMED_TABLE` | 1 |

## 5. API 使用的資料表

新 Node API 會實際讀寫的資料表共 **7 張**：`contact`、`contact_class`、`contact_quest`、
`contact_list`、`faq`、`seo`（業務資料）+ `users`（登入/註冊用，帳號與密碼欄位）。

## 6. 未被 API 使用的資料表

其餘 **18 張**：

- `oauth_access_tokens`、`oauth_auth_codes`、`oauth_clients`、`oauth_personal_access_clients`、
  `oauth_refresh_tokens`（Laravel Passport 內部表，新專案重新設計驗證機制，不使用這些表）
- `password_resets`、`jobs`、`migrations`（Laravel 框架表）
- `admin`、`browse`、`browse_record`、`faq_class`、`page`、`page_files`、`page_pics`、
  `seo_class`、`simple_setting`（`LEGACY_OR_EXTERNAL_TABLE`，本專案無程式碼接觸，疑似另一套系統
  共用同一資料庫）
- `contact_img`（`UNCONFIRMED_TABLE`，有 migration 但無任何程式碼使用）

以上 SQL 建置腳本**仍會建立**這些表的完整結構（保持資料庫 1:1 相容），只是新 API 不會為它們提供
任何端點。

## 7. OpenAPI 使用方式

`openapi.yaml`（3.1 版）涵蓋全部 19 個端點，每個 operation 有唯一 `operationId`，並用
`x-source-file`/`x-source-controller`/`x-source-method` 指回原始碼位置（僅供查證，不代表需要
理解 Laravel）。`x-confirmation-status` 的四種值：`CONFIRMED`、`UNCONFIRMED`、
`AUTH_REIMPLEMENTATION_REQUIRED`、`KNOWN_LEGACY_ISSUE`。需要登入的端點使用共用的
`bearerAuth` security scheme（`type: http, scheme: bearer, bearerFormat: JWT`）——僅代表新專案
預計採用 Bearer Token，不代表需要相容 Laravel Passport。

建議用 `express-openapi-validator`（或等效工具）在測試環境載入此檔案做 request/response 驗證。

## 8. SQL 建置方式

```bash
cd migration-spec
mysql -h <host> -P <port> -u <user> -p <database> < sql/001-create-tables.sql
# 索引已內嵌於 001（002 為說明性 no-op）
# 003/004/005 皆為說明性 no-op（正式庫目前無生效外鍵、無 view、無 trigger）
```

`sql/001-create-tables.sql` 建立 **24 張表**（正式庫共 25 張，差 1 張是 Laravel 自己的
`migrations` 記錄表——框架內部使用，與業務邏輯無關，新專案有自己的 migration 追蹤表
`node_schema_migrations`，故意不建立）。已在臨時 Docker MySQL 容器實測成功，欄位數與正式庫
唯讀查詢結果完全一致。

## 9. 本機 MySQL 建立方式

```bash
cd migration-spec/docker
docker compose up -d
docker compose exec api npm run db:migrate   # 執行 node-migrations/migrate.ts
docker compose exec api npm run db:verify    # 唯讀比對 schema 是否與 database-schema.json 一致
```

本機 MySQL 版本固定為 `8.0.33`（已用 `SELECT VERSION()` 對正式庫唯讀查詢確認一致）。

## 10. 新 Node.js 專案實作順序

1. 讀 `api-specification.md` + `openapi.yaml` 建立整體 API 契約認識。
2. 用 `sql/001-create-tables.sql` + `docker/` 建立本機測試資料庫。
3. 依 `node-api-implementation-checklist.md` 逐一實作 19 個端點（`adminUpdateContact` 除外，
   該項標記 `Blocked`，需先決定 `known-legacy-issues.md` 第 1 點的正確行為）。
4. 認證（`authLogin`/`authLogout`）依專案選定的 Node auth 方案獨立實作，不需等待其他端點。
5. 對照 `api-business-logic.md` 的偽程式碼確保商業邏輯一致。
6. 每個端點完成後跑 `db:verify` 確認沒有意外變更 schema。

## 11. 已知舊系統問題

完整清單見 `known-legacy-issues.md`，共 13 項。其中需要專案負責人決定的：

1. `PUT /api/v2/admin/contact/{id}` 真正應該更新哪些欄位（目前邏輯無效）
2. `admin/*` 是否需要補上 `is_admin` 角色檢查
3. `GET /seo`、`GET /faq` 未過濾 `del` 是否為疏漏
4. `contact-class` 硬刪除 vs `del` 軟刪除旗標語意是否要統一
5. 9 張 `LEGACY_OR_EXTERNAL_TABLE` 是否需要提供對應 API

## 12. 未確認事項

- 上述「已知舊系統問題」中列為需決定的 5 項。
- `contact_img` 表的真實用途（`UNCONFIRMED_TABLE`）。
- `CACHE_DRIVER`/`SESSION_DRIVER` 正式環境實際設定值（未取得 `.env`，僅知範例預設值）。
- 完整清單見各文件內的 `UNCONFIRMED` 標記。

---

## 文件列表

```
migration-spec/
  README.md                              <- 本檔案
  api-specification.md                   <- API 規格總覽（19 端點）
  openapi.yaml                           <- OpenAPI 3.1
  api-business-logic.md                  <- 框架無關的商業邏輯偽程式碼
  database-schema.md                     <- 資料庫結構（5 分類，25 張表）
  database-schema.json                   <- 機器可讀 schema（{database, tables, columns, indexes, foreignKeys}）
  node-api-implementation-checklist.md   <- 每支 API 的實作 checklist
  known-legacy-issues.md                 <- 已知舊系統問題（13 項）
  sql/
    001-create-tables.sql               <- 24 張表建置（不含 Laravel migrations 表）
    002-create-indexes.sql              <- 說明性 no-op（索引已內嵌於 001）
    003-create-foreign-keys.sql         <- 說明性 no-op（正式庫無生效外鍵）
    004-create-views.sql                <- 不適用（無 view）
    005-create-triggers.sql             <- 不適用（無 trigger/stored procedure）
  node-migrations/
    README.md / db.ts / migrate.ts / verify.ts / migrations/*.sql
  docker/
    Dockerfile / docker-compose.yml / .env.example / README.md
  _archive/                              <- 舊版「Laravel 對照」導向文件，僅供歷史查證
```

## 最終驗證紀錄

- **OpenAPI**：YAML 語法驗證通過、19 個 `operationId` 全部唯一、所有 `$ref` 皆有效、所有路徑
  已修正為正確的 `/api/v2/...` 前綴（先前版本遺漏 Laravel `RouteServiceProvider` 自動附加的
  `/api` 前綴，已修正）。
- **JSON 格式**：`database-schema.json` 已驗證為合法 JSON，符合 `{database, tables, columns,
  indexes, foreignKeys}` 結構，25 張表、235 個欄位、39 個索引、0 個外鍵。
- **SQL 可執行性**：`sql/001-create-tables.sql` 已在全新 `mysql:8.0.33`容器上實際執行成功，
  24 張表全部建立，欄位數與正式資料庫一致。
- **機密字串掃描**：已對 `migration-spec/` 全目錄掃描，確認沒有真實密碼、Token、金鑰或 `.env`
  內容外洩。
