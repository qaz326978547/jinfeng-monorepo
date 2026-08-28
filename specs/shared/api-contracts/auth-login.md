# 契約：POST /api/v2/auth/login

這是本功能實作的傳輸層契約，重新陳述 `migration-spec/openapi.yaml` 中 `operationId: authLogin`
的內容，並加上 spec.md 已解決的 OD-1（選項 B）之 `422` 新增項目。本專案對外提供 HTTP API，因此契約
格式採用逐端點的 request/response 規格（而非 library API 或 CLI schema）。

## 請求

```
POST /api/v2/auth/login
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "password": "the-users-password"
}
```

- 僅接受這兩個欄位。任何額外的頂層欄位 → `422`（詳見下方）。
- `email`：必填，字串，須為語法上合法的 email 地址。
- `password`：必填，字串，最小長度 1（拒絕空字串）。

## 回應

### 200 OK — 帳密驗證成功

```json
{ "token": "<JWT 字串>" }
```

- 不含其他欄位。`token` 是一個 JWT，其 payload 為 `{ sub: number, email: string, isAdmin:
  boolean }`，以既有的 `JWT_SECRET` 簽章，依 `JWT_EXPIRES_IN` 設定過期時間。
- 可被既有的 `src/middleware/authenticate.ts` 原樣驗證，不需修改。

### 401 Unauthorized — 帳號不存在或密碼錯誤（兩者無法區分）

```json
{ "message": "帳號或密碼錯誤" }
```

- 「email 不存在」與「email 存在但密碼錯誤」兩種情境的 body/狀態碼完全相同——不洩漏帳號是否存在
  （FR-003）。
- 可能包含本專案既有的額外 envelope 欄位（`code`、`requestId`）——這些欄位並非原始 Laravel 契約的
  一部分，但在本規格較早的一輪決策中（Assumption A1/FR-009）已被允許用於此狀態碼，且不受 OD-1
  影響（OD-1 僅涉及驗證失敗的 `422` 情境）。

### 422 Unprocessable Entity — request 驗證失敗（Laravel 相容，OD-1 選項 B）

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["The email field is required."]
  }
}
```

- `message` 永遠精確等於字面字串 `"The given data was invalid."`。
- `errors` 是以欄位名稱為 key 的物件；每個 value 都是該欄位一則以上、人類可讀訊息組成的非空陣列。
  訊息的確切文字本身並非契約關鍵（Laravel 自身的措辭也依規則而異）；真正關鍵的是**格式本身**
  （`{message, errors}`、不含其他頂層 key、狀態碼 `422`）。
- 觸發情境：缺少 `email`/`password`、`email` 格式不合法、`password` 為空字串、任何欄位型別不符，
  或出現未被定義的頂層欄位（以該違規欄位自身的名稱作為 key，例如
  `{ "remember": ["Unrecognized key: remember"] }`）。
- MUST NOT 包含 `code`/`requestId`——此回應刻意不使用本專案一般的統一錯誤 envelope（見 spec.md
  FR-001、research.md #2）。

### 500 Internal Server Error — 系統錯誤

```json
{ "message": "Internal server error", "code": "INTERNAL_ERROR", "requestId": "<uuid>" }
```

（確切的 `message` 字串僅為示意——由既有的全域 error handler 決定，非本功能定義。）

- 觸發情境：資料庫無法連線／查詢失敗；`users.password` 存在但不是受支援的 bcrypt 雜湊格式
  （資料完整性異常，FR-004）；JWT 簽發失敗（例如 `JWT_EXPIRES_IN` 格式不合法，FR-007）。
- MUST NOT 洩漏資料庫連線細節、觸發異常的密碼雜湊本身、`JWT_SECRET`，或是哪個帳號觸發了資料完整性
  異常（該細節僅記錄於伺服器端安全 log，依 FR-004 執行，絕不出現在 HTTP 回應中）。

## 本契約的非目標

- 任何回應皆不含 `refresh_token` 欄位（FR-008）。
- 不提供 rate-limiting 回應（例如 `429`）——本階段範圍外（Assumption A5）。
- 除了「帳號不存在」與「密碼錯誤」回傳完全相同的 body/狀態碼之外，不做進一步的 timing 拉平——
  未實作 dummy-hash-compare 延遲機制（FR-015、Assumption A7）。

## 追溯對應

| 契約元素 | spec.md 對應 |
|---|---|
| Request 格式、嚴格拒絕未知欄位 | FR-001 |
| 200 格式 | FR-006 |
| JWT payload | FR-007、FR-014 |
| 401 格式、無帳號枚舉 | FR-003、FR-009 |
| 422 格式（OD-1） | FR-001、已解決決策紀錄 OD-1 |
| 500 觸發情境 | FR-004、FR-010 |

## OpenAPI 後續工作（文件任務，非本計畫實作範圍）

`migration-spec/openapi.yaml` 的 `authLogin` operation 目前僅記載 `200`/`401`。須新增一個 `422`
response 項目 + 一個對應上述格式的 `LegacyValidationError` component schema，然後執行
`npm run openapi:validate`。詳見 research.md #6。
