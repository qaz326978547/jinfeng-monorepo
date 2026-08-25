# Quickstart：驗證登入功能（POST /api/v2/auth/login）

在實作任務（`/speckit-tasks` → `/speckit-implement`）完成後執行以下步驟。本指南僅用於證明功能
可端到端運作，不包含實作程式碼。

## 前置條件

- Node.js >= 22，已安裝專案依賴套件（`npm install`）。
- 自動化測試不需要真實資料庫或 Zeabur 憑證——一律使用 `tests/helpers/build-test-app.ts` 中 mock
  的 pool（Constitution 原則 VIII：任何測試皆不得連接真實資料庫）。
- 若要執行選填的手動／本機資料庫檢查：依 `migration-spec/README.md` §9 執行
  `docker compose up -d mysql` + `npm run db:migrate` + `npm run db:verify`——**僅限本機測試資料**，
  絕不使用正式環境憑證（Constitution 原則 XIII–XIV）。

## 1. 靜態關卡

```bash
npm run typecheck
npm run lint
```

預期結果：兩者皆以 exit code 0 結束。不得出現新的 `any`／型別斷言用法（Constitution 原則 IV）。

## 2. 自動化測試

```bash
npm test
```

至少應涵蓋以下情境（對應 spec.md SC-005／使用者故事 1–3）：

- 使用合法既有帳號呼叫 `POST /api/v2/auth/login` → `200` + `{ token }`；token 可透過
  `authenticate` middleware 驗證，並解碼出預期的 `sub`/`email`/`isAdmin`。
- 同一組合法帳密呼叫兩次 → 兩次皆 `200`，兩個 token 各自獨立有效（不斷言兩個 token 字串不同——
  spec.md 使用者故事 1 情境 2）。
- 缺少 `password` → `422` + `{ message: "The given data was invalid.", errors: { password: [...] } }`。
- `email` 格式不合法 → `422`，附 `errors.email`。
- `password` 為空字串 → `422`，附 `errors.password`。
- 未知的額外欄位（例如 `remember`） → `422`，附 `errors.remember`，且該請求不會被靜默當作一般登入
  處理。
- 不存在的 email → `401` + `{ message: "帳號或密碼錯誤" }`。
- 存在的 email、錯誤的密碼 → 與上述情境完全相同的 `401` body/狀態碼。
- Mock 的 `users.password` 設為不合法（非 bcrypt）的值 → `500`，回應不含任何雜湊值；並有對應的
  log 呼叫，帶有固定的錯誤代碼、不含 email/password。
- Mock 的 repository 查詢失敗 → `500`，通用 body，未洩漏資料庫細節。
- Mock 的 JWT 簽發失敗（例如 spy `jsonwebtoken.sign` 使其拋出例外） → `500`。
- 每個成功／錯誤回應 body 皆須斷言**不**包含 `password` 或任何雜湊形狀的字串。
- `tests/integration/validate-request.test.ts` 已更新：既有的「缺少欄位」情境預期改為 `422`
  （而非 `400`），且一旦 controller 不再回傳 stub，預期也改為真正的 `200`/`401`（而非 `501`）——
  詳見 research.md #5。

```bash
npm run test:integration
```

預期結果：透過 integration-only 腳本執行時，同一套（或相關子集）測試皆通過。

## 3. 契約驗證

```bash
npm run openapi:validate
```

預期結果：一旦 `migration-spec/openapi.yaml` 的 `authLogin` operation 已納入新的 `422` response
項目（research.md #6），此步驟即會通過。若在完成該文件任務之前執行本步驟，實作行為與已記載契約
之間的落差會是預期中、可見的失敗——不應因此跳過此步驟。

## 4. Build

```bash
npm run build
```

預期結果：`tsc -p tsconfig.build.json` 成功完成，無任何錯誤。

## 5. 手動驗證（選填，僅限本機 Docker MySQL）

```bash
docker compose up -d mysql
npm run db:migrate
npm run db:verify
npm run dev
```

在另一個終端機視窗，僅使用**本機測試帳號**（絕不使用真實 Zeabur 資料——Constitution 原則
XIII–XVII）：

```bash
curl -i -X POST http://localhost:8080/api/v2/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"correct-password"}'
```

預期結果：`200` 並附 `{"token":"..."}`。改用錯誤密碼或不存在的 email 重試以確認 `401`；改帶入
額外欄位（例如 `{"email":"...","password":"...","remember":true}`）重試以確認 `422`。

## 完成定義檢查清單（spec.md 驗收標準）

- [ ] `POST /api/v2/auth/login` 不再回傳 `501`
- [ ] Request/response 在全部三種狀態碼上皆與 `migration-spec` + spec.md OD-1 完全一致
- [ ] 既有 bcrypt 雜湊可正確驗證
- [ ] JWT 依既有設定簽發，且可被既有的 `authenticate` middleware 驗證
- [ ] 不允許登入的帳號狀態：依 FR-005 為不適用（已確認不存在此類狀態）——非缺口
- [ ] 所有 SQL 皆使用 parameterized query
- [ ] Controller 不直接執行 SQL
- [ ] 任何回應或 log 皆無密碼／雜湊／完整 token 外洩
- [ ] 未變更正式資料庫 schema
- [ ] `npm run typecheck` 通過
- [ ] `npm run lint` 通過
- [ ] `npm test` 通過
- [ ] `npm run openapi:validate` 通過
- [ ] `npm run db:verify` 通過（若針對本機測試資料庫執行）
