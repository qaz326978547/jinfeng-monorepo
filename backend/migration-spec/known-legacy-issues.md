# 已知舊系統問題（known-legacy-issues.md）

只記錄會直接影響新 Node.js 實作的問題。每項包含：API path、目前觀察到的行為、建議的新行為、是否
需要專案負責人決定。

---

## 1. `PUT /api/v2/admin/contact/{id}` — 驗證欄位與實際更新欄位不一致

- **API path**：`PUT /api/v2/admin/contact/{id}`
- **目前觀察到的行為**：驗證規則要求送出完整報名資料（`class/quest/company/tel/num/contactList[]`
  等，與新增報名共用同一組驗證規則），但程式實際上只嘗試讀取 `name` 與 `no` 兩個欄位去更新——
  這兩個欄位既不在驗證規則內，也不是 `contact` 資料表允許批量寫入的欄位（`contact` 表甚至沒有
  `name` 欄位）。結果是呼叫端必須送出一大包報名資料才能通過驗證，但送出後**沒有任何欄位真的被
  更新**，只有 `updated_at` 時間戳會變動。
- **建議的新 Node.js 行為**：**不要照抄**。此 API 目前在生產環境等同無效更新。
- **是否需要專案負責人決定**：**是**——必須先確認這支 API 原本應該更新哪些欄位，才能在新專案
  中實作。

## 2. `/api/v2/admin/*` 缺少管理員授權檢查

- **API path**：所有 `admin/*` 端點（9 個）
- **目前觀察到的行為**：只檢查「是否為已登入使用者」，完全不檢查 `users.is_admin` 欄位——任何
  成功登入的一般使用者都能呼叫所有管理端點。
- **建議的新 Node.js 行為**：維持現況（登入即可存取）以求相容，或修正為需要 `is_admin=1`
  才能存取——**這是行為變更，會影響現有前端/使用者的可用性**。
- **是否需要專案負責人決定**：**是**。

## 3. `POST /api/v2/auth/logout` 未受認證中介層保護

- **API path**：`POST /api/v2/auth/logout`
- **目前觀察到的行為**：路由沒有掛認證中介層，但處理邏輯內部假設一定有已登入使用者，若請求沒帶
  有效憑證會直接拋出例外，變成 `500`（而非乾淨的 `401`）。
- **建議的新 Node.js 行為**：明確要求認證，未帶有效憑證時回傳 `401`。
- **是否需要專案負責人決定**：否，這是明確的錯誤修正。

## 4. 跨端點錯誤格式不一致

- **API path**：全部端點
- **目前觀察到的行為**：至少 3 種並存的錯誤回應格式（見 `api-specification.md` 「統一錯誤格式」
  章節）——FormRequest 驗證失敗用 `400 {status,message}`；登入的 inline 驗證失敗用 Laravel 預設
  `422 {message,errors}`；找不到資料用 `404/200系 {message}`。
- **建議的新 Node.js 行為**：逐端點保留原格式以維持前端相容性；不建議自行統一成單一格式（那是
  前端也需要配合調整的破壞性變更）。
- **是否需要專案負責人決定**：否，除非未來想要主動統一（那時才需要決定）。

## 5. HTTP status 不一致（同類操作、不同狀態碼慣例）

- **API path**：多處
- **目前觀察到的行為**：新增成功多數回 `201`，但部分讀取型操作找不到資料時混用 `404`；登入失敗
  用 `401`，一般驗證失敗用 `400`（見上）。屬於歷史遺留的不一致，非單一 bug。
- **建議的新 Node.js 行為**：依 `api-specification.md` 逐端點記錄的狀態碼實作，保持相容。
- **是否需要專案負責人決定**：否。

## 6. `GET /api/v2/seo`、`GET /api/v2/faq` 未過濾 `del` 欄位

- **API path**：`GET /api/v2/seo`、`GET /api/v2/faq`
- **目前觀察到的行為**：兩張表都有 `del`（軟刪除旗標）欄位，且專案內其餘類似的讀取端點
  （`contact-class`、`contact-quest`）都會過濾 `del=0`，但這兩支沒有過濾，可能回傳已標記刪除的
  資料。
- **建議的新 Node.js 行為**：**先按現況實作**（不過濾），除非需求方確認這是疏漏並要求修正。
- **是否需要專案負責人決定**：是（是否為疏漏待確認）。

## 7. `GET /api/v2/contact-class` 與 `GET /api/v2/contact-quest` 分頁行為不一致

- **API path**：`GET /api/v2/contact-class`（不分頁）vs `GET /api/v2/contact-quest`（分頁，每頁 10 筆）
- **目前觀察到的行為**：兩支邏輯幾乎相同（過濾 `del=0`、依 `no` 排序），但分頁行為不同。
- **建議的新 Node.js 行為**：按現況個別實作（保留各自現有行為）。
- **是否需要專案負責人決定**：否，除非想統一（那時才需要決定）。

## 8. `POST /api/v2/contact` 沒有使用資料庫 Transaction

- **API path**：`POST /api/v2/contact`
- **目前觀察到的行為**：建立 `contact` 主表資料後，再逐筆建立 `contact_list` 明細，兩者沒有包在
  同一個 transaction 內。若明細建立中途失敗，會留下已建立的 `contact` 與部分 `contact_list` 資料
  （不會回滾）。
- **建議的新 Node.js 行為**：建議加上 transaction 讓兩者要嘛一起成功要嘛一起失敗，這是純粹的健壯性
  改善，不會改變成功路徑的可觀察行為。
- **是否需要專案負責人決定**：否（單純建議性修正）。

## 9. `DELETE` 操作不會級聯刪除關聯資料

- **API path**：`DELETE /api/v2/admin/contact`
- **目前觀察到的行為**：刪除 `contact` 資料列後，`contact_list` 中 `cid` 指向該筆資料的資料列
  不會被連帶刪除或清空（正式資料庫此處沒有真正生效的外鍵約束），會產生孤兒資料。
- **建議的新 Node.js 行為**：**保留現況**（不要自行加上級聯刪除邏輯），否則會產生與正式環境不同
  的資料庫最終狀態。
- **是否需要專案負責人決定**：否，除非未來想清理孤兒資料（那是另一個獨立的資料清理任務）。

## 10. `contact_class`／`contact_quest`／`seo`／`faq` 的軟刪除旗標與硬刪除 API 並存

- **API path**：`DELETE /api/v2/admin/contact-class`
- **目前觀察到的行為**：`contact_class` 表本身有 `del` 手動旗標欄位（大部分讀取端點會過濾
  `del=0`，語意上像軟刪除），但 `DELETE /admin/contact-class` 是真的把整列從資料庫刪除，不是
  把 `del` 設成 1。兩種刪除語意在同一張表上並存。
- **建議的新 Node.js 行為**：**保留現況**（硬刪除），除非需求方希望改為統一走 `del` 旗標軟刪除
  （那會是行為變更）。
- **是否需要專案負責人決定**：是（是否統一刪除語意待確認）。

## 11. Email 收件人硬編碼

- **API path**：`POST /api/v2/contact`
- **目前觀察到的行為**：報名成功通知信收件人固定寫死在程式碼中，沒有讀取任何環境變數。
- **建議的新 Node.js 行為**：可以先照抄硬編碼值以求行為相容，同時建議改成環境變數設定（`RECIPIENT_EMAIL`），
  方便未來調整而不需改程式碼。
- **是否需要專案負責人決定**：否（低風險，建議性優化）。

## 12. 資料庫層面的既知限制

- **相關資料表**：`contact`、`contact_class`、`contact_quest`、`contact_list`、`faq`、`seo` 及
  9 張 `LEGACY_OR_EXTERNAL_TABLE`
- **目前觀察到的行為**：這些表使用 MyISAM 儲存引擎（不支援外鍵約束與交易），部分欄位混用
  `utf8mb3`/`utf8mb4` 字元集（歷史遺留）。正式資料庫目前沒有任何生效中的外鍵、View、Trigger、
  Stored Procedure（已用唯讀查詢確認 0 筆）。
- **建議的新 Node.js 行為**：`sql/001-create-tables.sql` 完整保留這些引擎與字元集設定，**不要**
  為了「一致性」把它們統一轉成 InnoDB/utf8mb4，那會改變交易與外鍵行為，偏離正式環境現況。
- **是否需要專案負責人決定**：否（除非未來要主動做資料庫現代化改造，那是獨立專案）。

## 13. 9 張表完全沒有本專案程式碼接觸

- **相關資料表**：`admin`、`browse`、`browse_record`、`faq_class`、`page`、`page_files`、
  `page_pics`、`seo_class`、`simple_setting`（分類為 `LEGACY_OR_EXTERNAL_TABLE`，見
  `database-schema.md`）
- **目前觀察到的行為**：正式資料庫中存在，但沒有任何 Laravel Model/Controller/路由引用，欄位
  命名風格（`m_pass_rem`/`m_pass_ans`、CMS 風格頁面欄位等）暗示可能屬於另一套系統共用同一資料庫。
- **建議的新 Node.js 行為**：`sql/001-create-tables.sql` 保留這些表的結構（維持資料庫 1:1 相容），
  但**不需要**為它們建立任何 API，除非取得需求方對用途的說明。
- **是否需要專案負責人決定**：是（若未來需要為這些表提供 API）。
