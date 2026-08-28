# 規格品質檢查清單：登入功能（POST /api/v2/auth/login）

**目的**：在進入規劃階段前，驗證規格的完整性與品質
**建立日期**：2026-07-24
**功能**：[spec.md](../spec.md)

## 內容品質

- [x] 不含實作細節（程式語言、框架、API）
- [x] 聚焦於使用者價值與business需求
- [x] 以非技術利害關係人可理解的方式撰寫
- [x] 所有必填章節皆已完成

## 需求完整性

- [x] 不存在任何 [NEEDS CLARIFICATION] 標記
- [x] 需求皆可測試且無歧義
- [x] 成功標準皆可量測
- [x] 成功標準與技術無關（不含實作細節）
- [x] 所有驗收情境皆已定義
- [x] 邊界情境皆已辨識
- [x] 範圍界線清楚
- [x] 依賴項目與假設皆已辨識

## 功能就緒度

- [x] 所有功能需求皆有明確的驗收條件
- [x] 使用者情境涵蓋主要流程
- [x] 功能符合成功標準所定義的可量測成果
- [x] 規格中不含任何實作細節外洩

## 備註

- 本專案為**舊系統遷移專案**（Laravel 5.6 → Node.js），受 `.specify/memory/constitution.md`
  原則 I–III 與 VII 規範：本功能 MUST 逐字重現既有 API 契約，且 MUST 沿用特定的既有機制
  （bcrypt 雜湊相容性、`mysql2` parameterized query、已建置完成的 JWT/`AccessTokenPayload`
  契約、既有的 `AppError`/error-handler 格式）。規格「功能需求」與「假設」章節中對這些機制的引用，
  是由 constitution 與使用者本次需求所要求的、具承載力的相容性限制——並非偶發的實作細節外洩——因此
  「不含實作細節」／「與技術無關」等檢查項目是在此脈絡下評估並判定為通過。
- **2026-07-27 澄清階段（第一部分）**：一次人工審閱（非透過 `/speckit-clarify`）發現原始草稿
  在其中一點上言過其實地宣稱已解決。`spec.md` 已修正，新增明確的
  **「Open Decisions Requiring Project Owner Approval」**章節（OD-1：驗證錯誤的 HTTP 狀態碼／
  格式——舊 Laravel 的 `422` vs. 專案既有統一的 `400` envelope），並暫時將「不存在任何
  [NEEDS CLARIFICATION] 標記」標示為未完成。
  同一階段也一併：移除了 FR-005/SC-005 的不一致（SC-005 不再要求「不允許登入的帳號狀態」測試，
  因為 FR-005 已確認不存在此類欄位）；放寬重複登入的驗收情境，不再要求 token 字串必須不同；將以
  `GET /health` 作為比較基準的效能標準（SC-001）替換為功能性的 100% 成功標準，外加一個明確、
  可調整的量化延遲目標；透過原始碼檢視釐清 `bcryptjs` 對損毀雜湊的實際行為（FR-004），不再依賴
  假設的行為；定義了 `is_admin`（DB `0`/`1`）→ `isAdmin`（JWT boolean）的映射規則，並確認 `sub`
  維持 `number` 以對齊既有的 `AccessTokenPayload`（FR-007、FR-014）；記載 `loadEnv` 並不驗證
  `JWT_EXPIRES_IN` 的格式，故格式錯誤只會在簽發 token 當下才失敗（FR-007）；為 FR-001 的「僅接受」
  給出嚴格、可測試的定義（拒絕未知欄位），作為規格自行決定的工程預設值（Assumption A8）；並明確
  將 dummy bcrypt-compare 的 timing 緩解機制排除在範圍外，同時聲明並非已完全防止帳號枚舉
  （FR-015、Assumption A7）。
- **2026-07-27 澄清階段（第二部分）**：專案負責人裁定 OD-1，選擇**選項 B**——
  `POST /api/v2/auth/login` 的 request 驗證失敗（欄位缺漏／不合法、`password` 空字串、strict
  schema 檢出的未知欄位）現在回傳 Laravel 相容的
  `422 { "message": "The given data was invalid.", "errors": { "<field>": [...] } }`，精確重現
  舊系統的格式（不含 `code`/`requestId` envelope 欄位），而非專案一般統一的 `400` 格式。
  `spec.md` 的 FR-001 現已寫明精確的回應 body、適用的觸發條件，以及一項架構要求：此格式須透過
  專屬的錯誤型別／compatibility adapter 表達，並仍經由既有的全域 error handler 處理（不得在
  controller 中臨時組裝）。使用者故事 3 的驗收情境、Assumption A1，以及原本的「Open Decisions」
  章節（已更名為**「已解決決策紀錄」**，OD-1 標示為已解決）皆已同步更新。「不存在任何
  [NEEDS CLARIFICATION] 標記」一項已重新勾選為完成——**目前無任何未解決的待決事項**，可進入
  `/speckit-plan`。
- 使用者要求確認的 12 個項目已全數在 spec.md 的「來源查證紀錄」中附上引用來源並解決，包含第 3 項
  （失敗回應格式），該項目現已引用 OD-1 的裁定結果。
- **2026-07-27 文件語言標準套用**：依 constitution v1.1.0 新增的原則 XXI（文件語言標準），本檔案
  與 `specs/001-auth-login/` 下其餘既有文件（spec.md、plan.md、tasks.md、research.md、
  data-model.md、quickstart.md、contracts/auth-login.md）已將原本沿用範本的英文固定章節標題與
  英文敘述改寫為統一的繁體中文；程式碼識別字、API 路徑、HTTP method、檔名、類別名、函式名、SQL、
  環境變數與 JSON 範例維持原文不變，需求內容、編號（FR-/SC-/OD-/US 等）與技術語意皆未變動。
