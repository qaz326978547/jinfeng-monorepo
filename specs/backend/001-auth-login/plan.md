# 實作計畫：登入功能（POST /api/v2/auth/login）

**分支**：`001-auth-login` | **日期**：2026-07-27 | **規格**：[spec.md](./spec.md)

**輸入**：來自 `/specs/001-auth-login/spec.md` 的功能規格

**備註**：本範本由 `/speckit-plan` 指令填寫。執行流程請參見 `.specify/templates/plan-template.md`。

## 摘要

實作 `POST /api/v2/auth/login`：以嚴格（strict）Zod schema 驗證 `{ email, password }`，透過唯讀的
`mysql2/promise` parameterized query 在既有 `users` 表中查詢帳號，使用 `bcryptjs` 對照既有 Laravel
bcrypt 雜湊驗證密碼；驗證成功時，以 composition root 建構階段注入 `AuthService` 的
`JWT_SECRET`/`JWT_EXPIRES_IN` 設定簽發 JWT（payload 為 `sub`/`email`/`isAdmin`，對齊既有的
`AccessTokenPayload`）。依 spec.md 已裁定的決策，錯誤格式分為兩條軌道：request 驗證失敗回傳 Laravel
相容的 `422 { message, errors }` 格式（OD-1 選項 B，僅 auth/login 這個 route 透過
`validate-request.ts` 新增的 endpoint 層級選填旗標啟用，不影響其他端點）；帳密錯誤維持既有的
`401 { message: "帳號或密碼錯誤" }`；其餘失敗（資料庫、雜湊格式異常、JWT 簽發）皆落入專案既有的
統一 `500` error handler。不涉及 schema 變更、不寫入 `users` 表、不含 refresh token、不含
register/logout 的工作。

## 技術背景

**語言／版本**：TypeScript（strict mode），Node.js >= 22

**主要依賴套件**：Express 5（路由）、Zod 4（`loginRequestSchema`，將加上 `.strict()`）、
`mysql2/promise`（對 `users` 表做 parameterized `SELECT`）、`jsonwebtoken`（JWT 簽發，沿用
`src/middleware/authenticate.ts` 既有定義的 `AccessTokenPayload` 契約）、`bcryptjs`（對照既有
Laravel 雜湊驗證密碼）、`pino`/`pino-http`（既有的結構化 logger，用於 FR-004 的安全 log 紀錄）

**資料儲存**：既有 MySQL 8.0.33 的 `users` 表（本功能僅唯讀存取：`id`、`email`、`password`、
`is_admin`）。無 migration、無 schema 變更、無寫入路徑。

**測試方式**：Vitest + `supertest`，沿用既有 `tests/integration/*.test.ts` +
`tests/helpers/build-test-app.ts`（mock `mysql2` pool）慣例。任何測試皆 MUST NOT 連接真實資料庫或
Zeabur 環境（Constitution 原則 VIII）。

**目標平台**：Zeabur 上的 Linux 容器（既有 Docker／Express 骨架）；本功能不需要平台面的變更。

**專案類型**：單一 Node.js web-service 後端，沿用專案骨架既有的 feature-based `src/` 結構（並非
範本泛用的選項 1/2/3——詳見下方「專案結構」）。

**效能目標**：SC-001——正常、非壓力測試的環境負載下，95% 的登入請求（成功或失敗皆計入）應於 1 秒內回應。

**限制條件**：
- MUST 逐字重現 `migration-spec` 的 `200`/`401` 契約（Constitution 原則 I）。
- MUST 精確重現舊 Laravel 的 `422` 驗證錯誤格式，依 spec.md OD-1（選項 B）——這是刻意且已記錄的例外，
  有別於專案骨架其餘端點所用的一般統一 `400` 驗證錯誤格式。
- MUST NOT 寫入 `users` 表；MUST NOT 變更資料庫 schema（Constitution 原則 VII、XIII）。
- MUST 沿用既有的 `AccessTokenPayload` 形狀／型別（`sub: number`、`email: string`、
  `isAdmin: boolean`），以確保既有的 `authenticate` middleware 能驗證本功能核發的 token。
- `AuthService` 的 `JWT_SECRET`、`JWT_EXPIRES_IN`、repository、logger MUST 皆於 composition
  root（`app.ts` → `routes/index.ts` → `auth.routes.ts`）建構階段以參數注入，MUST NOT 由
  `AuthService` 內部呼叫 `getEnv()`／存取全域 env；僅能存在單一一套依賴取得方式，不得同時存在
  「route 注入」與「service 內部讀全域」兩套互相衝突的做法（詳見下方「資料流程」）。

**規模／範圍**：單一端點（`POST /api/v2/auth/login`）；不涉及其他端點。

## Constitution 檢查

*關卡：必須在 Phase 0 研究前通過；Phase 1 設計後需重新檢查。*

| 原則 | 狀態 | 說明 |
|---|---|---|
| I. API Contract First | 通過 | `200`/`401` 回應內容與 `migration-spec` 完全一致（FR-006、FR-009）。`422` 舊格式同樣直接取自 `migration-spec` 已記載（但先前未實作）的 Laravel 行為——並非偏離契約，只是本專案首次真正實作它（OD-1）。 |
| II. Migration Spec as Source of Truth | 通過 | 所有行為皆可追溯至 `api-specification.md` #6、`api-business-logic.md` #6、`database-schema.json`；唯一真正的衝突（驗證錯誤格式 vs. 專案自身已建立的統一 `400` handler）已記錄並由專案負責人裁定（OD-1），非自行臆測。 |
| III. Legacy System Compatibility Priority | 通過 | 本功能未「修正」任何舊系統問題；刻意不加入 `is_admin`／狀態欄位的登入限制，與已確認的舊系統行為一致（FR-005）。 |
| IV. TypeScript Strict Typing | 通過 | 預期不使用 `any`／型別斷言；`AccessTokenPayload` 型別原樣沿用（FR-007、FR-014）。 |
| V. Input Validation at All Boundaries | 通過 | `loginRequestSchema.strict()` 拒絕未知欄位（FR-001）；所有 handler 輸入皆先經 Zod 驗證才進入 service。 |
| VI. Layered Architecture | 通過 | route → schema → controller → service → repository，詳見下方「專案結構」與「資料流程」；controller 不直接碰觸 SQL；`AuthService` 的所有依賴（JWT 設定、repository、logger）皆於 composition root（`auth.routes.ts`）建構階段注入，service 本身不讀取全域 env。 |
| VII. mysql2-Only Data Access | 通過 | `UserRepository.findByEmail()` 使用 `mysql2/promise` 搭配 parameterized `SELECT`；未引入任何 ORM／migration 工具。 |
| VIII. Test Coverage Requirements | 通過 | 成功、驗證失敗（含未知欄位）、帳號不存在、密碼錯誤、雜湊完整性異常、資料庫錯誤、JWT 簽發錯誤、回應不含密碼——皆已規劃（SC-005）。僅使用 mock pool。 |
| IX. Definition of Done | 通過（留待實作階段） | `typecheck`/`lint`/`test`/`openapi:validate`（必要時 `db:verify`）為實作階段的關卡，已記錄於 tasks.md，本規劃階段不違反。 |
| X. Scoped Incremental Delivery | 通過 | 僅處理 `auth/login`；register/logout/refresh 明確排除在範圍外（spec.md 排除項目）。 |
| XI. Avoid Over-Engineering | 通過 | 沿用既有 `AppError` 階層、`validate-request` middleware、`authenticate.ts` 型別；唯一新增的抽象——`LegacyValidationError`（獨立檔案，見專案結構）與 `validate-request.ts` 的 endpoint 層級選填旗標——直接由 FR-001 要求，非臆測性設計，且不影響其他端點的既有 `400` 流程。 |
| XII. Documentation Synchronization | 通過（已記錄待辦任務） | `migration-spec/openapi.yaml` 的 `auth/login` 路徑目前僅記載 `200`/`401`；Phase 1 contracts 已註記應補上 `422` response 作為文件補充（非變更既有已確認的 `200`/`401` 契約）——已列為任務，非本規劃步驟完成。 |
| XIII. No Automatic Production Database Mutations | 通過 | 本功能對 `users` 僅唯讀；不涉及 migration/DDL/DML。 |
| XIV. Remote Database Access Control | 通過 | 未新增任何遠端資料庫存取；沿用既有的 pool／環境變數憑證處理方式。 |
| XV. Environment Identification | 不適用 | 本規劃步驟未執行任何遠端／Zeabur API 或資料庫操作。 |
| XVI. Test API Usage Rules | 不適用 | 本功能的自動化測試不呼叫 Zeabur 測試 API。 |
| XVII. Sensitive Data Protection | 通過 | FR-004、FR-011 禁止記錄／回顯密碼、雜湊或完整 JWT；雜湊完整性異常的 log 紀錄已明確去敏感化。 |
| XVIII. SQL Injection Prevention | 通過 | `UserRepository.findByEmail()` 使用 parameterized query，無字串拼接。 |
| XIX. Transaction Semantics Awareness | 不適用 | 僅一次唯讀 `SELECT`；不涉及 transaction，也不涉及 MyISAM 表（`users` 為 InnoDB）。 |
| XX. Git & Secret Hygiene | 通過 | 本計畫未引入任何 secret；`JWT_SECRET`／資料庫憑證維持僅存在於環境變數。 |

**無違規事項，不需要複雜度追蹤（Complexity Tracking）。**

## 專案結構

### 文件（本功能）

```text
specs/001-auth-login/
├── plan.md              # 本檔案（/speckit-plan 指令輸出）
├── research.md          # Phase 0 產出（/speckit-plan 指令）
├── data-model.md        # Phase 1 產出（/speckit-plan 指令）
├── quickstart.md        # Phase 1 產出（/speckit-plan 指令）
├── contracts/           # Phase 1 產出（/speckit-plan 指令）
│   └── auth-login.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 產出（/speckit-tasks 指令——非 /speckit-plan 建立）
```

### 原始碼（repository 根目錄）

本專案已有既定的 feature-based `src/` 結構（並非範本泛用的
single-project/web-app/mobile 選項）；本功能在既有結構上原地擴充，不新增任何頂層目錄：

```text
src/
├── app.ts                          # 擴充：createRootRouter({ pool, jwtSecret, jwtExpiresIn, logger })——
│                                    # 一併傳入 jwtExpiresIn 與 logger（app.ts 本身已持有 env、logger），
│                                    # 使 composition root 能在建構階段把完整依賴往下遞送
├── config/
│   └── env.ts                      # JWT_SECRET、JWT_EXPIRES_IN——原樣沿用；僅由 app.ts／server.ts 這層
│                                    # composition root 讀取一次，往下皆以明確參數注入，AuthService 本身
│                                    # 不呼叫 getEnv() 或直接存取 env（見下方「資料流程」）
├── middleware/
│   ├── authenticate.ts             # AccessTokenPayload 契約——沿用，不修改
│   ├── error-handler.ts            # 擴充以辨識新的 LegacyValidationError 型別（定義於
│   │                                # shared/errors/legacy-validation-error.ts，不是 app-error.ts）
│   └── validate-request.ts         # 擴充（非「不變更」）：為 ValidationSchemas/validateRequest 新增
│                                    # endpoint 層級的選填旗標 legacyErrorFormat?: boolean。開啟時，
│                                    # 若 schemas.body.parse 拋出 ZodError，攔截並轉換為
│                                    # LegacyValidationError（422 Laravel 格式）後重新拋出；未開啟
│                                    # （預設值，其餘所有既有與未來端點皆維持預設）時，行為與現況完全
│                                    # 相同——ZodError 原樣拋出，交由 error-handler.ts 既有分支轉為
│                                    # 統一的 400。僅 auth/login 這個 route 會設定此旗標為 true，
│                                    # 不會讓全站端點都改成 422
├── modules/
│   └── auth/
│       ├── auth.routes.ts          # 擴充：createAuthRouter({ pool, jwtSecret, jwtExpiresIn, logger })。
│       │                            # 此檔案即為 auth 模組的 composition root：在此建構
│       │                            # UserRepository（注入 pool）與 AuthService（注入
│       │                            # { jwtSecret, jwtExpiresIn, repository, logger }），再將建構好的
│       │                            # AuthService 注入 controller 的 handler；login route 對
│       │                            # validateRequest 傳入 { body: loginRequestSchema,
│       │                            # legacyErrorFormat: true }
│       ├── auth.schemas.ts         # loginRequestSchema 加上 .strict()
│       ├── auth.controller.ts      # login() 改為呼叫（已注入好依賴的）AuthService，移除 501 stub，
│       │                            # controller 內無 SQL/bcrypt，也不自行讀取 env 或建構任何依賴
│       ├── auth.service.ts         # 新增：AuthService 的建構子接受
│       │                            # { jwtSecret, jwtExpiresIn, repository: UserRepository,
│       │                            # logger }，內部只使用這些注入進來的依賴——不呼叫 getEnv()、不
│       │                            # 直接 import env 模組。帳密驗證、雜湊格式檢查、JWT 簽發皆在此
│       │                            # 實作；因所有依賴皆可在測試中以假物件（fake/mock）替換，
│       │                            # AuthService 可在不啟動整個 Express app 的情況下被獨立單元測試
│       └── user.repository.ts      # 新增：建構子注入 pool，透過 mysql2/promise 實作 findByEmail()
├── routes/
│   └── index.ts                    # 擴充：RouterDeps 新增 jwtExpiresIn、logger 兩個欄位，與既有的
│                                    # pool、jwtSecret 一併傳入 createAuthRouter——沿用專案既有的
│                                    # 「app.ts 讀取一次 env，其餘模組只接收明確參數」慣例（對照
│                                    # health router 已經是以 pool 注入、而非自行讀取全域狀態）
└── shared/
    └── errors/
        ├── app-error.ts            # 不變更：維持既有的一般錯誤類別階層（AppError、ValidationError、
        │                            # UnauthorizedError、ForbiddenError、NotFoundError、
        │                            # NotImplementedError），不塞入任何 Laravel 相容性專屬邏輯
        └── legacy-validation-error.ts  # 新增（獨立檔案，非併入 app-error.ts）：
                                         # LegacyValidationError（extends AppError，固定
                                         # statusCode: 422）+ toLegacyValidationErrors(zodError)
                                         # mapper，兩者皆為 Laravel 相容性專屬邏輯，與一般錯誤
                                         # 階層分開存放

tests/
└── integration/
    ├── auth-login.test.ts          # 新增：涵蓋 spec.md SC-005 的各項情境；透過
    │                                # tests/helpers/build-test-app.ts 對 AuthService 的依賴注入
    │                                # mock repository／logger，不需要修改 build-test-app.ts 本身
    └── validate-request.test.ts    # 更新：既有「400 on 無效登入 body」的斷言須改為 422
                                     # （見 research.md——此測試目前仍反映 OD-1 之前的假設，否則會失敗或誤導）

migration-spec/openapi.yaml          # 僅文件補充：為 POST /api/v2/auth/login 新增
                                      # 422 response 項目（Constitution 原則 XII）
```

**結構決策**：在既有的 `src/modules/auth/` 功能模組上原地擴充，延續骨架其餘部分已使用的
route → schema → controller → service → repository 分層方式（Constitution 原則 VI）。不新增任何
頂層目錄；`auth.service.ts` 與 `user.repository.ts` 是既有模組內的新檔案。三項先前草稿中內部不
一致之處，已於本次修正中統一如下：

1. `validate-request.ts` **會**被擴充（endpoint 層級的選填 `legacyErrorFormat` 旗標），而非「不
   變更」；預設行為（其餘所有端點）維持現況的 `400` 流程，只有 auth/login 這個 route 主動開啟。
2. `LegacyValidationError` 統一放在獨立檔案 `src/shared/errors/legacy-validation-error.ts`，
   `app-error.ts` 維持既有的一般錯誤類別階層，不混入 Laravel 相容性專屬邏輯。
3. JWT 設定（`JWT_SECRET`、`JWT_EXPIRES_IN`）、`repository`、`logger` 一律於 composition root
   （`app.ts` → `routes/index.ts` → `auth.routes.ts` 這條既有的注入鏈）建構階段注入
   `AuthService`，而非讓 `AuthService` 自行呼叫 `getEnv()`／存取全域 env；`auth.routes.ts` 內不會
   同時存在「注入 jwtSecret」與「service 內部讀取全域 env」兩套互相衝突的取得方式。此做法對齊專案
   既有慣例——`app.ts` 已是唯一讀取 `env` 物件的 composition root，其餘模組（含 health router）
   一律以明確參數接收所需的值，而非各自存取全域狀態。

## 資料流程

以下說明 request 進入後的完整路徑，對應上方「專案結構」中列出的檔案：

1. **組裝階段（app 啟動時，非每次 request）**：`server.ts` 呼叫 `loadEnv()`／`getEnv()` 取得
   `Env`，交給 `app.ts` 的 `createApp({ env, pool, logger })`。`app.ts` 從 `env` 取出
   `JWT_SECRET`、`JWT_EXPIRES_IN`，連同既有的 `pool`、`logger`，呼叫
   `createRootRouter({ pool, jwtSecret, jwtExpiresIn, logger })`。`routes/index.ts` 原樣將這四項
   傳入 `createAuthRouter({ pool, jwtSecret, jwtExpiresIn, logger })`。`auth.routes.ts`（auth
   模組的 composition root）在此建構一次 `UserRepository`（注入 `pool`）與 `AuthService`（注入
   `{ jwtSecret, jwtExpiresIn, repository, logger }`），並將建構好的 `AuthService` 綁定到
   `login` controller 的 handler。**這整條鏈路只在應用程式啟動（或測試中呼叫
   `buildTestApp()`）時執行一次**，`AuthService` 之後處理每一筆 request 時，只使用建構時已經
   拿到的依賴，不再讀取任何全域狀態。
2. **成功路徑（Request → 200）**：`POST /api/v2/auth/login` → `validateRequest({ body:
   loginRequestSchema, legacyErrorFormat: true })` 驗證通過 → `auth.controller.ts#login`
   （`asyncHandler` 包裝）呼叫 `AuthService.login(email, password)` → `UserRepository.findByEmail`
   透過 `mysql2/promise` 查得帳號 → `isSupportedBcryptHash` 通過 → `bcryptjs.compare` 通過 →
   簽發 JWT（`{ sub, email, isAdmin }`，使用建構時注入的 `jwtSecret`/`jwtExpiresIn`）→ controller
   回傳 `200 { token }`。
3. **驗證失敗路徑（Request → 422）**：`validateRequest` 呼叫 `loginRequestSchema.parse` 拋出
   `ZodError` → 因 `legacyErrorFormat: true`，`validate-request.ts` 攔截並以
   `toLegacyValidationErrors` 轉換、包成 `LegacyValidationError` 重新拋出 → 既有的
   `asyncHandler`／Express 錯誤流程送進 `error-handler.ts` → 新的 `LegacyValidationError` 分支
   輸出 `422 { message, errors }`（不含 `code`/`requestId`）。**不會**進入 `AuthService`。
4. **帳密錯誤路徑（Request → 401）**：`AuthService.login` 查無帳號或 `bcryptjs.compare` 不符 →
   拋出 `UnauthorizedError('帳號或密碼錯誤')` → `error-handler.ts` 既有的 `isAppError` 分支輸出
   `401`。
5. **系統錯誤路徑（Request → 500）**：`UserRepository` 查詢失敗、`isSupportedBcryptHash` 判定
   雜湊格式不合法（此時 `AuthService` 先透過注入的 `logger` 記錄一筆安全 log，再拋出一般
   `Error`），或 `jsonwebtoken.sign` 拋出例外 → 皆落入 `error-handler.ts` 既有的一般錯誤分支，
   輸出統一格式的 `500`。

## 複雜度追蹤

> 不適用——Constitution 檢查未回報任何需要合理化的違規事項。
