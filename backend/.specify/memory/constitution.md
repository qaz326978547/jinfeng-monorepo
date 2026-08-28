<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0 (MINOR — new principle added)
Modified principles: none (no existing principle redefined or removed)
Added sections:
  - Development & Testing Standards, new XXI. Documentation Language Standard
    (Traditional Chinese required for all Spec Kit-produced Markdown
    artifacts, with defined carve-outs for code identifiers/technical terms
    and RFC keywords)
Removed sections: none
Templates requiring updates:
  ⚠ .specify/templates/spec-template.md — fixed English section headings
     (e.g. "User Scenarios & Testing", "Functional Requirements", "Success
     Criteria") should be translated to Traditional Chinese per XXI Rule 5,
     since no script in .specify/scripts/ or .specify/extensions/ greps for
     these exact English strings (verified 2026-07-27) — translation is safe
     but not yet done. Pending a dedicated follow-up pass.
  ⚠ .specify/templates/plan-template.md — same as above (headings like
     "Technical Context", "Constitution Check", "Project Structure"). Pending.
  ⚠ .specify/templates/tasks-template.md — same as above (headings like
     "Setup", "Foundational", "Polish & Cross-Cutting Concerns"). Pending.
  ⚠ .specify/templates/checklist-template.md — same as above. Pending.
  ⚠ specs/001-auth-login/*.md — already-produced feature docs (spec.md,
     plan.md, tasks.md, research.md, data-model.md, quickstart.md,
     contracts/auth-login.md, checklists/requirements.md) mix Traditional
     Chinese prose with English template headings; per XXI Rule 7 these
     should be progressively rewritten to unified Traditional Chinese
     without changing requirement content, numbering, paths, code, or
     technical semantics. Pending a dedicated follow-up pass (not done as
     part of this constitution amendment).
  ✅ .claude/skills/*/SKILL.md and .specify/templates/commands/* — treated as
     the tool's own operating instructions (not "Spec Kit-produced" output
     documents), so left in English; out of scope for XXI unless the project
     owner decides otherwise.
Follow-up TODOs:
  - TODO(TEMPLATE_TRANSLATION): translate the four templates listed above to
    Traditional Chinese headings, confirmed safe (no tooling depends on the
    literal English strings) but not yet executed — deferred pending
    explicit go-ahead given the scope (multiple files, cross-checked against
    every command that reads them).
  - TODO(FEATURE_DOC_TRANSLATION): apply the same rewrite to the existing
    specs/001-auth-login/ artifacts, per XXI Rule 7's "progressive rewrite"
    allowance.
-->

# jinfeng-back-node Constitution

## Core Principles

### I. API Contract First

任何實作 MUST NOT 任意修改 `migration-spec/`（含 `api-specification.md`、
`openapi.yaml`）中定義的 request/response 結構、HTTP method、HTTP status
code、錯誤格式、欄位名稱與資料型別。若功能需求與既有契約衝突，MUST 先在
feature spec 中記錄差異、原因與待確認事項，並取得決策後才可變更契約，
不得在實作中直接偏離。

**Rationale**: 19 支 `/api/v2/...` 端點的呼叫方（既有前端／既有使用者）依賴
現行契約；未經記錄的偏差會在生產環境造成難以追蹤的相容性破壞。

### II. Migration Spec as Source of Truth

`migration-spec/` 是本次 Laravel → Node.js 遷移的主要事實來源（API 合約、
資料庫 schema、商業邏輯偽程式碼、已知舊系統問題）。當 `migration-spec` 與
實際觀察到的 Laravel 舊程式行為衝突時，MUST NOT 自行臆測正確行為；MUST 將
差異與待確認事項記錄下來（例如比照 `known-legacy-issues.md` 的格式），並
交由專案負責人決定後才繼續實作。

**Rationale**: `migration-spec/` 已完成 19/19 端點與 25 張表的核對，是唯一
被驗證過的規格來源；跳過記錄直接猜測會讓後續稽核與除錯失去依據。

### III. Legacy System Compatibility Priority

新系統 MUST 優先維持既有 API 與資料行為的相容性（`known-legacy-issues.md`
中列出的舊系統怪異行為，包括看似無效或有缺陷的邏輯）。若要修正舊系統問題
（例如 `PUT /api/v2/admin/contact/{id}` 的欄位更新邏輯），MUST 在對應的
feature spec 中明確說明修正原因、影響範圍與相容策略，並經過確認後才可實作，
不得在一般功能開發中順手修正。

**Rationale**: 舊系統仍在生產環境服務既有使用者與前端；未經評估的行為變更
可能造成既有客戶端損壞。

### IV. TypeScript Strict Typing

專案 MUST 啟用並維持 TypeScript strict mode。MUST NOT 在沒有明確、記錄在
案的理由下使用 `any`、型別斷言（`as`）或 `@ts-ignore`/`@ts-expect-error`
忽略型別錯誤。若確有必要使用，MUST 在鄰近程式碼以註解說明無法避免的原因。

**Rationale**: 舊資料庫欄位命名不規則（如 `del`、`no`、`class`），strict
typing 是唯一能在編譯期攔截欄位誤用與型別不一致的機制。

### V. Input Validation at All Boundaries

所有外部輸入——request body、query、params、headers、環境變數——MUST 經過
Zod schema 或既有驗證機制（如 `config/env.ts`、`middleware/validate-request.ts`）
驗證後才可進入商業邏輯。未驗證的外部輸入 MUST NOT 直接被 controller 或
service 使用。

**Rationale**: 對外暴露的 19 支端點與環境設定是攻擊面與資料損毀風險的主要
入口；集中驗證能同時滿足契約一致性（原則 I）與安全性。

### VI. Layered Architecture

專案 MUST 維持 route → controller → service → repository/infrastructure 的
責任分離。Controller MUST NOT 直接操作資料庫（raw SQL、connection pool），
也 MUST NOT 包含複雜商業邏輯；商業邏輯屬於 service 層，資料存取屬於
repository/infrastructure 層。

**Rationale**: 延續 `src/` 現有 feature-based 結構（`modules/*`、
`infrastructure/database/`），保持低耦合並讓 19 支 API 的實作可獨立測試。

### VII. mysql2-Only Data Access

資料庫存取 MUST 使用 `mysql2/promise` 與 raw SQL（含 parameterized query），
MUST NOT 引入 Prisma、Knex migration、或其他會自動產生/執行 DDL 或自動正規化
schema 的工具。若後續需要型別安全查詢層，僅可在 mysql2 之上疊加純型別包裝
（如 Kysely 的 query builder，不啟用其 migration 功能），且須另行決策記錄。

**Rationale**: 正式資料庫有 25 張表、0 個現行外鍵、多張 MyISAM 表與不規則
命名；README.md 已記錄比較過程並排除 Prisma/Knex 的自動 DDL 風險。

## Development & Testing Standards

### VIII. Test Coverage Requirements

每個新功能 MUST 至少包含適當的 unit test 或 integration test，並涵蓋：
成功案例、輸入驗證失敗、業務錯誤、權限錯誤、系統錯誤五類情境（如適用）。
與資料庫相關的測試 MUST 使用 mock 或本機測試資料庫，MUST NOT 依賴正式
資料庫。

### IX. Definition of Done

每項功能在標記完成前 MUST 通過：`npm run typecheck`、`npm run lint`、
`npm test`、`npm run openapi:validate`；涉及資料庫 schema 或欄位語意變動時
MUST 額外執行 `npm run db:verify`。任一檢查失敗即視為未完成。

### X. Scoped Incremental Delivery

每次開發 MUST 只處理一個明確、可驗收的功能範圍（例如 `auth/login`），
MUST NOT 一次實作全部 19 支 API 或多個不相關功能，以避免規格、測試與
code review 範圍失控。

### XI. Avoid Over-Engineering

實作 MUST 優先沿用現有專案結構、共用工具（`shared/`、`middleware/`）、
錯誤格式（`AppError` 階層）與既有 middleware。除非有明確且已記錄的需求，
MUST NOT 新增第三方套件或建立尚未實際需要的抽象層（如無用途的 BaseClass、
Repository interface）。

### XII. Documentation Synchronization

當 API 行為、環境變數、操作流程或安全限制發生變更時，MUST 同步更新對應的
`README.md`、`migration-spec/`（限補充新專案使用說明，不得竄改原始規格）、
`openapi.yaml` 或 runbook，確保文件與實際行為一致。

### XXI. Documentation Language Standard（文件語言標準：繁體中文優先）

所有 Spec Kit 產出的 Markdown 文件（`spec.md`、`plan.md`、`tasks.md`、`research.md`、
`data-model.md`、`quickstart.md`、`contracts/` 目錄下的說明文件、checklist 與
analyze 報告等）MUST 以繁體中文撰寫，標題、段落、說明、驗收條件、風險與決策紀錄、
任務描述皆同此要求。

程式碼識別字、API 路徑、HTTP method、檔名、類別名、函式名、套件名稱、SQL、環境變數、
指令與技術標準名稱 MUST 保留原文，不強制翻譯。RFC 關鍵字（`MAY`、`MUST`、
`MUST NOT`、`SHOULD` 等）MAY 保留英文，但其周邊解釋文字 MUST 使用繁體中文。

範本（`.specify/templates/`）中原有的英文固定章節名稱 MUST 翻譯為繁體中文，除非有
明確證據顯示下游腳本或自動化工具依賴該英文字串本身（而非其語意結構）——此類例外
MUST 在對應範本或文件中註明保留原文的原因，不得只是圖方便而預設保留英文。

既有的中英混合文件 MUST 在不改變需求內容、編號、路徑、程式碼與技術語意的前提下，
逐步（不要求一次到位）改寫為統一的繁體中文。MUST NOT 輸出簡體中文；來源文件為
英文時 MAY 翻譯為繁體中文，但翻譯不得改變技術含義。

**Rationale**: 本專案團隊以繁體中文溝通，統一文件語言可降低 PM、QA 與稽核人員的
閱讀與決策成本；保留程式碼識別字、API 路徑與技術標準原文則確保文件與程式碼、API
契約、SQL 及環境設定之間的可搜尋性與一致性不因翻譯而流失。

## Production Environment Security Rules

### XIII. No Automatic Production Database Mutations

MUST NOT 對正式（Zeabur）資料庫自動執行 migration、`CREATE`、`ALTER`、
`DROP`、`TRUNCATE`、`INSERT`、`UPDATE` 或 `DELETE`。正式資料庫預設僅允許
唯讀查詢（如 `scripts/verify-schema.ts` 對 `information_schema` 的比對），
用於確認 schema、欄位語意、資料格式與舊系統行為。`scripts/migrate.ts` 在
`NODE_ENV=production` 時 MUST 拒絕執行。

### XIV. Remote Database Access Control

存取正式資料庫 MUST 使用專屬唯讀帳號；MUST NOT 讓 Claude Code、Spec Kit、
測試程式或任何開發工具使用 root 或具寫入權限的帳號連線正式資料庫。資料庫
密碼、連線字串、token 與 secret MUST NOT 寫入 `README.md`、`CLAUDE.md`、
spec 文件、log、測試快照或 Git 版本控制。

### XV. Environment Identification Before Remote Operations

執行任何遠端 API 或資料庫操作前，MUST 明確辨識目標環境為 local、test 或
production。若無法確認目標環境，MUST 停止操作並要求使用者確認，MUST NOT
臆測環境後繼續執行。

### XVI. Test API Usage Rules

Zeabur 測試環境的 API 可用於驗證 status code、response schema 與資料內容。
會新增、修改或刪除資料的測試 MUST 只在測試環境執行，MUST NOT 指向正式
（production）環境。

### XVII. Sensitive Data Protection

MUST NOT 在 log 或錯誤訊息中輸出明文密碼、完整 JWT、refresh token、
session 內容、資料庫密碼或完整個人資料。查閱正式資料時 MUST 限制欄位與
筆數，避免 `SELECT *` 與不必要的個資輸出。

### XVIII. SQL Injection Prevention

所有 SQL MUST 使用 parameterized query，MUST NOT 對外部輸入做字串拼接。
當 table 或 column 名稱需要動態組成時，MUST 先比對可信白名單，不得直接
使用未經檢核的輸入值。

### XIX. Transaction Semantics Awareness

僅有支援 transaction 的資料表與操作才可依賴 transaction 語意。對 MyISAM
資料表 MUST NOT 假設 rollback 一定有效；涉及 MyISAM 表的多步驟寫入 MUST
在設計時明確處理部分失敗的情境。

### XX. Git & Secret Hygiene

MUST NOT 提交 `.env`、正式資料庫憑證、Zeabur secret、JWT secret 或任何
真實帳號密碼至 Git。一旦發現 secret 已曝光，MUST 立即停止使用該 secret 並
進行輪替（rotate），同時記錄曝光範圍與處理結果。

## Governance

本 Constitution 的效力高於其他開發慣例、既有文件範本或個別 PR 中的臨時
決定；當兩者衝突時，以本文件為準。

**修訂程序**：任何原則的新增、移除或重新定義 MUST 以 PR 形式提出，並在
描述中說明修訂理由與受影響範圍；修訂需經專案負責人核准後方可合併。合併後
MUST 依下方版本規則更新版本號與 Sync Impact Report。

**版本規則（語意化版本）**：
- **MAJOR**：不相容的治理變更或既有原則被移除／重新定義。
- **MINOR**：新增原則或章節，或對既有原則做出實質擴充。
- **PATCH**：文字澄清、錯字修正、不影響語意的措辭調整。

**合規審查**：所有 PR 與 code review MUST 檢查是否符合本 Constitution，
尤其是原則 I（API 契約）、VII（資料庫存取方式）、XIII–XIV（正式資料庫
安全）、XVIII（SQL 安全）與 XXI（文件語言標準）。若某項複雜度或例外無法
避免，MUST 在對應 feature 的 `plan.md` 之 Complexity Tracking 區塊中記錄
理由；未記錄的違規視為不通過審查。日常開發指引請參考 `CLAUDE.md` 與
`migration-spec/README.md`。

**Version**: 1.1.0 | **Ratified**: 2026-07-24 | **Last Amended**: 2026-07-27
