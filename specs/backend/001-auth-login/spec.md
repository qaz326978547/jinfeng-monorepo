# 功能規格書：登入功能（POST /api/v2/auth/login）

**功能分支**：`001-auth-login`

**建立日期**：2026-07-24

**狀態**：草稿

**輸入**：使用者描述：建立 jinfeng-back-node 的第一份功能規格：實作 `POST /api/v2/auth/login`。範圍明確排除
register、logout、refresh token、忘記/修改密碼、其餘 16 支業務 API、前端登入頁面與資料庫 schema 修改。要求以
`migration-spec/` 的 API 合約、`database-schema.json`、`known-legacy-issues.md`、
`node-api-implementation-checklist.md` 與現有 `src/modules/auth/` 骨架為主要依據，衝突處須記錄差異、不得臆測；
詳細功能需求、架構要求、資料庫與環境安全規則、測試需求與驗收標準逐項列於下方各章節（逐條改寫自使用者原始需求，
未省略任何規則）。

## 使用者情境與測試 *(必填)*

### 使用者故事 1 - 既有使用者使用帳密登入取得憑證（優先順序：P1）

已存在於 `users` 表的使用者，使用其註冊時的 email 與密碼呼叫登入端點，取得後續呼叫受保護 API 所需的憑證。

**為何是此優先順序**：這是整個新系統唯一的登入入口；未來所有受保護端點（含尚未實作的 16 支業務 API）都仰賴此功能
核發的憑證，沒有它其他功能無法被合法使用者存取，因此是最高優先、必須先完成的 P1。

**獨立測試方式**：直接呼叫 `POST /api/v2/auth/login`，帶入 `users` 表中既有帳密，驗證回傳 `200` 與
`{ token }`，且該 token 可通過現有 `authenticate` middleware 的驗證。

**驗收情境**：

1. **Given** `users` 表中存在帳號，其 `password` 為該帳號真實密碼的 bcrypt 雜湊，**When** 以正確 email/password
   呼叫 `POST /api/v2/auth/login`，**Then** 回傳 `200` 與 `{ "token": "<string>" }`，且該 token 可被現有
   `authenticate` middleware 成功解碼並還原出對應的 `sub`/`email`/`isAdmin`。
2. **Given** 同一組合法帳密，**When** 短時間內重複呼叫兩次登入，**Then** 兩次都回傳 `200`，且每次回傳的 token
   都能被現有 `authenticate` middleware 驗證通過（允許同一帳號同時持有多組有效憑證，不做單一登入限制）。**驗收
   條件不要求兩次 token 字串互不相同**——同一 payload 若在同一秒內以相同演算法簽發，JWT 允許產生相同字串，測試
   MUST NOT 斷言兩次 token 不相等，只需各自驗證有效。

---

### 使用者故事 2 - 帳密錯誤時被安全地拒絕（優先順序：P2）

不存在的帳號或密碼錯誤的請求，必須被拒絕且不得洩漏帳號是否存在。

**為何是此優先順序**：防止未授權存取與帳號枚舉是基本資安要求，優先度僅次於「合法使用者能成功登入」本身。

**獨立測試方式**：分別用不存在的 email、以及存在但密碼錯誤的組合呼叫登入端點，驗證兩者回傳完全相同的狀態碼與
訊息內容。

**驗收情境**：

1. **Given** email 不存在於 `users` 表，**When** 呼叫 `POST /api/v2/auth/login`，**Then** 回傳 `401` 與
   `{ "message": "帳號或密碼錯誤" }`（可含現有統一錯誤格式的額外欄位，如 `code`、`requestId`）。
2. **Given** email 存在但 password 與雜湊比對不符，**When** 呼叫 `POST /api/v2/auth/login`，**Then** 回傳與
   情境 1 完全相同的狀態碼與 `message` 內容，呼叫方無法藉此分辨是帳號不存在還是密碼錯誤。

---

### 使用者故事 3 - 不合法的 request 被一致地拒絕（優先順序：P3）

格式不符的請求（缺欄位、型別錯誤、空字串等）在進入帳密驗證邏輯前就被攔截，並回傳一致、可解析的錯誤。

**為何是此優先順序**：確保呼叫方得到可預期、一致的驗證錯誤，是基本健壯性要求，但優先度低於核心登入流程與資安要求。

**獨立測試方式**：送出缺少必填欄位、型別錯誤或含未知欄位的 request body，驗證回傳與舊 Laravel API 相容的
`422` 驗證錯誤格式，且未觸發任何資料庫查詢。

**驗收情境**：

1. **Given** request body 缺少 `password`，**When** 呼叫 `POST /api/v2/auth/login`，**Then** 回傳 `422` 與
   `{ "message": "The given data was invalid.", "errors": { "password": ["<驗證訊息>"] } }`（見 FR-001 的
   Laravel 相容格式定義），且不執行任何資料庫查詢。
2. **Given** `email` 欄位格式不是合法 email（例如 `"not-an-email"`），**When** 呼叫登入，**Then** 回傳 `422` 與
   `{ "message": "The given data was invalid.", "errors": { "email": ["<驗證訊息>"] } }`。
3. **Given** request body 除 `email`、`password` 外，還包含任何其他欄位（例如
   `{ "email": "a@b.com", "password": "x", "remember": true }`），**When** 呼叫登入，**Then** 整個請求 MUST
   被拒絕並回傳 `422` 與 `{ "message": "The given data was invalid.", "errors": { "remember": ["<驗證訊息>"] } }`
   （未知欄位以其欄位名稱作為 `errors` 的 key），MUST NOT 靜默剔除 `remember` 欄位後繼續以 `email`/`password`
   處理登入（見 FR-001 的明確定義）。
4. **Given** `password` 為空字串，**When** 呼叫登入，**Then** 回傳 `422` 與
   `{ "message": "The given data was invalid.", "errors": { "password": ["<驗證訊息>"] } }`。

---

### 邊界情境

- 資料庫查詢過程發生連線失敗或逾時：視為系統錯誤（`500`），不得洩漏資料庫連線細節。
- `users.password` 欄位存在但內容不是受支援的 bcrypt hash 格式（60 字元、`$2[aby]$` 前綴；例如空字串、長度不符
  或版本前綴損毀）：依 FR-004 定義為資料完整性異常，回傳通用 `500`，不得嘗試修正或改寫正式資料，不得輸出該
  hash 值，並由安全 log 記錄不含敏感值的固定錯誤代碼。
- JWT 簽發過程發生非預期例外（例如 `JWT_SECRET` 缺失、或 `JWT_EXPIRES_IN` 格式不合法導致 `jsonwebtoken` 簽發時
  拋出例外——見 FR-007 關於此例外無法在應用程式啟動階段被攔截的說明）：回傳 `500`，錯誤內容不得包含
  `JWT_SECRET` 或其他機密設定值。
- 短時間內大量登入嘗試（暴力破解防護／rate limiting，以及帳號不存在時是否執行 dummy bcrypt compare 以降低
  timing 差異）：不在本功能範圍內（見 FR-015、Assumptions A7），本功能不宣稱已防止透過回應時間進行帳號枚舉。

## 需求 *(必填)*

### 功能需求

- **FR-001**: 系統 MUST 對 `POST /api/v2/auth/login` 的 request body 進行驗證，僅接受 `email`（string，email
  格式）與 `password`（string，至少 1 字元）兩個欄位。「僅接受」的明確、可測試定義：request body 中出現
  `email`、`password` 以外的任何欄位（無論該欄位型別或值為何）MUST 導致整個請求被拒絕（驗證失敗），MUST NOT
  被靜默忽略／剔除後繼續處理——即 schema MUST 使用 strict／拒絕未知欄位模式，而非預設會靜默剔除多餘欄位的寬鬆
  模式（現有 `src/modules/auth/auth.schemas.ts` 的 `loginRequestSchema` 目前未加此限制，須在實作階段補上）。

  **驗證失敗回應格式（OD-1 已決議：選項 B，Laravel 相容）**：以下情境 MUST 回傳 HTTP **`422`**，且回應 body
  MUST 精確等於：

  ```json
  { "message": "The given data was invalid.", "errors": { "<field>": ["<validation message>"] } }
  ```

  - `message` 欄位 MUST 固定為字串 `"The given data was invalid."`（與舊 Laravel 預設訊息逐字相同）。
  - `errors` MUST 是物件，key 為觸發驗證失敗的欄位名稱、value 為該欄位至少一則人類可讀驗證訊息組成的字串陣列；
    多個欄位同時失敗時，`errors` MUST 包含每個失敗欄位各自的 entry。
  - 回應 body **MUST NOT** 包含新專案統一錯誤格式常見的 `code`、`requestId` 等額外欄位——本情境以逐字相容
    Laravel 舊格式為優先，不套用專案其餘端點使用的統一錯誤 envelope。
  - 適用情境（MUST 觸發 `422`）：缺少 `email` 或 `password`、`email` 格式不合法、`password` 為空字串、任何
    欄位型別錯誤、request body 含有 `email`/`password` 以外的未知欄位（strict schema 檢出）。未知欄位情境下，
    `errors` 的 key MUST 為該未知欄位的實際名稱（例如 `{ "remember": ["Unexpected field."] }`）。
  - 此 `422` 格式僅適用於**上述 request 驗證失敗**情境；帳號不存在／密碼錯誤仍為 FR-009 定義的 `401`，資料庫
    錯誤／密碼雜湊資料完整性異常／JWT 簽發失敗仍為 FR-010 定義的通用 `500`（新專案統一格式），MUST NOT 套用
    Laravel `422` 格式到這些系統錯誤或帳密錯誤情境。

  **架構要求**：此 Laravel 相容格式 MUST 透過一個獨立、可辨識的錯誤型別（例如 `LegacyValidationError` 之類
  繼承既有 `AppError` 的子類別）或等效的 compatibility adapter 表達，並仍統一交由現有全域 error handler
  （`src/middleware/error-handler.ts`）依該錯誤型別輸出對應格式；Controller MUST NOT 自行組裝或直接輸出此
  錯誤 response（維持「所有錯誤必須經全域 error handler」的架構要求，不因相容 Laravel 格式而破例在 controller
  內手刻回應）。此為實作階段（`/speckit-plan`／`/speckit-implement`）的設計要求，本規格不修改任何 production
  code。
- **FR-002**: 系統 MUST 以 `email` 為查詢鍵，透過 `mysql2/promise` 的 parameterized query 查詢 `users` 表對應
  帳號；MUST NOT 將使用者輸入以字串拼接方式組入 SQL。
- **FR-003**: 系統 MUST NOT 在任何回應中揭露「帳號是否存在」的資訊；帳號不存在與密碼錯誤兩種情境 MUST 回傳完全
  相同的錯誤狀態碼與訊息內容。
- **FR-004**: 系統 MUST 使用 bcrypt（`bcryptjs`）比對 request 中的 `password` 與 `users.password` 既有雜湊值；
  MUST NOT 記錄明文密碼，MUST NOT 在錯誤訊息、log 或測試快照中輸出密碼雜湊本身。**規格不得依賴 `bcryptjs` 對
  不合法輸入的隱含行為**——經檢視 `bcryptjs`（`node_modules/bcryptjs/index.js`）原始碼確認其實際行為並不一致：
  - 若 `hash` 長度不是 60 字元（例如空字串、被截斷或明顯損毀的值），`compare()`/`compareSync()` 會**回傳
    `false`**（不拋出例外），效果上與「密碼錯誤」無法區分。
  - 若 `hash` 長度恰為 60 字元，但版本前綴不是合法的 `$2a$`/`$2b$`/`$2y$`（例如被覆寫成其他格式），
    `compare()` 會**拋出例外**（`Invalid salt version` / `Invalid salt revision`）。
  因此系統 MUST NOT 僅憑 `bcryptjs` 是否拋出例外來判斷「密碼雜湊格式異常」，而 MUST 在呼叫 `compare()`
  之前，先以明確、獨立的格式驗證（例如比對 bcrypt hash 的標準格式：60 字元、`$2[aby]$` 前綴）檢查
  `users.password` 是否為受支援的 bcrypt hash。若不符合，MUST 將其定義為**資料完整性異常**（而非「密碼錯誤」）：
  - MUST NOT 改寫或修正該筆正式資料。
  - MUST NOT 在任何回應、log 或測試快照中輸出該異常 hash 值本身。
  - MUST 回傳通用 HTTP `500`（與其他系統錯誤相同的統一格式，不得洩漏是哪個帳號或欄位造成）。
  - MUST 由安全 log（`req.log`／既有 pino logger）記錄一個不含敏感值的固定錯誤代碼（例如
    `AUTH_PASSWORD_HASH_INTEGRITY_ERROR`）與受影響的 `users.id`，以利事後排查；記錄內容 MUST NOT 包含
    `email`、密碼明文或密碼雜湊本身。
- **FR-005**: 系統 MUST NOT 對登入額外套用 `users` 表狀態限制（例如啟用/停用/軟刪除/管理員限定）；`is_admin`
  欄位 MUST NOT 影響登入是否成功（`users` 表不存在停用或軟刪除欄位，帳密比對成功即視為登入成功）。
- **FR-006**: 帳密驗證成功時，系統 MUST 回傳 HTTP `200` 與 JSON `{ "token": "<string>" }`；欄位名稱與結構須
  完全符合 `migration-spec`，MUST NOT 包含使用者資料、密碼或密碼雜湊。
- **FR-007**: 系統 MUST 使用現有 JWT 設定（`JWT_SECRET`、`JWT_EXPIRES_IN`）簽發 access token；payload MUST 僅
  包含後續驗證所需的最小資訊，且 MUST 與現有 `src/middleware/authenticate.ts` 已定義的 `AccessTokenPayload`
  介面完全一致，包含型別：
  - `sub`：**number**（`users.id`，維持與現有 `AccessTokenPayload.sub: number` 型別一致；不得改為 string，
    否則既有 `authenticate` middleware 解碼後的型別假設會失真）。
  - `email`：string，即登入用的 `users.email`。
  - `isAdmin`：**boolean**（見 FR-014 之 `is_admin` → `isAdmin` 轉換規則，不得直接傳遞資料庫原始的 `0`/`1`
    數值）。
  簽發與既有驗證端（`authenticate.ts`）MUST 使用完全一致的欄位名稱與型別，否則現有 middleware 會解碼出型別
  不符的 `req.user`。MUST NOT 額外加入密碼、密碼雜湊、資料庫憑證或不必要個資。
  **JWT_EXPIRES_IN 驗證時機澄清**：現有 `src/config/env.ts` 對 `JWT_EXPIRES_IN` 僅檢查其為非空字串
  （`z.string().default('1d')`），並未檢查其是否為 `jsonwebtoken` 可接受的合法期限格式（例如 `"1d"`、
  `"3600"`）。因此 **`loadEnv`／應用程式啟動階段 MUST NOT 被假設會攔截格式錯誤的 `JWT_EXPIRES_IN`**——若其值
  格式不合法，`jsonwebtoken` 會在實際簽發 token（即登入請求當下）才拋出例外。本功能 MUST 將此類例外視為 FR-010
  所定義的 JWT 簽發失敗（HTTP `500`），規格與對應測試 MUST 依此現況撰寫，不得假設啟動期驗證已提供保證。
- **FR-008**: 系統 MUST NOT 在本功能中實作或引入 `migration-spec` 未定義的 refresh token 機制。
- **FR-009**: 帳密驗證失敗（帳號不存在或密碼錯誤）時，系統 MUST 回傳 HTTP `401` 與
  `{ "message": "帳號或密碼錯誤" }`，透過現有 `UnauthorizedError`／全域 error handler 產生（允許附加現有統一
  錯誤格式的額外欄位，如 `code`、`requestId`）。
- **FR-010**: 系統 MUST 將資料庫查詢失敗、密碼雜湊比對過程中的非預期例外、以及 JWT 簽發失敗，統一視為系統錯誤並
  交由現有全域 error handler 處理（HTTP `500`）；controller MUST NOT 吞掉例外或自行組出不一致的錯誤結構。
- **FR-011**: 所有錯誤路徑（含驗證失敗、帳密錯誤、系統錯誤）的錯誤內容 MUST NOT 包含明文密碼、密碼雜湊、完整
  JWT、資料庫憑證或其他非必要敏感個資。
- **FR-012**: Controller MUST NOT 直接執行 SQL 或建立資料庫連線；資料庫存取 MUST 經由 service／repository 層，
  並使用 `mysql2/promise` 與 parameterized query。
- **FR-013**: 本功能 MUST NOT 修改正式資料庫 schema 或資料，MUST NOT 執行 migration、`ALTER`、`CREATE`、
  `DROP` 或 `TRUNCATE`；驗證登入所需的資料查詢 MUST 為唯讀操作。
- **FR-014**: `users.is_admin`（資料庫型別 `tinyint(1)`，透過 `mysql2` 讀出為 JS `number`，值僅為 `0` 或 `1`）
  轉換為 JWT payload 的 `isAdmin` 欄位時，MUST 使用明確、可測試的映射規則：資料庫值 `1` → `true`，資料庫值
  `0`（或任何非 `1` 的 falsy 值）→ `false`；MUST NOT 將原始的 `0`/`1` 數值直接放入 payload，`isAdmin` 在
  JWT payload 中 MUST 為 boolean 型別。
- **FR-015**：本功能 MUST NOT 實作「帳號不存在時執行 dummy bcrypt compare 以拉平回應時間」之類的 timing-attack
  緩解機制；此為本階段明確排除的非功能範圍（見 Assumptions A7），實作與測試 MUST NOT 假設或宣稱本功能已完全
  防止透過回應時間差異進行帳號枚舉。

### 關鍵實體

- **User（`users` 表）**：代表可登入帳號。關鍵屬性：`id`（主鍵，`int unsigned`）、`email`（登入帳號，唯一）、
  `password`（bcrypt 雜湊，非明文）、`is_admin`（資料庫型別 `tinyint(1)`，值 `0`/`1`；不影響登入判斷，僅供
  未來授權功能使用及轉換為 JWT 的 `isAdmin`）。本功能僅讀取，不新增或修改任何資料列。
- **Access Token（JWT）**：登入成功後核發的憑證，非資料庫實體。Payload 內容與型別：`sub`（`users.id`，
  **number**）、`email`（string）、`isAdmin`（**boolean**，由 `users.is_admin` 依 FR-014 規則轉換），以現有
  `JWT_SECRET` 簽章，有效期為現有設定 `JWT_EXPIRES_IN`（格式驗證時機見 FR-007 說明）。

## 成功標準 *(必填)*

### 可量測成果

- **SC-001**: 100% 使用既有 `users` 資料、合法帳密的登入請求，皆能在單一請求內成功取得可用憑證（不計較與
  `GET /health` 等不涉及資料庫查詢／密碼雜湊／JWT 簽發的端點比較回應時間，因為兩者工作量本質不同）。在正常負載下
  （單一測試環境、非壓力測試情境），95% 的登入請求（成功或失敗皆計入）應於 1 秒內回應；此為初始合理目標，若專案
  對效能另有要求，可於後續調整。
- **SC-002**: 100% 的「帳號不存在」與「密碼錯誤」情境回傳一致的錯誤訊息與狀態碼，無法藉由回應內容判斷帳號是否
  存在。
- **SC-003**: 100% 使用既有 `users` 資料、合法帳密登入取得的憑證，能通過現有驗證中介層的檢查。
- **SC-004**: 0 筆與登入相關的錯誤回應、log 或測試快照包含明文密碼或密碼雜湊。
- **SC-005**: 涵蓋成功登入、驗證失敗（含未定義欄位）、帳號不存在、密碼錯誤、資料庫錯誤、密碼雜湊格式異常
  （資料完整性異常）、JWT 簽發異常、回應不含密碼／雜湊等情境的自動化測試全數通過，且測試不依賴正式資料庫。
  **不包含**「不允許登入的帳號狀態」測試——因 FR-005 已確認 `users` 表不存在停用/刪除/封鎖等狀態欄位，此情境
  在本功能範圍內不存在，故不要求對應測試。

## 假設

- **A1（錯誤格式，已解決 — OD-1 選項 B，2026-07-27 由專案負責人裁定）**：登入的兩種錯誤情境格式如下，
  兩者皆已定案，非開放問題：
  - 帳密驗證失敗（帳號不存在／密碼錯誤）：CONFIRMED，維持 `401 { "message": "帳號或密碼錯誤" }`
    （`migration-spec/api-specification.md` #6，見 FR-009）。
  - 一般 request 驗證失敗（缺欄位、型別錯誤、空字串、未知欄位）：**採用 Laravel 相容格式**
    `422 { "message": "The given data was invalid.", "errors": { "<field>": ["<message>"] } }`，
    不使用新專案其餘端點的統一 `400` 格式（見 FR-001 完整定義）。裁定理由：(1) 本專案主要目標是遷移並優先維持
    既有 API contract 與前端相容性；(2) `migration-spec`／`known-legacy-issues.md` #4 已記錄 login 的
    validation error 為 Laravel `422` 格式，改用 `400` 屬於會影響現有前端的破壞性變更；(3) 相容格式仍須透過
    專用錯誤型別／compatibility adapter，交由現有全域 error handler 統一處理，controller 不得自行組裝回應。
    完整背景與曾考慮過的另一選項見下方「已解決決策紀錄」OD-1。
- **A2（帳號大小寫規則）**：`users.email` 欄位 collation 為 `utf8mb4_unicode_ci`（大小寫不敏感），以 email 查找
  帳號時天然具備大小寫不敏感比對，不需要應用層額外處理（來源：`migration-spec/database-schema.json`）。
- **A3（同帳號並行登入）**：`migration-spec` 與現有程式骨架皆未定義任何 session/token 黑名單機制（stateless
  JWT），故合理預設為允許同一帳號同時持有多組有效 token，本功能不做單一 session 限制；驗收條件不要求多次登入
  產生的 token 字串互不相同（見 User Story 1 Acceptance Scenario 2）。
- **A4（登入無側寫行為）**：`users` 表僅有 `id, name, email, password, remember_token, created_at, updated_at,
  is_admin` 八個欄位，`migration-spec/api-business-logic.md` 第 6 節的登入偽程式碼未描述任何寫入行為，
  `remember_token` 亦未被登入邏輯引用，故本功能不對 `users` 表做任何寫入（不記錄最後登入時間、IP 等）。
- **A5（暴力破解防護超出範圍）**：Rate limiting／登入嘗試次數限制不在本次功能範圍內；若未來需要，應另立功能規格
  處理。
- **A6（JWT 簽章演算法）**：沿用現有 `src/middleware/authenticate.ts` 已使用的對稱密鑰驗證方式（`jsonwebtoken`
  預設 HS256），本功能簽發時使用相同演算法與密鑰，以確保現有 middleware 可驗證本功能核發的 token。
- **A7（timing-attack／帳號枚舉之非功能範圍，明確聲明）**：本功能**不**在帳號不存在時執行 dummy bcrypt
  compare 來拉平回應時間，也不採取其他刻意的 timing 一致化措施（見 FR-015）。這是本階段的明確排除項目，
  **不代表**本功能已完全防止透過回應時間差異進行帳號枚舉；回應內容本身雖不洩漏帳號是否存在（FR-003），但
  尚未處理 side-channel timing 層面的風險。若未來需要，應另立功能規格處理。
- **A8（未知欄位處理策略，本規格已決定，非開放項目）**：`migration-spec` 與現有程式碼均未定義「request body
  含未知欄位時應拒絕還是忽略」；經考量與 Constitution 原則 V（所有外部輸入必須驗證）較為一致、且是明確可測試
  的行為，本規格**決定**採用「拒絕未知欄位」（strict schema）而非「靜默剔除」，詳見 FR-001。此為工程層級的
  合理預設，不涉及舊系統相容性或前端既有行為（Laravel 舊系統的 login 從未定義過多餘欄位的處理規則），故不
  列入需要專案負責人決策的開放項目；若你希望改為「靜默剔除」，請告知，將回頭修改 FR-001。

## 已解決決策紀錄

本章節記錄曾列為開放問題、現已由專案負責人裁定的決策，保留完整背景以利日後稽核；**目前無任何未解決的
待決事項**，可進入 `/speckit-plan`。

### OD-1：一般 request 驗證失敗的 HTTP 狀態碼與回應格式 — **狀態：已解決（2026-07-27，選項 B）**

**背景**：`migration-spec/api-specification.md`「統一錯誤格式」章節與 `known-legacy-issues.md` #4 記錄，舊
Laravel 登入的 inline 驗證失敗格式為：

```
422 { "message": "The given data was invalid.", "errors": { "email": ["..."] } }
```

`known-legacy-issues.md` #4 的建議是「逐端點保留原格式以維持前端相容性；不建議自行統一成單一格式（那是前端也
需要配合調整的破壞性變更）」。但目前專案骨架（`src/middleware/error-handler.ts`、`src/middleware/validate-request.ts`）
已經為全站建立了一套不同的統一格式：

```
400 { "message": "Validation failed", "code": "VALIDATION_ERROR", "requestId": "...", "details": [...] }
```

這兩者在 **HTTP 狀態碼**（`422` vs `400`）與 **回應 JSON 結構**（`{message, errors}` vs
`{message, code, requestId, details}`）上都不相容。若現有／未來前端仍依賴 Laravel 的 `422` 行為判斷「表單驗證
錯誤」，改用 `400` 統一格式會是一個**會影響現有呼叫方的破壞性變更**；反之，若為了相容前端而在 login 這個
端點特別改用 Laravel 的 `422` 格式，則會讓 login 與專案中其他端點的驗證錯誤格式不一致，且違反目前的架構要求
（「所有錯誤必須使用現有 AppError 與全域 error handler 的格式」）。

**選項**：

| 選項 | 做法 | 對前端相容性的影響 |
|---|---|---|
| **選項 A** | login 的一般 request 驗證失敗使用**新專案統一格式**（`400 { message, code, requestId, details }`），與專案其他端點一致，不特別相容 Laravel 的 `422` 格式 | 若現有前端曾針對 login 的 `422` + `{message, errors}` 格式寫死判斷邏輯，**會壞掉**，前端需要同步修改；但換來全站錯誤格式一致、後續 18 支 API 不必逐一討論此問題 |
| **選項 B（已採用）** | login 專門相容 Laravel 舊格式，回傳 `422 { "message": "The given data was invalid.", "errors": {...} } `，其餘端點仍用新專案統一格式 | 前端不需修改即可延用舊有 `422` 判斷邏輯；login 成為全站目前唯一使用非統一錯誤格式的端點——此為**已知且接受**的例外（透過專用錯誤型別／compatibility adapter 表達，非 controller 自組），非未決風險 |

**裁定結果（2026-07-27）**：專案負責人選擇 **選項 B**，理由詳見上方 Assumption A1。完整的 Laravel 相容格式
定義已寫入 FR-001，對應 Acceptance Scenario 已更新至 User Story 3。**此決策已定案，不再是 Open Decision。**

## 來源查證紀錄

以下逐項回覆使用者要求確認的 12 個問題，並標示資訊來源。全部（含原本標示為待決的第 3 項）現皆已 CONFIRMED／
已解決，無任何項目仍屬開放問題。

1. **登入 request 的確切欄位名稱** — CONFIRMED：`email`、`password`（`migration-spec/api-specification.md`
   #6；與現有 `src/modules/auth/auth.schemas.ts` 的 Zod schema 一致）。
2. **成功 response 的確切格式** — CONFIRMED：`200 { "token": "<string>" }`（`api-specification.md` #6）。
3. **失敗 response 的確切格式** — CONFIRMED（已解決，OD-1 選項 B）：帳密錯誤維持
   `401 { "message": "帳號或密碼錯誤" }`；一般驗證失敗（缺欄位/型別錯誤/空字串/未知欄位）採 Laravel 相容格式
   `422 { "message": "The given data was invalid.", "errors": {...} }`。詳見 Assumptions A1、FR-001、
   已解決決策紀錄 OD-1。
4. **帳號欄位及大小寫規則** — CONFIRMED：以 `email` 查找；DB collation `utf8mb4_unicode_ci` 天然大小寫不敏感
   （`database-schema.json`）。
5. **`users` table 的主鍵欄位** — CONFIRMED：`id`（`int unsigned`、`PRI`、auto_increment）。
6. **帳號停用或刪除欄位** — CONFIRMED：不存在（`users` 表僅 8 個欄位，無 `del`/`status`/`is_active`）。
7. **`is_admin` 是否影響登入** — CONFIRMED：否，`api-specification.md` #6 明確記載「帳號狀態判斷：無」。
8. **JWT payload 欄位** — CONFIRMED（依既有程式決定）：`sub`（**number**，user id）、`email`（string）、
   `isAdmin`（**boolean**，由 `is_admin` 的 `0`/`1` 依 FR-014 轉換），須與 `src/middleware/authenticate.ts` 的
   `AccessTokenPayload` 型別完全一致，見 FR-007。
9. **JWT 有效期限** — CONFIRMED（既有設定值）：`JWT_EXPIRES_IN`（預設 `1d`，`src/config/env.ts`）；但 CONFIRMED
   **啟動期 `loadEnv` 不驗證其格式合法性**，格式錯誤只會在簽發當下才拋出例外（見 FR-007）。
10. **是否允許同一帳號重複登入** — 無明確規格記載，採合理預設：允許（stateless JWT，無 session 表），見
    Assumptions A3；驗收條件不要求多次登入的 token 字串不同。
11. **logout 是否需要 token 撤銷** — 超出本次範圍（logout 為明確排除項目），不在本規格處理。
12. **Laravel 舊系統是否有登入時間、IP 或其他資料寫入行為** — CONFIRMED：無（`users` 表欄位與
    `api-business-logic.md` #6 偽程式碼均未提及任何寫入行為），見 Assumptions A4。
