---

description: "功能實作的任務清單範本"
---

# 任務清單：[功能名稱]

**輸入**：來自 `/specs/[###-feature-name]/` 的設計文件

**前置條件**：plan.md（必要）、spec.md（若涉及使用者故事則必要）、research.md、data-model.md、contracts/

**測試**：以下範例包含測試任務。測試為「選填」——僅當功能規格中明確要求時才需納入。

**組織方式**：任務依使用者故事分組，以利各故事獨立實作與獨立測試。

## 格式：`[ID] [P?] [Story] 說明`

- **[P]**：可並行執行（不同檔案、無相依性）
- **[Story]**：本任務所屬的使用者故事（例如 US1、US2、US3）
- 說明中須包含明確的檔案路徑

## 路徑慣例

- **單一專案**：`src/`、`tests/` 位於 repository 根目錄
- **Web 應用程式**：`backend/src/`、`frontend/src/`
- **行動裝置**：`api/src/`、`ios/src/` 或 `android/src/`
- 以下路徑假設為單一專案——請依 plan.md 的實際結構調整

<!--
  ============================================================================
  重要：以下任務僅為示範用途，並非實際任務。

  /speckit-tasks 指令 MUST 將這些任務替換為依下列來源產生的實際任務：
  - spec.md 中的使用者故事（含優先順序 P1、P2、P3...）
  - plan.md 中的功能需求
  - data-model.md 中的實體
  - contracts/ 中的端點

  任務 MUST 依使用者故事組織，使每個故事都能：
  - 獨立實作
  - 獨立測試
  - 作為 MVP 增量交付

  請勿在產生的 tasks.md 檔案中保留這些示範任務。
  ============================================================================
-->

## Phase 1：Setup（共用基礎設施）

**目的**：專案初始化與基礎結構建置

- [ ] T001 依實作計畫建立專案結構
- [ ] T002 以 [語言] 初始化專案並安裝 [框架] 相依套件
- [ ] T003 [P] 設定 linting 與格式化工具

---

## Phase 2：Foundational（阻斷性前置作業）

**目的**：在任何使用者故事開始實作前，MUST 先完成的核心基礎設施

**⚠️ 重要**：在此 Phase 完成前，不得開始任何使用者故事的實作

以下為基礎設施任務範例（請依實際專案調整）：

- [ ] T004 建立資料庫 schema 與 migration 框架
- [ ] T005 [P] 實作驗證／授權框架
- [ ] T006 [P] 建立 API 路由與 middleware 結構
- [ ] T007 建立所有故事皆依賴的基礎 model／實體
- [ ] T008 設定錯誤處理與 logging 基礎設施
- [ ] T009 設定環境變數管理機制

**檢查點**：基礎建置完成——可開始並行實作各使用者故事

---

## Phase 3：使用者故事 1 - [標題]（優先順序：P1）🎯 MVP

**目標**：[本故事交付內容的簡述]

**獨立測試方式**：[如何獨立驗證本故事可運作]

### 使用者故事 1 的測試（選填——僅當有要求測試時才納入）⚠️

> **注意：先撰寫這些測試，並確認在實作前會失敗**

- [ ] T010 [P] [US1] 於 tests/contract/test_[name].py 為 [端點] 撰寫 contract 測試
- [ ] T011 [P] [US1] 於 tests/integration/test_[name].py 為 [使用者旅程] 撰寫 integration 測試

### 使用者故事 1 的實作

- [ ] T012 [P] [US1] 於 src/models/[entity1].py 建立 [Entity1] model
- [ ] T013 [P] [US1] 於 src/models/[entity2].py 建立 [Entity2] model
- [ ] T014 [US1] 於 src/services/[service].py 實作 [Service]（依賴 T012、T013）
- [ ] T015 [US1] 於 src/[location]/[file].py 實作 [端點／功能]
- [ ] T016 [US1] 加入驗證與錯誤處理
- [ ] T017 [US1] 為使用者故事 1 的操作加入 logging

**檢查點**：此時使用者故事 1 應已完整可運作，並可獨立測試

---

## Phase 4：使用者故事 2 - [標題]（優先順序：P2）

**目標**：[本故事交付內容的簡述]

**獨立測試方式**：[如何獨立驗證本故事可運作]

### 使用者故事 2 的測試（選填——僅當有要求測試時才納入）⚠️

- [ ] T018 [P] [US2] 於 tests/contract/test_[name].py 為 [端點] 撰寫 contract 測試
- [ ] T019 [P] [US2] 於 tests/integration/test_[name].py 為 [使用者旅程] 撰寫 integration 測試

### 使用者故事 2 的實作

- [ ] T020 [P] [US2] 於 src/models/[entity].py 建立 [Entity] model
- [ ] T021 [US2] 於 src/services/[service].py 實作 [Service]
- [ ] T022 [US2] 於 src/[location]/[file].py 實作 [端點／功能]
- [ ] T023 [US2] 視需要與使用者故事 1 的元件整合

**檢查點**：此時使用者故事 1 與 2 應皆可獨立運作

---

## Phase 5：使用者故事 3 - [標題]（優先順序：P3）

**目標**：[本故事交付內容的簡述]

**獨立測試方式**：[如何獨立驗證本故事可運作]

### 使用者故事 3 的測試（選填——僅當有要求測試時才納入）⚠️

- [ ] T024 [P] [US3] 於 tests/contract/test_[name].py 為 [端點] 撰寫 contract 測試
- [ ] T025 [P] [US3] 於 tests/integration/test_[name].py 為 [使用者旅程] 撰寫 integration 測試

### 使用者故事 3 的實作

- [ ] T026 [P] [US3] 於 src/models/[entity].py 建立 [Entity] model
- [ ] T027 [US3] 於 src/services/[service].py 實作 [Service]
- [ ] T028 [US3] 於 src/[location]/[file].py 實作 [端點／功能]

**檢查點**：所有使用者故事現在應皆可獨立運作

---

[視需要依相同模式新增更多使用者故事 Phase]

---

## Phase N：Polish 與跨切面關注點

**目的**：影響多個使用者故事的改善事項

- [ ] TXXX [P] 於 docs/ 更新文件
- [ ] TXXX 程式碼清理與重構
- [ ] TXXX 跨所有故事的效能優化
- [ ] TXXX [P] 於 tests/unit/ 新增額外的單元測試（若有要求）
- [ ] TXXX 安全性強化
- [ ] TXXX 執行 quickstart.md 驗證

---

## 相依性與執行順序

### Phase 相依性

- **Setup（Phase 1）**：無相依性——可立即開始
- **Foundational（Phase 2）**：依賴 Setup 完成——會阻斷所有使用者故事
- **使用者故事（Phase 3+）**：皆依賴 Foundational Phase 完成
  - 之後各使用者故事可並行進行（若人力足夠）
  - 或依優先順序循序進行（P1 → P2 → P3）
- **Polish（最終 Phase）**：依賴所有預定的使用者故事皆已完成

### 使用者故事間的相依性

- **使用者故事 1（P1）**：Foundational（Phase 2）完成後即可開始——不依賴其他故事
- **使用者故事 2（P2）**：Foundational（Phase 2）完成後即可開始——可能與 US1 整合，但應可獨立測試
- **使用者故事 3（P3）**：Foundational（Phase 2）完成後即可開始——可能與 US1/US2 整合，但應可獨立測試

### 各使用者故事內部

- 測試（若納入）MUST 先撰寫，並在實作前 MUST 失敗
- Model 先於 Service
- Service 先於端點
- 核心實作先於整合
- 故事完成後才移至下一優先順序

### 並行機會

- 所有標記 [P] 的 Setup 任務可並行執行
- 所有標記 [P] 的 Foundational 任務可並行執行（於 Phase 2 內）
- Foundational Phase 完成後，所有使用者故事皆可並行開始（若團隊人力允許）
- 同一使用者故事中標記 [P] 的所有測試可並行執行
- 同一故事中標記 [P] 的所有 Model 可並行執行
- 不同使用者故事可由不同團隊成員並行開發

---

## 並行範例：使用者故事 1

```bash
# 一起啟動使用者故事 1 的所有測試（若有要求測試）：
Task: "於 tests/contract/test_[name].py 為 [端點] 撰寫 contract 測試"
Task: "於 tests/integration/test_[name].py 為 [使用者旅程] 撰寫 integration 測試"

# 一起啟動使用者故事 1 的所有 Model：
Task: "於 src/models/[entity1].py 建立 [Entity1] model"
Task: "於 src/models/[entity2].py 建立 [Entity2] model"
```

---

## 實作策略

### 先做 MVP（僅使用者故事 1）

1. 完成 Phase 1：Setup
2. 完成 Phase 2：Foundational（重要——會阻斷所有故事）
3. 完成 Phase 3：使用者故事 1
4. **停下並驗證**：獨立測試使用者故事 1
5. 若已就緒則部署／展示

### 增量交付

1. 完成 Setup + Foundational → 基礎就緒
2. 新增使用者故事 1 → 獨立測試 → 部署／展示（MVP！）
3. 新增使用者故事 2 → 獨立測試 → 部署／展示
4. 新增使用者故事 3 → 獨立測試 → 部署／展示
5. 每個故事在不破壞先前故事的前提下增添價值

### 團隊並行策略

若有多位開發者：

1. 團隊共同完成 Setup + Foundational
2. Foundational 完成後：
   - 開發者 A：使用者故事 1
   - 開發者 B：使用者故事 2
   - 開發者 C：使用者故事 3
3. 各故事獨立完成並整合

---

## 備註

- [P] 任務 = 不同檔案、無相依性
- [Story] 標籤將任務對應到特定使用者故事，以利追溯
- 每個使用者故事應可獨立完成並獨立測試
- 實作前需先確認測試會失敗
- 每完成一項任務或一個邏輯群組即進行 commit
- 可在任一檢查點停下，獨立驗證該故事
- 避免：模糊不清的任務、同檔案衝突、破壞獨立性的跨故事相依性
