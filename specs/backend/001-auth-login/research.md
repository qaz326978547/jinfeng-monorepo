# Phase 0 研究：登入功能（POST /api/v2/auth/login）

spec.md 沒有留下任何 `[NEEDS CLARIFICATION]` 標記（皆已透過 `migration-spec/` + 既有程式碼解決，
包含 OD-1）。因此本研究階段涵蓋的是**實作層級的技術決策**——那些規格刻意留待規劃階段決定的事項，
以及重新檢視既有程式碼後發現的幾項具體事實，會影響本計畫如何串接各部分。

> **2026-07-27 更新**：本檔案已依 `plan.md` 的內部一致性修正版同步更新，修正兩處先前與 `plan.md`
> 不一致之處——見 #2（`LegacyValidationError` 的檔案位置）與 #4（現已擴充為完整的 DI／
> composition root 決策，不再只處理 `pool`）。

## 1. 如何將 Zod 驗證失敗對應到 Laravel 的 `errors: { field: [...] }` 格式

**決策**：撰寫一個專用的 mapper（例如 `toLegacyValidationErrors(zodError: ZodError):
Record<string, string[]>`），走訪 `zodError.issues` 並：
- 對一般欄位錯誤，使用 `issue.path[0]`（轉字串）作為 key。
- 對 Zod 的 `unrecognized_keys` 錯誤（整個 `.strict()` object schema 只會產生**一筆**，而非每個
  未知欄位各一筆），走訪 `issue.keys`，為每個未知欄位各建立一筆 `errors[key]`。
- 將訊息附加到 `errors[key]`（若不存在則先建立陣列），使同一欄位的多筆錯誤能累加而非互相覆蓋。

**理由**：已透過閱讀實際安裝的 `zod@4.4.3` 原始碼（`node_modules/zod/v4/locales/en.cjs`）確認：
`.strict()` 違規會呈現為單一一筆錯誤，`code: "unrecognized_keys"`、`keys: string[]` 陣列、
`path: []`——並非每個違規欄位各自帶有已填入的 `path`。若天真地用 `issue.path.join('.')` 做 mapper，
未知欄位違規會靜默產生空字串 `""` 作為 key，違反 spec.md FR-001／使用者故事 3 情境 3 的要求（未知
欄位的錯誤須以該欄位實際名稱作為 `errors` 的 key，例如 `{ "remember": [...] }`）。此情況 MUST
特別處理。

**考慮過的替代方案**：對所有錯誤型別一律使用 `issue.path.join('.')`——已否決，會為未知欄位錯誤產生
錯誤的 key（見上述）。使用 Zod 內建的 `.flatten()`/`.format()`——考慮過，但其預設輸出形狀
（`fieldErrors`/`formErrors`）對 `unrecognized_keys` 的處理並無改善（底層仍是同樣的 `path: []`
問題），且比起一個小型專用 mapper 多了一道轉換步驟卻沒有額外好處。

## 2. 如何在不干擾既有統一 error handler 的前提下，表達 Laravel 相容的 `422` 格式

**決策**：在**獨立檔案** `src/shared/errors/legacy-validation-error.ts`（不併入
`src/shared/errors/app-error.ts`）新增一個錯誤類別 `LegacyValidationError extends AppError`，
固定 `statusCode: 422`，並帶有形狀已經是 `Record<string, string[]>` 的 `details` payload；
同一檔案也存放 #1 節的 `toLegacyValidationErrors` mapper，因為兩者是緊密耦合的一組邏輯（mapper
產出的形狀就是這個錯誤類別 `details` 所需的形狀）。`app-error.ts` 維持不變，只保留既有的一般
錯誤類別階層（`AppError`、`ValidationError`、`UnauthorizedError`、`ForbiddenError`、
`NotFoundError`、`NotImplementedError`），不混入任何 Laravel 相容性專屬邏輯。在
`src/middleware/error-handler.ts` 擴充一個分支，專門辨識 `LegacyValidationError` 型別（放在既有
`isAppError`/`ZodError` 分支之前或旁邊），且**只**輸出
`{ message: err.message, errors: err.details }`——省略一般 `AppError` 分支會為其他所有錯誤型別
加上的 `code`/`requestId` 欄位。auth 的 controller/service 只需拋出這個錯誤型別（透過既有的
async-handler → 全域 handler 流程），永遠不自行組裝回應。

**理由**：spec.md FR-001 要求 `422` 回應 body **精確等於** `{ message, errors }`、不含任何額外
envelope 欄位，這正是保留舊系統前端相容性的核心（OD-1 選項 B 的整體用意）。`error-handler.ts` 現有
的一般 `AppError` 分支一律會加上 `code`/`requestId`，因此單純繼承 `AppError` 的子類別無法在沒有
專屬分支的情況下產出精確符合要求的 body。這樣的做法維持了「單一、集中式 error handler」的架構
（Constitution 原則 VI、XI）——新格式是一個被辨識的**型別**，而非在 controller 內特判組字串。將
此型別與其 mapper 放在獨立檔案而非塞進 `app-error.ts`，是為了讓一般性、跨專案通用的錯誤階層
（`app-error.ts`）維持精簡、與框架無關；`LegacyValidationError` 是本次遷移特有、僅服務單一端點
相容性需求的邏輯，理當與一般錯誤階層分開存放，日後若不再需要相容 Laravel 格式，也能直接刪除這個
獨立檔案而不影響 `app-error.ts`。

**考慮過的替代方案**：直接在 controller 內用 `res.status(422).json(...)` 組出 `422` 回應——已否決，
違反 spec.md FR-001 明確的架構要求（「MUST NOT 自行組裝或直接輸出此錯誤 response」）以及
Constitution 原則 VI/XI（所有錯誤皆須經全域 handler）。沿用既有的一般 `ValidationError` 類別，
只在 handler 內以 `err.code === 'VALIDATION_ERROR' && err.statusCode === 422` 做特判——已否決，
會讓兩種本質上不同的回應格式混用同一個語意模糊的錯誤類別，未來維護時容易因為一次不小心的
`code` 字串比對而悄悄退回錯誤格式。直接將 `LegacyValidationError` 定義在 `app-error.ts` 內——
已否決（為先前草稿的做法，與 `plan.md` 修正後的決策不一致）：會讓一般性的基底錯誤檔案混入單一
端點的相容性專屬邏輯，違反 Constitution 原則 XI（Avoid Over-Engineering／避免不必要的耦合）。

## 3. Bcrypt 雜湊格式的事前驗證（在呼叫 `bcryptjs.compare` 之前）

**決策**：實作一個小型防護函式，例如 `isSupportedBcryptHash(hash: string): boolean`，檢查
`hash.length === 60 && /^\$2[aby]\$\d{2}\$/.test(hash)`，在 service 中於呼叫
`bcrypt.compare()` **之前**執行。若回傳 `false`，直接拋出資料完整性錯誤（依 FR-004/FR-010 由既有
全域 handler 轉為 `500`），完全不呼叫 `compare()`。

**理由**：這是 spec.md FR-004 的直接要求；該需求已完成原始碼層級的研究
（`bcryptjs@3.0.3`、`node_modules/bcryptjs/index.js`），確認 `compare()` 本身對不合法輸入的行為
並不一致（長度錯誤的雜湊會靜默回傳 `false`；長度正確但版本前綴錯誤的雜湊則會拋出例外）——因此格式
檢查必須獨立進行，不能靠「`compare()` 是否拋出例外」來推斷。

**考慮過的替代方案**：用 try/catch 包住 `compare()`，把任何拋出的例外都當作「雜湊完整性」情境——
已否決，違反 spec.md FR-004 明確指示不得依賴 `bcryptjs` 隱含的拋出/不拋出行為，因為它只對兩種
malformed 情境中的一種拋出例外（見上），會讓「長度錯誤」的情況被誤判為一般的「密碼錯誤」`401`，
而非應有的 `500` 資料完整性路徑。

## 4. 串接缺口：`AuthService` 所需的完整依賴（`pool`、JWT 設定、`logger`）皆尚未注入，且需要
   明確的建構子注入（constructor injection）設計以利獨立測試

**發現**：`src/routes/index.ts` 已在 `RouterDeps` 中取得 `pool`（供 health router 使用），但呼叫
`createAuthRouter({ jwtSecret: deps.jwtSecret })` 時**沒有**傳入 `pool`。`src/modules/auth/auth.routes.ts`
現有的 `AuthRouterDeps` 介面也只宣告了 `jwtSecret`。這是一個真實的缺口，不是刻意的設計選擇：
auth 模組目前完全沒有辦法查詢 `users` 表。更進一步檢視後，同樣的缺口也存在於
`JWT_EXPIRES_IN`（完全未被任何 router 層級的介面傳遞）與 `logger`（`app.ts` 已持有，但未往下
傳遞給 `routes/index.ts`／`auth.routes.ts`）——若不一併處理，很容易在實作 `AuthService` 時，
一部分設定（例如 `jwtSecret`）用參數注入，另一部分（例如 `JWT_EXPIRES_IN`）卻改成在 service
內部呼叫 `getEnv()` 直接讀取全域狀態，形成兩套互相衝突、難以測試的取得方式。

**決策**：建立一條完整、單一的 composition-root 注入鏈，而非只補上 `pool`：
- `src/routes/index.ts` 的 `RouterDeps` 擴充為
  `{ pool: Pool; jwtSecret: string; jwtExpiresIn: string; logger: Logger }`，`createRootRouter`
  將這四項原樣傳入 `createAuthRouter`。
- `src/app.ts` 的 `createApp({ env, pool, logger })` 從既有的 `env`（`env.JWT_SECRET`、
  `env.JWT_EXPIRES_IN`）與既有的 `logger` 參數取值，一併傳給 `createRootRouter`——`app.ts`
  維持是整個應用程式**唯一**讀取 `env` 物件的 composition root，其餘模組一律只接收明確參數。
- `src/modules/auth/auth.routes.ts`（auth 模組自身的 composition root）以 `AuthRouterDeps`
  擴充為 `{ pool: Pool; jwtSecret: string; jwtExpiresIn: string; logger: Logger }`，在此建構一次
  `UserRepository`（注入 `pool`）與 `AuthService`（注入
  `{ jwtSecret, jwtExpiresIn, repository, logger }`），延續骨架其餘部分已使用的
  route → controller → service → repository 分層方式（Constitution 原則 VI）。
- `AuthService` 的建構子接受 `{ jwtSecret, jwtExpiresIn, repository, logger }` 並存為實例屬性；
  `AuthService` 內部 **MUST NOT** 呼叫 `getEnv()` 或直接 `import` `env` 模組——所有需要的設定與
  依賴，皆只能來自建構子。

這是實作 FR-002／FR-007 所需的必要接線修正，而非對無關路由的範圍蔓延式重構；範圍僅限於
`app.ts` → `routes/index.ts` → `auth.routes.ts` → `auth.service.ts` 這條既有就存在、只是尚未
延伸到底的鏈路，不觸及 health router 以外的其他既有介面。

**理由**：若不做此變更，login handler 完全無法連到資料庫，也無法簽發需要 `JWT_EXPIRES_IN` 的
token；`node-api-implementation-checklist.md` #6 已經指名預期的形狀
（`UserRepository.findByEmail()`），證實這本來就是預期設計，只是尚未接上線。採用建構子注入而非
讓 `AuthService` 內部讀取全域 env，除了與 `app.ts` 既有的「單一 composition root」慣例一致
（`app.ts` 已經是唯一呼叫 `env` 的地方，`health` router 也是以 `pool` 參數注入、而非自行讀取全域
狀態），更直接的好處是 `AuthService` 因此可以在測試中以假的 `repository`/`logger`/字串常數
直接建構、獨立驗證其商業邏輯，完全不需要啟動 Express app 或呼叫 `loadEnv()`（見
`tests/unit/auth.service.test.ts`），對應 Constitution 原則 IV（可測試性／型別安全）與原則 XI
（避免不必要的耦合）的精神。

**考慮過的替代方案**：讓 `AuthService` 直接呼叫 `getEnv()` 取得 `JWT_SECRET`/`JWT_EXPIRES_IN`
（先前草稿的做法）——已否決：與 `jwtSecret` 透過 route 參數注入的做法同時存在，形成兩套互相衝突
的依賴取得方式；且會讓 `AuthService` 的單元測試被迫依賴 `process.env`／`loadEnv()` 的副作用，
無法單純以建構子參數隔離測試。只注入 `pool`、其餘（`JWT_EXPIRES_IN`、`logger`）留待實作階段
「順手」處理、不在規劃階段明確決定——已否決：這正是先前造成 `plan.md`／`research.md`
不一致的根本原因，明確在規劃階段就把完整的 DI 鏈路寫清楚，才能避免實作時各憑感覺挑選不同做法。

## 5. `tests/integration/validate-request.test.ts` 目前仍反映 OD-1 之前的假設

**發現**：既有測試（寫於更早的骨架階段，早於本規格的 OD-1 定案）斷言
`POST /api/v2/auth/login` 帶入不合法 body 時會回傳 `400`，且
`res.body.code === 'VALIDATION_ERROR'`。依 spec.md 已解決的 OD-1（選項 B），登入的驗證失敗現在
MUST 改為回傳 `422`，並使用 Laravel 相容的 `{ message, errors }` 格式。

**決策**：此測試必須在實作階段更新（已列為任務，依本指令「不修改 production code」的範圍，本次
規劃不執行），改為斷言 `422` 與新的 body 格式。同檔案中的第二個測試（斷言*合法* body 會進入
controller 並取得 `501`）也需要在 controller 不再回傳 `501` stub、改回傳真正的 `200`/`401` 之後，
一併更新其預期狀態碼。

**理由**：若放著這個測試不動，要嘛會直接失敗（因為新格式刻意不再回傳 `400`），要嘛更糟——會掩蓋
本功能其實並未真正落實 OD-1 的決策。現在就標示出來（而非日後才發現測試壞掉），可避免 `422`
（舊格式）與 `400`（一般統一格式）這兩條錯誤格式軌道被悄悄混在一起。

## 6. `migration-spec/openapi.yaml` 尚未記載此操作的 `422` response

**發現**：`migration-spec/openapi.yaml` 中的 `auth/login` operation 目前只記載了 `200` 與 `401`
兩種 response，這是在 OD-1 定案之前、也早於 `api-specification.md` 中已用文字寫成的完整
「統一錯誤格式」說明之前就存在的內容。

**決策**：作為本功能實作任務的一部分，為 `auth/login` operation 新增一個 `422` response 項目
（參照新的 `LegacyValidationError` component schema：`{ message: string, errors: object }`），
並重新執行 `npm run openapi:validate`。這是對已確認之舊系統行為（`api-specification.md` 的
「統一錯誤格式」章節、`known-legacy-issues.md` #4）的補充性文件紀錄，並非變更既有已確認的
`200`/`401` 契約——依專案「可補充、不得竄改原始規格」的規則（Constitution 原則 XII、
專案建立.md）允許此舉。

**理由**：`npm run openapi:validate` 是本功能 Definition-of-Done 的關卡之一（Constitution 原則
IX、spec.md 驗收清單）；若驗證測試已實際涵蓋 `422` 路徑，但 OpenAPI 契約卻未記載，契約與實作將會
悄悄地產生落差。

## 尚待釐清事項

無。技術背景中所有欄位皆已解決；不存在任何 `NEEDS CLARIFICATION`。
