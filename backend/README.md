# jinfeng-back-node

Node.js/TypeScript 後端，從 Laravel 5.6 舊系統遷移而來。完整遷移規格（API 合約、資料庫 schema、已知舊系統問題）在 [`migration-spec/`](migration-spec/)，本專案是照該規格重寫的新後端。

**目前階段：第一支業務 API 完成**。已建立可執行、可測試、可 Docker 部署的基礎架構（設定、中介層、DB 連線、migration/verify 工具、健康檢查），`POST /api/v2/auth/login`（`001-auth-login`，見 `specs/001-auth-login/`）已依 `migration-spec/` 實作完成，其餘 18 支 `/api/v2/...` 業務 API（含 `auth/register`、`auth/logout`）仍只到 Zod 驗證 + route 骨架，controller 回 `501`。

## 技術棧

| 用途          | 套件                            | 版本        |
| ------------- | ------------------------------- | ----------- |
| Runtime       | Node.js                         | >= 22       |
| Web framework | Express                         | ^5.2        |
| Schema 驗證   | Zod                             | ^4.4        |
| MySQL driver  | mysql2                          | ^3.23       |
| JWT           | jsonwebtoken                    | ^9.0        |
| 密碼雜湊      | bcryptjs                        | ^3.0        |
| Logger        | pino / pino-http                | ^10 / ^11   |
| 測試          | Vitest / supertest              | ^4.1 / ^7.2 |
| Lint / Format | ESLint (flat config) / Prettier | ^10 / ^3.9  |
| OpenAPI 驗證  | @apidevtools/swagger-parser     | ^12.1       |

## 資料庫方案：mysql2（不使用 Kysely / Knex / Prisma）

比較依據：舊 MySQL schema 相容性、MyISAM 支援、不規則命名、raw SQL 支援、不自動改 schema、Zeabur 部署簡易度。

- **Prisma**：排除。其 migration engine 會做隱式 schema 正規化/自動 DDL（`prisma db push`/`migrate dev` 這類行為），與「不得自動修改正式資料庫」的硬性限制直接衝突；對 15 張 MyISAM table（無 FK/transaction）也缺乏明確支援。
- **Knex / Kysely**：兩者本身是安全的 query builder，但它們的 migration DSL 仍會鼓勵把 schema 定義寫成程式碼、進而被 `migrate` 指令執行 DDL；在一個以「保留現有 25 張表、不規則命名（`del`、`no`、`class` 等欄位）、0 個現行 FK」為前提的專案上，額外的型別/命名正規化層弊大於利，且本階段尚未開始寫任何查詢邏輯，先引入型別產生工具屬於過度設計。
- **mysql2**（`mysql2/promise`）：純 raw SQL driver，不做任何 schema 假設或自動 DDL，對 MyISAM 沒有特殊限制，最小可控。`src/infrastructure/database/client.ts` 建立連線池、`scripts/migrate.ts` 用它跑 `migrations/*.sql`（本機/測試用，正式環境預設拒絕執行）、`scripts/verify-schema.ts` 用它做純唯讀的 `information_schema` 比對（正式環境可安全執行）。

之後若要在實作 19 支 API 時加型別安全的 query 層，可以在 mysql2 之上疊加 **Kysely**（純型別包裝，不涉及 migration/DDL）——但這是下一階段的決定，本階段不引入。

## 密碼雜湊與 JWT

- 舊系統 `users.password` 是 bcrypt hash，新登入必須能驗證既有 hash，因此選 **bcryptjs**（純 JS 實作、格式與原生 bcrypt 相容、不需要 node-gyp/native build，Docker 建置更簡單）。
- Access token 用 **JWT**（`jsonwebtoken`），只簽發/驗證，不用來加密密碼。Refresh token 機制留待下一階段決定。
- `src/middleware/authenticate.ts` / `authorize.ts` 是驗證 Bearer JWT、檢查 `req.user.isAdmin` 的 middleware。
- **`POST /api/v2/auth/login` 已實作完成**（`src/modules/auth/auth.service.ts` + `user.repository.ts`）：查詢 `users` 表、以既有 bcrypt hash 驗證密碼、簽發 JWT（`sub`/`email`/`isAdmin`）。`AuthService` 的 JWT 設定、repository、logger 皆於 composition root（`app.ts` → `routes/index.ts` → `auth.routes.ts`）建構階段注入，不讀取全域 env，可獨立單元測試（見 `tests/unit/auth.service.test.ts`）。請求驗證失敗時回傳與舊 Laravel 相容的 `422 { message, errors }` 格式（`src/shared/errors/legacy-validation-error.ts`），僅限此端點，不影響其他路由的統一 `400` 格式（詳見 `specs/001-auth-login/`）。
- `auth/register`、`auth/logout` 的 controller 仍是 `501 Not Implemented` 骨架，真正邏輯待後續功能規格實作。

## 目錄結構

```
src/
  app.ts                     # 組裝 Express app，不 listen()
  server.ts                  # 載入 env/logger/DB pool、listen、graceful shutdown
  healthcheck.ts             # Docker HEALTHCHECK 用的獨立 script
  config/                    # env(Zod)、database(pool options)、logger(pino)、cors
  infrastructure/
    database/                # mysql2 pool、transaction helper、唯讀 schema verifier
    logger/                  # pino-http middleware
    openapi/                 # 讀取/驗證 migration-spec/openapi.yaml
  modules/auth/               # /api/v2/auth 路由；login 已實作（service/repository），register/logout 仍為骨架
    auth.routes.ts             # composition root：建構 UserRepository/AuthService 並注入 login handler
    auth.service.ts             # 帳密驗證、雜湊格式檢查、JWT 簽發（依賴皆為建構子注入）
    user.repository.ts          # mysql2/promise 對 users 表的唯讀查詢
  middleware/                 # authenticate/authorize/validate-request/request-id/not-found/error-handler
  shared/
    errors/                     # AppError 階層 + legacy-validation-error.ts（僅 auth/login 用的 422 相容格式）
    http/、types/、utils/        # async handler、Express type 擴充、graceful shutdown
  routes/                       # route registry（/health、/ready、/api/v2/...）

scripts/                        # migrate.ts / verify-schema.ts / validate-openapi.ts
migrations/                     # 複製自 migration-spec/sql/ 的 DDL，正式 runtime migration 目錄
tests/
  unit/                         # AuthService、legacy-validation-error 等不啟動 Express app 的單元測試
  integration/                  # Vitest + supertest，透過真實路由測試
```

## npm scripts

| 指令                       | 說明                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| `npm run dev`              | `tsx watch src/server.ts` 本機開發                                 |
| `npm run build`            | `tsc -p tsconfig.build.json` 編譯到 `dist/`                        |
| `npm start`                | `node dist/server.js`（production）                                |
| `npm run typecheck`        | `tsc --noEmit`                                                     |
| `npm run lint`             | ESLint                                                             |
| `npm run format`           | Prettier                                                           |
| `npm test`                 | Vitest（全部）                                                     |
| `npm run test:integration` | 只跑 `tests/integration`                                           |
| `npm run db:migrate`       | 套用 `migrations/*.sql`（`NODE_ENV=production` 預設拒絕執行）      |
| `npm run db:verify`        | 唯讀比對 live schema 與 `database-schema.json`，正式環境可安全執行 |
| `npm run openapi:validate` | 驗證 `migration-spec/openapi.yaml`                                 |

## Docker

`Dockerfile` 為 multi-stage build：`deps`（含 devDependencies）→ `build`（`tsc`）→ `production-deps`（`npm ci --omit=dev`）→ `development`（本機 docker-compose 用，含完整原始碼與 devDependencies）→ **`production`**（預設 build target，只含 `dist/` + prod `node_modules` + `migrations/`，非 root user，`exec` form CMD，不複製 `.env`）。`docker build -t jinfeng-back-node .` 預設就是產出 `production` image。

`docker-compose.yml` 只用於本機開發/測試：`api`（build target `development`，bind mount 原始碼）+ `mysql`（`mysql:8.0.33`，named volume、healthcheck、本機測試帳密）。本機資料庫建立流程：

```bash
docker compose up -d mysql
docker compose run --rm api npm run db:migrate
docker compose run --rm api npm run db:verify
docker compose up -d api
```

## Zeabur 相容性

- 監聽 `process.env.PORT`、`0.0.0.0`（`src/server.ts`）
- `app.set('trust proxy', 1)`，正確處理反向代理
- `SIGTERM`/`SIGINT` → `src/shared/utils/graceful-shutdown.ts`：關閉 HTTP server → 關閉 MySQL pool → exit
- Production `CMD` 只執行 `node dist/server.js`，不跑 migration
- `GET /health`（liveness，不查 DB）、`GET /ready`（readiness，查 DB 連線）

## 測試

`npm test` 目前涵蓋：`GET /health` 200、未知路由 404、全域 error handler（AppError / ZodError / 未知錯誤三種分支）、環境變數驗證（`loadEnv`）、`GET /ready`（DB 可達/不可達）、graceful shutdown（`registerGracefulShutdown` 單元測試，不依賴真實 process signal）。`POST /api/v2/auth/login` 的完整情境（成功登入、重複登入、帳號不存在、密碼錯誤、雜湊格式異常、DB 錯誤、JWT 簽發失敗、request 驗證失敗與未知欄位皆回傳 `422`）見 `tests/integration/auth-login.test.ts`；`AuthService`/`toLegacyValidationErrors` 的建構子注入與 mapper 邏輯另有不啟動 Express app 的單元測試（`tests/unit/`）。DB 相關測試皆用 mock pool，不連真實資料庫。

## 安全限制（持續有效）

- 不自動對正式資料庫執行 migrate/ALTER/DROP/TRUNCATE，`scripts/migrate.ts` 在 `NODE_ENV=production` 時預設拒絕執行。
- `scripts/verify-schema.ts` 只執行 `SELECT` 對 `information_schema`，可安全在正式環境執行。
- Docker production image 不含 `.env`、不含 devDependencies、以非 root user 執行。

## 下一階段建議

1. 實作 `auth/register`、`auth/logout` 真正商業邏輯（bcrypt 雜湊、`users` table insert；`logout` 的 token 撤銷策略待決）。`auth/login` 已完成，見上方「密碼雜湊與 JWT」與 `specs/001-auth-login/`。
2. 依 `migration-spec/node-api-implementation-checklist.md` 逐支實作其餘 16 支 `/api/v2/...` API（`seo`、`contact*`、`faq`、`admin/*`），每支完成後跑 `db:verify` 確認 schema 沒有意外變動。
3. 視需要在 mysql2 之上加 Kysely 型別層。
4. 決定 refresh token 策略、`admin/*` 的 `is_admin` 授權（見 `migration-spec/known-legacy-issues.md` #2）。
