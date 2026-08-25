# Phase 1 資料模型：登入功能（POST /api/v2/auth/login）

本功能不涉及任何 schema 變更，也不新增任何持久化實體。內容為 request/response 的形狀定義，以及對
一個既有資料表的讀取。資料庫欄位的事實來源為 `migration-spec/database-schema.json`（`users` 表）。

## 實體

### User（既有 `users` 表——僅唯讀）

| 欄位 | DB 型別 | 應用層型別 | 備註 |
|---|---|---|---|
| `id` | `int unsigned`、PK、auto_increment | `number` | 成為 JWT 的 `sub`（FR-007） |
| `email` | `varchar(255)`、unique | `string` | 查詢鍵（FR-002）；collation `utf8mb4_unicode_ci` 在資料庫層即為大小寫不敏感（Assumption A2）——不需要應用層額外正規化 |
| `password` | `varchar(255)`、not null | `string` | Bcrypt 雜湊；呼叫 `bcrypt.compare()` 前 MUST 先驗證格式（FR-004、research.md #3） |
| `is_admin` | `tinyint(1)`、not null、預設 `0` | 由 `mysql2` 讀出為 `number`（0/1），使用前需轉為 `boolean` | 不影響登入判斷（FR-005）；依 FR-014 的 `1 → true, 0 → false` 規則轉為 JWT 的 `isAdmin` |

本功能刻意**不**讀取／使用的欄位：`name`、`remember_token`、`created_at`、`updated_at`（不做任何
side-write；Assumption A4）。

**Repository 契約**：`UserRepository.findByEmail(email: string): Promise<UserRow | null>`——
單次 parameterized `SELECT id, email, password, is_admin FROM users WHERE email = ? LIMIT 1`。
查無資料時回傳 `null`（service 會將此情況對應到與密碼錯誤相同的 `401`——FR-003）。

### LoginRequest（request DTO，不持久化）

| 欄位 | 型別 | 驗證規則 |
|---|---|---|
| `email` | `string` | 必填，須為合法 email 格式 |
| `password` | `string` | 必填，最小長度 1 |

依 FR-001，schema MUST 使用 `.strict()`（拒絕任何額外的頂層 key）。違規時產生的 `422` 精確格式
請見 `contracts/auth-login.md`。

### LoginSuccessResponse（response DTO，不持久化）

| 欄位 | 型別 | 備註 |
|---|---|---|
| `token` | `string` | 已簽章的 JWT；見下方 AccessTokenPayload。欄位名稱與頂層結構須與 `migration-spec` 完全一致（FR-006）——不含其他欄位。 |

### AccessTokenPayload（JWT payload——不持久化，定義於 `src/middleware/authenticate.ts`，沿用不重新定義）

| 欄位 | 型別 | 來源 |
|---|---|---|
| `sub` | `number` | `users.id`（FR-007——MUST 維持 `number`，不得改為 `string`） |
| `email` | `string` | `users.email` |
| `isAdmin` | `boolean` | 由 `users.is_admin` 依 `1→true`/`0→false` 轉換（FR-014） |

不含其他 claim。MUST NOT 包含密碼、密碼雜湊、資料庫憑證或其他個資（FR-007、FR-011）。

### 錯誤回應（不持久化；三種互不相通、各自獨立的格式）

| 情境 | HTTP | 格式 | 定義依據 |
|---|---|---|---|
| Request 驗證失敗（欄位缺漏／不合法、`password` 為空、未知欄位） | `422` | `{ "message": "The given data was invalid.", "errors": { "<field>": ["<msg>", ...] } }`——不含 `code`/`requestId` | FR-001（OD-1 選項 B） |
| 帳號不存在或密碼不符（兩者無法區分） | `401` | `{ "message": "帳號或密碼錯誤" }`（可能包含既有的 `code`/`requestId` 額外欄位） | FR-009 |
| 資料庫失敗、密碼雜湊完整性異常、JWT 簽發失敗，或任何非預期錯誤 | `500` | 既有的統一格式 `{ message, code, requestId }` | FR-010 |

這三者 MUST NOT 被混用：`LegacyValidationError`（422）是與一般 `AppError`/`UnauthorizedError`
（401）以及一般系統錯誤路徑（500）截然不同的型別。為何採用專屬錯誤型別而非改造既有型別的參數，
詳見 `research.md` #2。

## 狀態轉換

無。這是一個無狀態、唯讀的帳密驗證操作——呼叫本端點不會使任何實體發生狀態變化
（Assumption A4：不回寫最後登入時間／IP）。

## 驗證規則彙總（對應 spec.md 的功能需求）

- 未知的頂層欄位 → 拒絕（FR-001）
- `email` 缺漏／格式不合法 → 拒絕（FR-001）
- `password` 缺漏／空字串 → 拒絕（FR-001）
- 帳號不存在 → `401`，通用訊息（FR-003、FR-009）
- 密碼雜湊格式不受支援 → `500`，資料完整性路徑，不改寫資料（FR-004）
- 密碼不符（雜湊格式正確，但密碼錯誤） → `401`，通用訊息（FR-003、FR-009）
- `is_admin` 的值 → 從不作為登入限制，僅用於填入 JWT 的 `isAdmin`（FR-005、FR-014）
