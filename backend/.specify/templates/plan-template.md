# 實作計畫：[功能名稱]

**分支**：`[###-feature-name]` | **日期**：[日期] | **規格**：[連結]

**輸入**：來自 `/specs/[###-feature-name]/spec.md` 的功能規格

**備註**：本範本由 `/speckit-plan` 指令填寫。執行流程請參見 `.specify/templates/plan-template.md`。

## 摘要

[從功能規格中擷取：主要需求 + 來自研究的技術做法]

## 技術背景

<!--
  待辦：請將本區塊內容替換為此專案的實際技術細節。
  以下結構僅供參考，用以引導迭代過程。
-->

**語言／版本**：[例如 Python 3.11、Swift 5.9、Rust 1.75，或 NEEDS CLARIFICATION]

**主要依賴套件**：[例如 FastAPI、UIKit、LLVM，或 NEEDS CLARIFICATION]

**資料儲存**：[如適用，例如 PostgreSQL、CoreData、檔案，或 N/A]

**測試方式**：[例如 pytest、XCTest、cargo test，或 NEEDS CLARIFICATION]

**目標平台**：[例如 Linux server、iOS 15+、WASM，或 NEEDS CLARIFICATION]

**專案類型**：[例如 library/cli/web-service/mobile-app/compiler/desktop-app，或 NEEDS CLARIFICATION]

**效能目標**：[依領域而定，例如 1000 req/s、10k lines/sec、60 fps，或 NEEDS CLARIFICATION]

**限制條件**：[依領域而定，例如 <200ms p95、<100MB 記憶體、可離線運作，或 NEEDS CLARIFICATION]

**規模／範圍**：[依領域而定，例如 10k 使用者、1M 行程式碼、50 個畫面，或 NEEDS CLARIFICATION]

## Constitution 檢查

*關卡：必須在 Phase 0 研究前通過；Phase 1 設計後需重新檢查。*

[依 constitution 檔案內容決定的檢查項目]

## 專案結構

### 文件（本功能）

```text
specs/[###-feature]/
├── plan.md              # 本檔案（/speckit-plan 指令輸出）
├── research.md          # Phase 0 產出（/speckit-plan 指令）
├── data-model.md        # Phase 1 產出（/speckit-plan 指令）
├── quickstart.md        # Phase 1 產出（/speckit-plan 指令）
├── contracts/           # Phase 1 產出（/speckit-plan 指令）
└── tasks.md             # Phase 2 產出（/speckit-tasks 指令——非 /speckit-plan 建立）
```

### 原始碼（repository 根目錄）
<!--
  待辦：請將下方的佔位目錄樹替換為此功能的實際配置。
  刪除未使用的選項，並以真實路徑（例如 apps/admin、packages/something）
  擴充所選擇的結構。最終產出的 plan 不應包含「選項」標籤。
-->

```text
# [若未使用請刪除] 選項 1：單一專案（預設）
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [若未使用請刪除] 選項 2：Web 應用程式（偵測到「前端」+「後端」時）
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [若未使用請刪除] 選項 3：行動裝置 + API（偵測到「iOS/Android」時）
api/
└── [同上方 backend 結構]

ios/ 或 android/
└── [平台專屬結構：功能模組、UI 流程、平台測試]
```

**結構決策**：[說明所選擇的結構，並參照上方擷取的實際目錄]

## 複雜度追蹤

> **僅當 Constitution 檢查出現需要合理化的違規事項時才填寫**

| 違規事項 | 為何需要 | 為何拒絕較簡單的替代方案 |
|-----------|------------|-------------------------------------|
| [例如：第 4 個專案] | [目前的需求] | [為何 3 個專案不夠用] |
| [例如：Repository pattern] | [具體問題] | [為何直接存取資料庫不夠用] |
