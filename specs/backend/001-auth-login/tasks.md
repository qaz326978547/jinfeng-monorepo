---

description: "POST /api/v2/auth/login 的任務清單"
---

# 任務清單：登入功能（POST /api/v2/auth/login）

**輸入**：來自 `/specs/001-auth-login/` 的設計文件

**前置條件**：plan.md、spec.md、research.md、data-model.md、contracts/auth-login.md、
quickstart.md（皆已齊備；本次已依 plan.md 2026-07-27 內部一致性修正版重新產生，詳見文末「與
plan.md 的對齊說明」）

**測試**：明確有要求——spec.md「測試需求」章節列出 10 項必要測試情境，Constitution 原則 VIII
也要求每個新功能皆須有測試覆蓋。已納入測試任務，且 MUST 先針對目前的 `501`/`400` stub 撰寫、
確認會失敗，再進行對應的實作任務。另外新增一項單元測試任務（T003），用以驗證 plan.md 明確設計的
「`AuthService` 依賴皆由建構階段注入、可獨立單元測試」這項特性本身確實成立。

**組織方式**：任務依使用者故事（spec.md 的優先順序 P1/P2/P3）分組，使每個故事可獨立實作、測試與
審查。US2 擴充的是 US1 建立的同一個 `AuthService.login()` 方法（兩者都是同一個端點商業邏輯的
分支，而非可獨立部署的服務），因此 US2 依賴 US1 完成；US3（request 驗證格式）觸及的是另一組
不重疊的檔案（schema、驗證 middleware、error handler、獨立的錯誤型別檔案），與 US1/US2 沒有
相依關係。

## 格式：`[ID] [P?] [Story] 說明`

- **[P]**：可並行執行（不同檔案、不依賴尚未完成的任務）
- **[Story]**：將任務對應到 spec.md 的 US1、US2 或 US3
- 每個任務皆包含明確的檔案路徑

## 路徑慣例

單一專案結構，對齊既有骨架：`src/` 與 `tests/` 位於 repository 根目錄
（本功能所擴充的完整既有目錄樹請見 plan.md「專案結構」與「資料流程」）。

## Phase 1：Setup（共用基礎設施）

不需要任何新的專案初始化。所有依賴套件（`express`、`zod`、`mysql2`、`jsonwebtoken`、
`bcryptjs`、`pino`、`vitest`、`supertest`）皆已在 `package.json` 中；`/api/v2/auth/login` 的
route/schema/controller 骨架也已存在（目前 stub 為 `501`）。此處無事可做——直接進入 Phase 3。

## Phase 2：Foundational（阻斷性前置作業）

無。US1/US2 需要的 DB pool／JWT 設定／logger 串接鏈與 repository 會在 Phase 3 建置（依任務產生
規則，US1 是最早需要它們的故事），而 US3 需要的 strict-schema／Laravel 相容錯誤格式串接則會在
Phase 5 建置，觸及的是另一組完全不重疊的檔案。兩條軌道之間沒有共用剩餘項目。直接進入 Phase 3。

---

## Phase 3：使用者故事 1 - 既有使用者使用帳密登入取得憑證（優先順序：P1）🎯 MVP

**目標**：持有合法既有 `users` 帳密的使用者可呼叫此端點，並取得一個可用於既有 `authenticate`
middleware 的 JWT；`AuthService` 的所有依賴（JWT 設定、repository、logger）皆於 composition
root 建構階段注入，使其可脫離 Express app 獨立單元測試。

**獨立測試方式**：以已知合法的 email/password（mock 的 repository 資料列 + 該密碼的真實 bcrypt
雜湊）呼叫 `POST /api/v2/auth/login`，應回傳 `200` 與一個 `token`，且 `authenticate()` 可將其
解碼還原為預期的 `sub`/`email`/`isAdmin`；另外可直接以注入假物件的方式建構 `AuthService`，
不啟動 Express app 也能驗證其成功路徑。

### 使用者故事 1 的測試

> 先撰寫這些測試；在 T007–T011 完成前，這些測試 MUST 針對目前的 `501` stub（或尚未存在的
> `AuthService`）呈現失敗。

- [X] T005 [P] [US1] Contract 測試：合法帳密 → `200` + `{ token }`；驗證該 token 可透過
  `src/middleware/authenticate.ts` 解碼出預期的 `sub`/`email`/`isAdmin`，寫在
  `tests/integration/auth-login.test.ts`
- [X] T006 [P] [US1] Contract 測試：同一組合法帳密連續呼叫兩次 → 兩次皆 `200`；各自的 token
  皆能獨立驗證通過（分別斷言其有效性，MUST NOT 斷言兩個 token 字串不同——見 spec.md 使用者故事 1
  情境 2／Assumption A3），寫在 `tests/integration/auth-login.test.ts`
- [X] T003 [P] [US1] 單元測試：直接以 `{ jwtSecret, jwtExpiresIn, repository: <fake>,
  logger: <fake> }` 建構 `AuthService`（不透過 Express app／supertest），驗證
  `login(email, password)` 成功路徑回傳 `{ token }`，且簽出的 JWT payload 為
  `{ sub, email, isAdmin }`，寫在 `tests/unit/auth.service.test.ts`（驗證 plan.md 所設計的
  「依賴皆為建構時注入、可獨立單元測試」特性本身成立）

### 使用者故事 1 的實作

- [X] T001 [P] [US1] 在 `src/modules/auth/auth.routes.ts` 擴充 `AuthRouterDeps` 為
  `{ pool: Pool; jwtSecret: string; jwtExpiresIn: string; logger: Logger }`，並將這四項參數
  原樣保留在 `createAuthRouter` 的簽章中（本任務僅擴充介面，實例化 `UserRepository`/
  `AuthService` 由 T010 完成）
- [X] T002 [US1] 在 `src/routes/index.ts` 將 `RouterDeps` 擴充為新增 `jwtExpiresIn: string`、
  `logger: Logger` 兩個欄位，並在 `createRootRouter` 中把 `deps.pool`、`deps.jwtSecret`、
  `deps.jwtExpiresIn`、`deps.logger` 一併傳入 `createAuthRouter`（依賴 T001）
- [X] T004 [US1] 在 `src/app.ts` 的 `createApp` 中，從既有的 `env`（`env.JWT_EXPIRES_IN`）與
  既有的 `logger` 參數取值，擴充呼叫 `createRootRouter({ pool, jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN, logger })`（依賴 T002）
- [X] T007 [P] [US1] 在 `src/modules/auth/user.repository.ts` 建立 `UserRow` 型別與
  `UserRepository` 類別，建構子注入 `pool: Pool`，方法 `findByEmail(email): Promise<UserRow | null>`
  使用 parameterized `SELECT id, email, password, is_admin FROM users WHERE email = ? LIMIT 1`
- [X] T008 [US1] 在 `src/modules/auth/auth.service.ts` 實作 `mapIsAdmin(value: number): boolean`
  （DB `1`→`true`，其餘→`false`，依 FR-014）與 `isSupportedBcryptHash(hash: string): boolean`
  （60 字元、`/^\$2[aby]\$\d{2}\$/` 前綴，依 FR-004/research.md #3）
- [X] T009 [US1] 在 `src/modules/auth/auth.service.ts` 實作 `AuthService` 類別：建構子接受
  `{ jwtSecret: string; jwtExpiresIn: string; repository: UserRepository; logger: Logger }`
  並存為實例屬性；`login(email, password)` 成功路徑呼叫 `this.repository.findByEmail`、以
  `isSupportedBcryptHash` 驗證雜湊格式、用 `bcryptjs.compare` 驗證密碼、以 `this.jwtSecret`/
  `this.jwtExpiresIn` 簽發 JWT payload `{ sub, email, isAdmin }`（`isAdmin` 透過
  `mapIsAdmin`），回傳 `{ token }`——**不得**呼叫 `getEnv()` 或直接 import `env` 模組（依賴
  T007、T008）
- [X] T010 [US1] 在 `src/modules/auth/auth.controller.ts` 將 `login()` 的 `501` stub
  替換為以 `asyncHandler` 包裝的真正 handler，呼叫注入的 `AuthService.login`，成功時回傳
  `200 { token }`（依賴 T009）
- [X] T011 [US1] 在 `src/modules/auth/auth.routes.ts`（auth 模組的 composition root）中，
  以 T001 擴充後的 deps 實例化一次 `new UserRepository(pool)` 與
  `new AuthService({ jwtSecret, jwtExpiresIn, repository, logger })`，並將建構好的
  `AuthService` 注入 login route 的 handler（依賴 T001、T007、T009、T010）

**檢查點**：合法帳密呼叫 `POST /api/v2/auth/login` 可取得可運作的 `200 { token }`，且
`AuthService` 可脫離 Express app 直接以注入假物件的方式單元測試。這是可交付的 MVP 切片。

---

## Phase 4：使用者故事 2 - 帳密錯誤時被安全地拒絕（優先順序：P2）

**目標**：錯誤帳密、損毀的儲存雜湊、資料庫失敗、JWT 簽發失敗——皆能被安全地拒絕，不洩漏帳號是否
存在、不外洩資料、不產生未處理的例外崩潰。

**獨立測試方式**：不存在的 email 與「存在但密碼錯誤」兩種情境皆回傳完全相同的 `401` body；模擬
的 repository／雜湊／JWT 失敗皆回傳通用的 `500`，回應與 log 中皆無敏感資料。

**依賴**：Phase 3（擴充 US1 所建立的 `AuthService.login`）。

### 使用者故事 2 的測試

> 先撰寫這些測試；在 T019 完成前 MUST 呈現失敗（或回傳 501）。

- [X] T012 [P] [US2] Contract 測試：不存在的 email → `401 { "message": "帳號或密碼錯誤" }`，
  寫在 `tests/integration/auth-login.test.ts`
- [X] T013 [P] [US2] Contract 測試：存在的 email + 錯誤密碼 → 與 T012 完全相同（逐字元一致）
  的 `401` body/狀態碼（依 FR-003），寫在 `tests/integration/auth-login.test.ts`
- [X] T014 [P] [US2] Contract 測試：mock 的 `users.password` 設為不合法的值（長度錯誤及／或
  版本前綴錯誤） → `500`，回應 body 不含任何雜湊值或 `password` 欄位，寫在
  `tests/integration/auth-login.test.ts`
- [X] T015 [P] [US2] Contract 測試：mock 的 repository 查詢失敗 → `500`，通用 body，未洩漏
  資料庫連線細節，寫在 `tests/integration/auth-login.test.ts`
- [X] T016 [P] [US2] Contract 測試：mock 的 `jsonwebtoken.sign` 拋出例外 → `500`，寫在
  `tests/integration/auth-login.test.ts`
- [X] T017 [P] [US2] Contract 測試：走訪每個情境（T005–T016）的回應 body，斷言皆不含
  `password` 欄位或 60 字元且 `$2[aby]$` 開頭的字串，寫在 `tests/integration/auth-login.test.ts`
- [X] T018 [P] [US2] 單元測試：以注入假的 `repository`（回傳 `null`／回傳密碼不符的資料列）與
  假的 `logger` 直接建構 `AuthService`，驗證 `login()` 對應拋出 `UnauthorizedError`，且雜湊格式
  不合法時會呼叫 `logger` 記錄一筆不含敏感值的 log，寫在 `tests/unit/auth.service.test.ts`
  （依賴 T003 已建立的檔案）

### 使用者故事 2 的實作

- [X] T019 [US2] 在 `src/modules/auth/auth.service.ts` 擴充 `AuthService.login`：帳號不存在與
  密碼不符皆拋出 `UnauthorizedError('帳號或密碼錯誤')`（FR-003/FR-009）；雜湊格式不合法時，
  透過建構時注入的 `this.logger` 記錄一筆安全 log（固定代碼
  `AUTH_PASSWORD_HASH_INTEGRITY_ERROR` + 僅含 `users.id`——不含 email、密碼或雜湊），再拋出
  一個一般 `Error`，使其落入既有全域 handler 的 `500` 分支（FR-004）（依賴 T009）

**檢查點**：US1 + US2 皆可獨立運作——不合法帳密、損毀資料與系統失敗皆能被安全處理，不洩漏帳號
存在與否，也不外洩資料。

---

## Phase 5：使用者故事 3 - 不合法的 request 被一致地拒絕（優先順序：P3）

**目標**：Request 驗證失敗（欄位缺漏／不合法、`password` 為空、未知欄位）回傳 Laravel 相容的
`422 { message, errors }` 格式，依 spec.md 已解決的 OD-1（選項 B）——而非專案一般統一的 `400`
格式；且此格式僅限 `auth/login` 這個 route 生效，不影響其他端點既有的 `400` 流程。

**獨立測試方式**：送出不合法的 body（欄位缺漏、email 格式錯誤、空字串密碼、未知的額外欄位），
確認每一種都精確回傳 `422` 與 `{ message: "The given data was invalid.", errors: {...} }`
格式，且不含 `code`/`requestId`；同時確認其他端點（以既有 `validate-request.test.ts` 中非
auth/login 的既有測試為準，若有的話）不受影響，仍回傳 `400`。

**依賴**：不依賴 Phase 3/4 的任何內容——觸及另一組不重疊的檔案（schema、驗證 middleware、
error handler、獨立的錯誤型別檔案、路由設定）。可由不同貢獻者與 Phase 3/4 並行實作；僅共用檔案
`auth.routes.ts` 需要一個與 Phase 3 修改處不衝突的小幅新增（設定 `legacyErrorFormat: true`）。

### 使用者故事 3 的測試

> 先撰寫這些測試；在 T020–T024 完成前 MUST 呈現失敗（目前回傳 `400`，或對格式正確的 body
> 回傳 `501`）。

- [X] T027 [P] [US3] Contract 測試：缺少 `password` → `422`，附
  `errors: { password: [...] }`，寫在 `tests/integration/auth-login.test.ts`
- [X] T028 [P] [US3] Contract 測試：`email` 格式不合法 → `422`，附 `errors.email`，寫在
  `tests/integration/auth-login.test.ts`
- [X] T029 [P] [US3] Contract 測試：`password` 為空字串 → `422`，附 `errors.password`，寫在
  `tests/integration/auth-login.test.ts`
- [X] T030 [P] [US3] Contract 測試：未知的額外欄位（例如 `{ ..., "remember": true }`）→
  `422`，附 `errors.remember`，並確認該請求會被直接拒絕（不會被靜默當作一般登入處理），寫在
  `tests/integration/auth-login.test.ts`
- [X] T031 [P] [US3] 單元測試：直接呼叫 `toLegacyValidationErrors(zodError)`，針對（a）一般
  欄位錯誤與（b）`.strict()` 產生的單一 `unrecognized_keys` 錯誤兩種情況，驗證回傳的
  `Record<string, string[]>` 分別以正確欄位名稱為 key（後者須拆成每個違規欄位各一筆，而非
  共用一個空字串 key），寫在 `tests/unit/legacy-validation-error.test.ts`（依 research.md #1）

### 使用者故事 3 的實作

- [X] T020 [P] [US3] 在 `src/shared/errors/legacy-validation-error.ts`（獨立檔案，不併入
  `app-error.ts`）建立 `LegacyValidationError`（繼承 `AppError`，固定 `statusCode: 422`）與
  `toLegacyValidationErrors(zodError: ZodError): Record<string, string[]>`——依 research.md #1，
  特別處理 Zod 單一的 `unrecognized_keys` 錯誤，將其拆為每個違規欄位各一筆的 `errors[key]`
- [X] T021 [US3] 在 `src/middleware/validate-request.ts` 為 `ValidationSchemas`/
  `validateRequest` 加上選填旗標 `legacyErrorFormat?: boolean`；設定為 true 時，若
  `schemas.body.parse` 拋出 `ZodError`，攔截並改以 `toLegacyValidationErrors` 的結果包成
  `LegacyValidationError` 重新拋出；**未設定時（預設值，其餘所有既有與未來端點皆維持預設）**，
  行為與現況完全相同——ZodError 原樣拋出，交由 `error-handler.ts` 既有分支轉為 `400`（依賴
  T020）
- [X] T022 [US3] 在 `src/middleware/error-handler.ts` 新增 `LegacyValidationError` 分支，精確
  輸出 `{ message: "The given data was invalid.", errors: err.details }`，**不含**
  `code`/`requestId` 欄位（依賴 T020）
- [X] T023 [P] [US3] 在 `src/modules/auth/auth.schemas.ts` 為 `loginRequestSchema` 加上
  `.strict()`，使未知的頂層欄位產生 Zod 的 `unrecognized_keys` 錯誤（FR-001）
- [X] T024 [US3] 在 `src/modules/auth/auth.routes.ts` 的 login route，將
  `validateRequest` 呼叫改為傳入 `{ body: loginRequestSchema, legacyErrorFormat: true }`
  ——**僅**修改 login 這個 route 的呼叫，`register`/`logout` 路由維持原樣不受影響（依賴
  T021、T023）
- [X] T025 [US3] 更新 `tests/integration/validate-request.test.ts`：將既有的欄位缺漏斷言從
  `400`/`code: 'VALIDATION_ERROR'` 改為 `422` +
  `{ message: "The given data was invalid.", errors }`，並在 controller 實作完成後，將合法
  body 測試的預期狀態碼從 `501` 改為真正的狀態（若 mock 的使用者資料相符則為 `200`，若 mock 的
  repository 回傳空則為 `401`）——依 research.md #5（依賴 T021、T022、T023、T024、T010）
- [X] T026 [US3] 在 `migration-spec/openapi.yaml` 的 `authLogin` operation 新增 `422`
  response 項目 + `LegacyValidationError` component schema（依 Constitution 原則 XII /
  research.md #6，僅屬文件補充），然後執行 `npm run openapi:validate`

**檢查點**：三個使用者故事皆已可獨立運作。驗證失敗、帳密錯誤與成功路徑各自產生規格所要求的回應
格式，且驗證失敗的 `422` 格式僅限 auth/login 生效。

---

## Phase 6：Polish 與跨切面關注點

**目的**：涵蓋整個功能的 Definition-of-Done 關卡（spec.md 驗收標準／Constitution 原則 IX）。

- [X] T032 [P] 執行 `npm run typecheck`；修正新增／變更檔案中任何 strict-mode 違規
- [X] T033 [P] 執行 `npm run lint`；修正違規事項
- [X] T034 執行 `npm test` 與 `npm run test:integration`；確認整套測試——包含新增的
  `tests/unit/auth.service.test.ts`、`tests/unit/legacy-validation-error.test.ts` 與已更新的
  `tests/integration/validate-request.test.ts`——皆通過
- [X] T035 執行 `npm run openapi:validate` 與 `npm run build`
- [X] T036 依 `specs/001-auth-login/quickstart.md` 的選填手動驗證步驟，僅針對本機 Docker
  MySQL 執行（絕不使用正式環境憑證——Constitution 原則 XIII–XVII）——2026-08-25 已手動執行：
  `db:migrate`/`db:verify`（`migrations` 表缺失為已知預期差異，與本功能無關）、`200`/`401`/`422`
  （含未知欄位）情境皆以本機 Docker MySQL + 測試帳號實測通過，JWT payload 內容正確；測試後已
  清除容器、volume 與本機 `.env`
- [X] T037 [P] 更新根目錄 `README.md` 的「尚未完成事項」／「下一階段建議」章節，註記
  `auth/login` 現已實作完成（Constitution 原則 XII）；`register`/`logout` 維持標示為仍是
  `501`（範圍外——Constitution 原則 X）

---

## 相依性與執行順序

### Phase 相依性

- **Setup（Phase 1）**：無——無事可做。
- **Foundational（Phase 2）**：無——無事可做。
- **使用者故事 1（Phase 3）**：不依賴其他故事。可立即開始。
- **使用者故事 2（Phase 4）**：依賴 Phase 3（`AuthService.login` 以及其建立的 DI／
  composition root 串接）。
- **使用者故事 3（Phase 5）**：不依賴 Phase 3 或 4。可立即開始，與 Phase 3/4 並行。
- **Polish（Phase 6）**：依賴 Phase 3、4、5 皆已完成。

### 各使用者故事內部

- 測試須先撰寫，且在對應實作任務完成前 MUST 針對目前的 stub 呈現失敗。
- US1 依序為：DI 介面擴充（`auth.routes.ts` → `routes/index.ts` → `app.ts`）→ repository →
  service（含建構子注入）→ controller → composition root 實例化。
- US3 依序為：錯誤型別／mapper（獨立檔案）→ middleware 旗標 → error-handler 分支 → schema →
  路由串接。

### 並行機會

- US1 的測試任務（T005、T006、T003）可彼此並行；T001/T007（不同檔案）也可與測試並行。
- US2 的所有測試任務（T012–T018）可彼此並行。
- US3 的所有測試任務（T027–T031）可彼此並行，T020/T023 也可彼此並行。
- **Phase 3/4（US1→US2）與 Phase 5（US3）可由不同貢獻者並行進行**——除了 `auth.routes.ts`
  上兩處互不重疊的小幅修改外（Phase 3 擴充 deps 介面／實例化服務，Phase 5 只新增
  `legacyErrorFormat: true`），兩者觸及的檔案完全不重疊。

---

## 並行範例：使用者故事 1

```bash
# 一起啟動 US1 的測試（先撰寫，確認會針對 501 stub／尚未存在的 AuthService 失敗）：
Task: "Contract 測試：合法帳密 → 200 + token，寫在 tests/integration/auth-login.test.ts"
Task: "Contract 測試：重複合法登入 → 兩次皆 200，token 各自獨立有效，寫在 tests/integration/auth-login.test.ts"
Task: "單元測試：以注入假物件建構 AuthService，驗證成功路徑，寫在 tests/unit/auth.service.test.ts"

# 與測試並行，開始不相依檔案的實作項目：
Task: "在 src/modules/auth/auth.routes.ts 擴充 AuthRouterDeps 為 { pool, jwtSecret, jwtExpiresIn, logger }"
Task: "在 src/modules/auth/user.repository.ts 建立 UserRepository.findByEmail"
```

## 並行範例：使用者故事 3（與 US1/US2 相互獨立）

```bash
Task: "在 src/shared/errors/legacy-validation-error.ts 建立 LegacyValidationError + toLegacyValidationErrors mapper"
Task: "在 src/modules/auth/auth.schemas.ts 為 loginRequestSchema 加上 .strict()"
Task: "Contract 測試：缺少 password → 422，寫在 tests/integration/auth-login.test.ts"
Task: "Contract 測試：未知的額外欄位 → 422，寫在 tests/integration/auth-login.test.ts"
```

---

## 實作策略

### 先做 MVP（僅使用者故事 1）

1. 完成 Phase 3（US1）。
2. **停下並驗證**：合法帳密 → `200 { token }`，且可被 `authenticate` 驗證；`AuthService` 可
   脫離 Express app 獨立單元測試。
3. 這是一個站得住腳的 MVP 檢查點——此端點回答了「真實使用者能否登入？」——但由於錯誤帳密的
   處理（US2）尚不安全，MUST NOT 將此檢查點暴露在測試／開發環境以外。

### 增量交付

1. Phase 3（US1）→ 可運作的 happy path，且 DI／composition root 骨架到位。
2. Phase 4（US2）→ 在*帳密*層級安全地拒絕不合法／損毀的輸入；此時已可考慮用於正式環境。
3. Phase 5（US3）→ Laravel 相容的驗證錯誤格式（可在 Phase 4 之前、期間或之後完成——無先後
   相依關係）。
4. Phase 6 → 對三個使用者故事整體執行完整的 Definition-of-Done 驗證。

### 建議的單人單場次順序（若非跨貢獻者並行）

Phase 3 → Phase 4 → Phase 5 → Phase 6，因為即便 US3 並不嚴格要求先有 US1 的
`AuthService`/repository，多數任務在概念上仍是以此為基礎繼續發展。

---

## 與 plan.md 的對齊說明

本次任務清單已依 2026-07-27 修正版 `plan.md` 重新產生，修正了前一版任務清單（及 `research.md`）
仍反映的三處舊設計：

1. `validate-request.ts` 明確列為「擴充」（T021），而非「不變更」。
2. `LegacyValidationError`／`toLegacyValidationErrors` 統一放在獨立檔案
   `src/shared/errors/legacy-validation-error.ts`（T020），`app-error.ts` 不受影響。
3. `AuthService` 的 `jwtSecret`、`jwtExpiresIn`、`repository`、`logger` 一律於建構子注入
   （T009），並新增 T001/T002/T004 三個任務把這條 DI 鏈從 `auth.routes.ts` 經
   `routes/index.ts` 一路延伸到 `app.ts`；`AuthService` 內部不再讀取全域 `env`。

**更新（2026-07-27）**：`research.md` 已另行同步更新，#2 節改為將 `LegacyValidationError`／
`toLegacyValidationErrors` 放在獨立檔案 `src/shared/errors/legacy-validation-error.ts`，#4 節
已擴充為完整的 composition-root／建構子注入決策（`pool`、`jwtSecret`、`jwtExpiresIn`、
`logger` 皆經 `app.ts` → `routes/index.ts` → `auth.routes.ts` 注入 `AuthService`，內部不再讀
全域 `env`）。目前 `spec.md`／`plan.md`／`research.md`／`tasks.md` 四份文件對這三處設計的描述
已完全一致，無殘留落差。

## 備註

- `[P]` 任務觸及不同檔案，且不依賴尚未完成的任務。
- `[Story]` 標籤將 Phase 3–5 的每個任務對應回 spec.md 的 US1/US2/US3。
- 所有新增／變更的測試情境皆可追溯至 spec.md 的 SC-005 與其「測試需求」10 項清單，外加三項
  由 plan.md 的 DI 設計衍生出的單元測試（T003、T018、T031）；完整對應與手動驗證步驟請見
  `quickstart.md`。
- `register`/`logout` 的 controller 維持未變更的 `501` stub——不在本功能範圍內
  （Constitution 原則 X、spec.md 排除項目）。
- 每完成一項任務或一個邏輯群組即進行 commit；移至下一步前先確認該故事的檢查點。
