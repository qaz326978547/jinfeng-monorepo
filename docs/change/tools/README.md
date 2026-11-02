# 遷移用工具（DigitalOcean Managed MySQL）

2026-10-26 演練時實際使用過的工具（[DO演練紀錄-2026-10-26.md](../DO演練紀錄-2026-10-26.md)），整理成通用版本。**這些檔案都不含任何機密。** 帳密一律放在 `~/secure` 底下、權限 600 的 MySQL option file（`[client]` 區段）。

## 前提

- 已安裝 Docker（使用 `mysql:8.4` 映像檔當 client）。
- `.ts` 檔案要在 `backend/` 目錄下用 `npx tsx` 執行，因為它們直接使用 backend 自己的連線設定（`buildPoolOptions`），TLS 會驗證 CA 和主機名稱。
- option file 範例（請照實際內容填寫，**不可以 commit**）：

  ```ini
  [client]
  host=<叢集主機名稱，*.db.ondigitalocean.com>
  port=25060
  user=doadmin
  password=<不要寫進任何文件>
  database=<目標資料庫>
  ssl-ca=/Users/<you>/Documents/digitalocean/ca-certificate.crt
  ssl-mode=VERIFY_IDENTITY
  ```

## 工具

| 檔案 | 用途 | 安全機制 |
|---|---|---|
| `with-db-env.mjs` | 讀 option file，轉成 backend 的 `DB_*`（含 `DB_SSL=true`、`DB_SSL_CA`），再執行指定指令（`db:migrate`、`db:verify`、下面的 `.ts`） | 拒絕不是 `*.ondigitalocean.com` 的主機、含 `zeabur` 的主機、還是範本字樣的欄位；`--expect-db` 可以限定資料庫名稱。密碼不會印出來 |
| `mysql-do.sh` | Docker 版 mysql 8.4 client，強制 `VERIFY_IDENTITY` | CA 掛載成 `/ca.crt`（設定檔裡的 macOS 路徑在容器內不存在） |
| `import-dump.sh` | 匯入 NewData.sql | **目標必須是指定名稱，而且是空的資料庫**，否則停止（exit 3），不會覆蓋 |
| `db-check.ts` | 顯示連線和叢集設定：版本、TLS、時區、`sql_mode`、連線上限、buffer pool、表數量 | 只讀 metadata |
| `db-query-readonly.ts` | 在 `READ ONLY` 交易裡執行 SELECT | 寫入會被 MySQL 拒絕。**只選需要的欄位，不要選密碼雜湊** |
| `new-app-cnf.sh` | 為 backend 專用帳號產生 option file：32 字元隨機密碼、權限 600 | 不顯示密碼；檔案已存在時拒絕覆蓋 |
| `create-app-user.ts` | 用管理帳號建立 backend 專用帳號，只給該資料庫 `SELECT, INSERT, UPDATE, DELETE` | 密碼用參數方式帶入；帳號已存在時不改密碼；拒絕 `root`／`doadmin` |

核對用的 SQL 在上一層：[reconcile-counts.sql](../reconcile-counts.sql)。產生 NewData.sql 用 [build-newdata.sh](../build-newdata.sh)。

## 演練／切換時的順序（對應 [NewData報告.md](../NewData報告.md) §7-3）

```bash
CA=~/Documents/digitalocean/ca-certificate.crt
ADMIN=~/secure/do-<env>-admin.cnf     # 自己建立，權限 600
APP=~/secure/do-<env>-app.cnf
DB=<目標資料庫>
T=docs/change/tools

# 1. 連線和叢集設定（從 repo 根目錄）
(cd backend && node ../$T/with-db-env.mjs $ADMIN --expect-db $DB -- npx tsx ../$T/db-check.ts)

# 2. 匯入（只會匯入空的資料庫）
$T/import-dump.sh $ADMIN $CA $DB ~/secure/jinfeng-db-backups/<日期>/NewData.sql

# 3. 核對：跟來源的結果 diff，要完全一致
$T/mysql-do.sh $ADMIN $CA -N < docs/change/reconcile-counts.sql > do.txt

# 4. 只套用 008，然後 verify（預期 11 張表 OK）
(cd backend && node ../$T/with-db-env.mjs $ADMIN --expect-db $DB -- npx tsx scripts/migrate.ts --allow-production)
(cd backend && node ../$T/with-db-env.mjs $ADMIN --expect-db $DB -- npx tsx scripts/verify-schema.ts)

# 5. backend 專用帳號
$T/new-app-cnf.sh $ADMIN $APP <app_user> $DB
(cd backend && node ../$T/with-db-env.mjs $ADMIN --expect-db $DB -- npx tsx ../$T/create-app-user.ts $APP)

# 6. 用專用帳號啟動 backend（寄信：MAIL_HOST 留空，或指向測試收件人）
(cd backend && MAIL_HOST= node ../$T/with-db-env.mjs $APP --expect-db $DB -- npx tsx src/server.ts)
```
