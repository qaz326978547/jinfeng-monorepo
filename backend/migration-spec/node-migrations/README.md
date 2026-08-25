# Node Migration Runner — 設計與選型理由

## 選型：純 SQL + 自製最小 migration runner（不使用 ORM migration DSL）

**沒有選用** Knex/TypeORM/Sequelize/Prisma migration 之類的工具，原因：

1. **不會自動改名/包裝欄位**：多數 ORM migration DSL（尤其是 Prisma、TypeORM 的 `synchronize`
   類功能）在「反向工程既有資料庫」時，容易把欄位名稱正規化（camelCase 化）、幫欄位加上它自己
   認定的預設值/型別包裝，或是要求外鍵/命名符合它的慣例。這個專案的正式資料庫有大量歷史欄位
   （`cid`、`m_pass_ans`、`s_info`、`utf8mb3`/`utf8mb4` 混用字元集…），**任何一種「自動推導」都
   有很高機率悄悄改變 schema**，違反 `改版.md` 的「不得改成較漂亮的新命名」「不得擅自正規化」
   「不得更動既有欄位型別」的硬性限制。
2. **能執行 raw SQL**：`migration-spec/sql/001-create-tables.sql` 是直接從正式資料庫
   `SHOW CREATE TABLE` 唯讀擷取的原始 DDL，純 SQL runner 可以**逐字執行**，不需要先翻譯成任何
   ORM 的中介格式（翻譯這一步本身就是風險來源）。
3. **相容多種既有 MySQL 版本**：正式庫是 Zeabur 上的 MySQL（本次驗證環境版本為 MySQL 8 語法），
   純 SQL 不依賴特定 ORM 版本對 MySQL 方言的支援程度。
4. **可以做唯讀 dry-run**：因為 runner 是我們自己寫的，可以簡單地加一個「只讀 information_schema
   比對，不執行任何 DDL」的 `verify` 模式，直接對正式資料庫執行也是安全的（見下方 `db:verify`）。
   多數 ORM migration 工具的「dry-run」功能是產生要執行的 SQL 預覽，但仍然假設你最終會用它的
   migration 表格式記錄狀態，語意上比較重。

## 目錄結構

```
node-migrations/
  README.md          <- 本檔案
  migrate.ts         <- 執行 migration 的 CLI（npm run db:migrate）
  verify.ts          <- 唯讀 schema 驗證 CLI（npm run db:verify）
  db.ts              <- 共用的 mysql2 連線建立邏輯
  migrations/
    001_create_tables.sql   <- 直接引用 ../../sql/001-create-tables.sql 的內容（見下方說明）
    002_create_indexes.sql
    003_create_foreign_keys.sql
    004_create_views.sql
    005_create_triggers.sql
```

`node-migrations/migrations/*.sql` 的內容與 `migration-spec/sql/*.sql` **完全相同**——之所以在
`node-migrations/` 下也放一份，是因為未來的 Node 專案會把整個 `node-migrations/` 目錄複製到自己
的 `migrations/` 資料夾下直接使用；`migration-spec/sql/` 則是給人類閱讀、審閱用的規格文件副本。
兩者出現內容差異時，以 `migration-spec/sql/` 為準（規格文件），`node-migrations/migrations/` 需
同步更新。

## migration 狀態追蹤表

**不會**沿用 Laravel 的 `migrations` 表（避免兩套系統寫入同一張狀態表互相干擾）。Node runner 會在
目標資料庫建立一張新表 `node_schema_migrations`（`filename VARCHAR(255) PRIMARY KEY, applied_at
TIMESTAMP`），只記錄「Node runner 執行過哪些 .sql 檔案」，與 Laravel 的 `migrations` 表完全獨立、
互不影響。

## 指令

- `npm run db:migrate`
  - 依檔名順序（`001_`, `002_`, ...）執行 `migrations/*.sql`。
  - 每個檔案執行前先檢查 `node_schema_migrations` 是否已有紀錄，有則跳過（不會重複執行、也
    不會對已存在的表重跑 `CREATE TABLE IF NOT EXISTS`——虽然 `IF NOT EXISTS` 本身是安全的，但
    仍以檔案層級的已執行紀錄為主要判斷依據，避免每次都重新對資料庫下 DDL）。
  - **安全限制**：預設只允許連線到 `NODE_ENV!=production` 或明確帶 `--allow-production=false`
    以外的環境；若偵測到目標資料庫已經有 `contact`/`users` 等既有表且資料筆數 > 0，會直接中止
    並要求人工確認（避免不小心對正式庫重跑建表語句）。
- `npm run db:verify`
  - **完全唯讀**：只執行 `information_schema` 查詢，比對目標資料庫的實際 schema
    （表、欄位、型別、索引、外鍵）是否與 `migration-spec/database-schema.json` 記錄的快照一致。
  - 印出差異報告（缺少的表/欄位、型別不符…），**不會**執行任何 DDL，可以安全地對正式資料庫執行。

## 為什麼要保留 `IF NOT EXISTS`

`migration-spec/sql/001-create-tables.sql` 每個 `CREATE TABLE` 都帶 `IF NOT EXISTS`，這是為了讓
**全新本機測試資料庫**可以直接 `docker compose exec api npm run db:migrate` 一次建好所有表，且重複
執行不會報錯。這與「不應在既有正式資料庫重建已存在的表」並不衝突——`IF NOT EXISTS` 本身就是「表
已存在就跳過」的語意；但 runner 仍然在應用層多加一層「已執行過的 migration 檔名」記錄與正式環境
保護檢查，雙重保險。
