# API 規格總覽（api-specification.md）

> 給新 Node.js + Express + Zod 專案的 API 規格文件。目標：新專案完全依此文件即可實作，不需要讀懂
> Laravel。原始碼位置僅供查證用，不代表新專案需要理解該程式碼。
>
> 確認狀態：`CONFIRMED` / `UNCONFIRMED` / `AUTH_REIMPLEMENTATION_REQUIRED` / `KNOWN_LEGACY_ISSUE`。
> 認證機制整體標記 `AUTH_REIMPLEMENTATION_REQUIRED`——新專案將重新設計登入與授權，**不需要**相容
> 舊有 Laravel Passport token。詳見 `known-legacy-issues.md`。

## 總覽表

全部 19 個 `/api` 端點（實際路徑皆為 `/api/v2/...`——Laravel 的 `RouteServiceProvider` 對
`routes/api.php` 統一加上 `/api` 前綴，`routes/api.php` 內部再加上 `v2` 前綴）：

| # | Method | 完整 Path | 需登入 | 權限需求 | 確認狀態 |
|---|---|---|---|---|---|
| 1 | GET | `/api/v2/seo` | 否 | 無 | CONFIRMED |
| 2 | GET | `/api/v2/contact-class` | 否 | 無 | CONFIRMED |
| 3 | GET | `/api/v2/contact-quest` | 否 | 無 | CONFIRMED |
| 4 | POST | `/api/v2/contact` | 否 | 無 | CONFIRMED |
| 5 | GET | `/api/v2/faq` | 否 | 無 | CONFIRMED |
| 6 | POST | `/api/v2/auth/login` | 否 | 無 | AUTH_REIMPLEMENTATION_REQUIRED |
| 7 | POST | `/api/v2/auth/register` | 否 | 無 | CONFIRMED |
| 8 | POST | `/api/v2/auth/logout` | 是 | 無 | AUTH_REIMPLEMENTATION_REQUIRED |
| 9 | GET | `/api/v2/admin/contact` | 是 | 任何已登入使用者（無 `is_admin` 檢查，見 known-legacy-issues） | CONFIRMED |
| 10 | GET | `/api/v2/admin/contact/{id}` | 是 | 同上 | CONFIRMED |
| 11 | PUT/PATCH | `/api/v2/admin/contact/{id}` | 是 | 同上 | KNOWN_LEGACY_ISSUE |
| 12 | DELETE | `/api/v2/admin/contact` | 是 | 同上 | CONFIRMED |
| 13 | GET | `/api/v2/admin/contact-list` | 是 | 同上 | CONFIRMED |
| 14 | GET | `/api/v2/admin/contact-list/{id}` | 是 | 同上 | CONFIRMED |
| 15 | GET | `/api/v2/admin/contact-class/{id}` | 是 | 同上 | CONFIRMED |
| 16 | POST | `/api/v2/admin/contact-class` | 是 | 同上 | CONFIRMED |
| 17 | PUT/PATCH | `/api/v2/admin/contact-class/{id}` | 是 | 同上 | CONFIRMED |
| 18 | DELETE | `/api/v2/admin/contact-class` | 是 | 同上 | CONFIRMED |
| 19 | GET | `/api/v2/admin/contact/search/search-company` | 是 | 同上 | CONFIRMED |

「需登入」欄位在新專案裡等同「必須通過新的 Bearer Auth 中介層」，不代表需要相容任何舊 token。

---

## 1. `GET /api/v2/seo`

- **需登入**：否 ／ **權限需求**：無
- **Path parameters**：無
- **Query parameters**：無
- **Request headers**：無特殊要求
- **Request body**：無
- **Response 成功**：`200`，JSON array，每筆為 `seo` 表全部欄位
- **Response 錯誤**：無自訂錯誤格式（未預期例外會是通用 500）
- **分頁格式**：無（回傳全表）
- **排序規則**：無（依資料庫預設順序，即插入順序 / primary key 順序）
- **過濾規則**：無——**注意**：其他類似端點都會過濾 `del=0`，這支沒有過濾，可能回傳已標記刪除的資料
- **使用資料表**：`seo`
- **讀取的欄位**：全部欄位
- **寫入的欄位**：無
- **Transaction 行為**：無（純讀取）
- **實際商業邏輯**：查詢 `seo` 表全部資料並直接回傳
- **特殊條件**：無
- **Side effects**：無
- **原始碼位置**：`app/Http/Controllers/SeoController.php`
- **確認狀態**：CONFIRMED（是否應過濾 `del` 本身是 UNCONFIRMED，見 known-legacy-issues.md）

## 2. `GET /api/v2/contact-class`

- **需登入**：否 ／ **權限需求**：無
- **Path/Query/Headers/Body**：皆無
- **Response 成功**：`200`，JSON array，欄位 `id, name, no, del, created_at, updated_at`
- **Response 錯誤**：無自訂
- **分頁格式**：無（回傳全部符合條件的資料）
- **排序規則**：依 `no` 欄位遞減（`ORDER BY no DESC`）
- **過濾規則**：`del = 0`
- **使用資料表**：`contact_class`
- **讀取的欄位**：全部欄位
- **寫入的欄位**：無
- **Transaction 行為**：無
- **實際商業邏輯**：查詢 `del=0` 的 `contact_class` 資料，依 `no` 遞減排序後回傳
- **特殊條件**：與 `GET /contact-quest`（#3）邏輯幾乎相同，但這支不分頁
- **Side effects**：無
- **原始碼位置**：`app/Http/Controllers/Contact/ContactClassController.php`
- **確認狀態**：CONFIRMED

## 3. `GET /api/v2/contact-quest`

- **需登入**：否 ／ **權限需求**：無
- **Path/Headers/Body**：無
- **Query parameters**：無明確分頁參數欄位名稱（Laravel 用內建 `?page=N` 慣例，見下方分頁格式）
- **Response 成功**：`200`，分頁 envelope（見下方分頁格式）
- **Response 錯誤**：無自訂
- **分頁格式**：Laravel `paginate(10)` 標準格式：
  ```json
  {
    "current_page": 1, "data": [ {"id":1,"name":"...","no":10,"del":0,"created_at":"...","updated_at":"..."} ],
    "first_page_url": "...", "from": 1, "last_page": 1, "last_page_url": "...",
    "links": [ {"url": null, "label": "&laquo; Previous", "active": false} ],
    "next_page_url": null, "path": "...", "per_page": 10, "prev_page_url": null, "to": 7, "total": 7
  }
  ```
  頁碼透過 query string `?page=N` 控制（Laravel 慣例），每頁固定 10 筆（寫死在程式碼，非可設定值）。
- **排序規則**：依 `no` 遞減
- **過濾規則**：`del = 0`
- **使用資料表**：`contact_quest`
- **讀取的欄位**：全部欄位
- **寫入的欄位**：無
- **Transaction 行為**：無
- **實際商業邏輯**：查詢 `del=0` 的 `contact_quest`，依 `no` 遞減排序，分頁（每頁 10 筆）
- **特殊條件**：與 `contact-class`（#2）邏輯幾乎相同但這支有分頁，是否為刻意設計 UNCONFIRMED
- **Side effects**：無
- **原始碼位置**：`app/Http/Controllers/Contact/ContactQuestController.php`
- **確認狀態**：CONFIRMED（分頁行為不一致本身標記 UNCONFIRMED，見 known-legacy-issues.md）

## 4. `POST /api/v2/contact`（報名表單送出）

- **需登入**：否 ／ **權限需求**：無
- **Path/Query parameters**：無
- **Request headers**：`Content-Type: application/json`
- **Request body**：

  | 欄位 | 必填 | 型別 | Validation | 預設值 |
  |---|---|---|---|---|
  | `class` | 是 | string | required | - |
  | `quest` | 是 | string | required | - |
  | `company` | 是 | string | required | - |
  | `tel` | 是 | string | required, max 10 字元 | - |
  | `num` | 是 | string | required | - |
  | `last5` | 否 | string | max 5 字元 | null |
  | `ticket` | 否 | string | 僅允許 `"2"` 或 `"3"` | 資料庫層 default `'2'`（僅在直接寫入資料庫且未提供值時生效；經由本 API 傳入 `null` 不會觸發資料庫 default，會存成 NULL） |
  | `ticket_name` | 否 | string | - | null |
  | `ticket_no` | 否 | string | - | null |
  | `ticket_address` | 否 | string | - | null |
  | `from` | 否 | string | - | null |
  | `suggest_name` | 否 | string | - | null |
  | `contactList` | 是 | array | required, array | - |
  | `contactList[].name` | 是 | string | required | - |
  | `contactList[].email` | 是 | string (email) | required, email 格式 | - |
  | `contactList[].job` | 否 | string | - | null |
  | `contactList[].cel` | 是 | string | required, max 10 字元 | - |

- **成功 HTTP status**：`201`
- **成功 Response JSON**：
  ```json
  { "message": "新增成功", "data": { "id": 1, "class": "...", "quest": "...", "company": "...", "tel": "...", "num": "...", "last5": null, "ticket": null, "ticket_name": null, "ticket_no": null, "ticket_address": null, "from": null, "suggest_name": null, "del": 0, "no": 0, "created_at": "...", "updated_at": "..." } }
  ```
  注意：`data` 只有 `contact` 主表欄位，不含剛建立的 `contact_list` 明細。
- **錯誤 HTTP status**：`400`（驗證失敗）
- **錯誤 Response JSON**：`{"status": "error", "message": "<第一條驗證錯誤訊息，繁體中文>"}`
- **分頁格式**：不適用
- **排序規則**：不適用
- **過濾規則**：不適用
- **使用資料表**：`contact`（寫入 1 筆）、`contact_list`（寫入 N 筆，N = `contactList` 陣列長度）
- **讀取的欄位**：無（純新增）
- **寫入的欄位**：`contact.*`（除 `id`/`del`/`no`/`created_at`/`updated_at` 外的全部欄位）；
  `contact_list.name/email/job/cel/cid`（`cid` = 剛建立的 `contact.id`）
- **Transaction 行為**：**目前沒有使用 DB transaction**——`contact` 建立成功後才逐筆建立
  `contact_list`，若中途失敗會留下部分寫入的 `contact_list` 資料（KNOWN_LEGACY_ISSUE，建議新專案
  加上 transaction，但需確認這不會改變現有前端可觀察到的行為）。
- **實際商業邏輯**：見 `api-business-logic.md` 第 4 節。
- **特殊條件**：`contactList` 陣列中只有同時具備 `email` 欄位的項目才會被寫入（程式檢查
  `is_array($item) && array_key_exists('email', $item)`）。
- **Side effects**：寄送 Email 通知（非同步 queue），收件人 **硬編碼為 `a0930532215@gmail.com`**
  （沒有讀取任何環境變數）。
- **原始碼位置**：`app/Http/Controllers/Contact/ContactController.php` (`store`)、
  `app/Http/Requests/CreateContactRequest.php`
- **確認狀態**：CONFIRMED（Transaction 缺失標記為 KNOWN_LEGACY_ISSUE）

## 5. `GET /api/v2/faq`

- **需登入**：否 ／ **權限需求**：無
- **Path/Query/Headers/Body**：無
- **成功 Response**：`200`，JSON array，`[{ "id": 1, "name": "...", "info": "...", "no": 10 }, ...]`
  （只投影這 4 個欄位，`faq` 表其餘欄位如 `pic`/`utube`/`info2~5` 不回傳）
- **錯誤**：無自訂
- **分頁格式**：無
- **排序規則**：依 `no` 遞減
- **過濾規則**：**無**（`faq` 表有 `del` 欄位但這支查詢沒有過濾，可能回傳已刪除資料，UNCONFIRMED 是否為疏漏）
- **使用資料表**：`faq`
- **讀取的欄位**：`id, name, info, no`（其餘欄位查出來但不投影進 response）
- **寫入的欄位**：無
- **Transaction 行為**：無
- **實際商業邏輯**：查詢全部 `faq`，只取 4 欄位，依 `no` 遞減排序，**用 key `"faq"` 快取 24 小時**
- **特殊條件**：快取沒有失效機制——本專案沒有任何 FAQ 新增/修改 API，若未來要讓資料更新即時反映，
  新專案需要自己決定快取策略（沿用 24hr TTL 或改事件式清快取）
- **Side effects**：寫入快取（key: `faq`, TTL: 1440 分鐘）
- **原始碼位置**：`app/Http/Controllers/Contact/FAQController.php`
- **確認狀態**：CONFIRMED（`del` 未過濾標記 UNCONFIRMED）

## 6. `POST /api/v2/auth/login`

> **AUTH_REIMPLEMENTATION_REQUIRED** — 只保留以下 CONFIRMED 資訊；token 產生/驗證/儲存邏輯完全由
> 新專案重新設計，不需要相容 Laravel Passport。

- **需登入**：否
- **Request body**：`{ "email": string, "password": string }`，兩者皆必填
- **驗證規則**：`email` 需符合 email 格式；`password` 純必填字串
- **使用者資料表與帳號欄位**：`users` 表，用 `email` 查找帳號
- **密碼欄位**：`users.password`（bcrypt 雜湊字串）
- **帳號狀態判斷**：無（`users` 表沒有 `is_active`/`email_verified_at` 之類的狀態欄位，只要
  email 存在且密碼比對成功即視為登入成功）
- **原本登入成功後回傳哪些使用者資料**：**不回傳使用者資料本身**，只回傳 token（見下方）
- **成功 HTTP status**：`200`
- **成功 Response JSON**：`{ "token": "<bearer token 字串>" }`（欄位名稱 `token` 需保留，實際 token
  產生方式由新專案決定）
- **錯誤 HTTP status**：`401`
- **錯誤 Response JSON**：`{ "message": "帳號或密碼錯誤" }`（帳號不存在或密碼錯誤回傳同一種訊息，
  不洩漏帳號是否存在）
- **使用資料表**：`users`（讀取，比對密碼）
- **實際商業邏輯**：見 `api-business-logic.md` 第 6 節
- **原始碼位置**：`app/Http/Controllers/Auth/AuthController.php` (`login`)
- **確認狀態**：AUTH_REIMPLEMENTATION_REQUIRED（僅 token 簽發部分；帳密驗證邏輯本身 CONFIRMED）

## 7. `POST /api/v2/auth/register`

- **需登入**：否
- **Request body**：

  | 欄位 | 必填 | 型別 | Validation | 預設值 |
  |---|---|---|---|---|
  | `name` | 是 | string | required | - |
  | `email` | 是 | string (email) | required, email 格式, 必須在 `users.email` 唯一 | - |
  | `password` | 是 | string | required, 至少 6 字元, 需搭配 `password_confirmation` 二次確認且相同 | - |
  | `password_confirmation` | 是（因 `confirmed` 規則） | string | 必須與 `password` 相同 | - |
  | `is_admin` | 否 | boolean | boolean 型別 | 未提供則資料庫層 default `0` |

- **成功 HTTP status**：`201`
- **成功 Response JSON**：`{ "message": "註冊成功" }`（**不回傳使用者資料或 token**，需另外呼叫登入）
- **錯誤 HTTP status**：`400`
- **錯誤 Response JSON**：`{ "status": "error", "message": "<第一條驗證錯誤訊息>" }`
- **使用資料表**：`users`（寫入）
- **寫入的欄位**：`name`, `email`, `password`（bcrypt 雜湊後）, `is_admin`（若提供）
- **Transaction 行為**：無（單一 insert，不需要）
- **實際商業邏輯**：見 `api-business-logic.md` 第 7 節
- **原始碼位置**：`app/Http/Controllers/Auth/AuthController.php` (`register`)、
  `app/Http/Requests/CreateUser.php`
- **確認狀態**：CONFIRMED（不涉及 token，無需重新設計）

## 8. `POST /api/v2/auth/logout`

> **AUTH_REIMPLEMENTATION_REQUIRED** — 只保留路徑與 response 格式；撤銷/失效機制由新專案設計。

- **需登入**：是（新專案應明確要求；舊系統這裡有 KNOWN_LEGACY_ISSUE，見 known-legacy-issues.md）
- **Request headers**：`Authorization: Bearer <token>`
- **Request body**：無
- **成功 HTTP status**：`200`
- **成功 Response JSON**：`{ "message": "登出成功" }`
- **錯誤情境**：未帶有效憑證時應回 `401`（新專案的正確行為；舊系統實際上是 500，見
  known-legacy-issues.md）
- **原始碼位置**：`app/Http/Controllers/Auth/AuthController.php` (`logout`)
- **確認狀態**：AUTH_REIMPLEMENTATION_REQUIRED

## 9. `GET /api/v2/admin/contact`

- **需登入**：是 ／ **權限需求**：任何已登入使用者（無角色檢查）
- **Query parameters**：`page`（Laravel 分頁慣例，選填，預設 1）
- **成功 Response**：`200`，分頁 envelope（格式同 #3），`data[]` 為 `contact` 全欄位
- **分頁格式**：`paginate(10)`，同 #3
- **排序規則**：依 `created_at` 遞減
- **過濾規則**：無
- **使用資料表**：`contact`
- **讀取的欄位**：全部欄位
- **原始碼位置**：`app/Http/Controllers/Contact/ContactController.php` (`index`)
- **確認狀態**：CONFIRMED

## 10. `GET /api/v2/admin/contact/{id}`

- **需登入**：是
- **Path parameters**：`id`（integer，`contact.id`）
- **成功 Response**：`200`，`contact` 欄位 + `contactList`（陣列，關聯的 `contact_list` 資料，
  巢狀在同一個 JSON 物件內，key 名稱為 `contactList`）
- **錯誤 Response**：`404`，`{ "message": "找不到資料" }`
- **使用資料表**：`contact`（讀取）、`contact_list`（讀取，依 `cid = contact.id` 關聯）
- **實際商業邏輯**：`SELECT * FROM contact WHERE id = :id`，並 eager-load
  `SELECT * FROM contact_list WHERE cid = :id`
- **原始碼位置**：`app/Http/Controllers/Contact/ContactController.php` (`show`)
- **確認狀態**：CONFIRMED

## 11. `PUT/PATCH /api/v2/admin/contact/{id}`

> **KNOWN_LEGACY_ISSUE** — 見 `known-legacy-issues.md`。以下記錄「舊系統目前驗證規則」與「舊系統
> 實際生效欄位」兩者，兩者不一致，新專案實作前需要專案負責人決定正確行為。

- **需登入**：是
- **Path parameters**：`id`（integer）
- **Request body（目前的驗證規則，要求整份報名資料）**：`class`, `quest`, `company`, `tel`, `num`,
  `contactList[]` 等（與 #4 `POST /contact` 完全相同的驗證規則）皆為必填
- **舊系統實際生效欄位**：程式碼實際只嘗試讀取 `name` 與 `no` 兩個欄位——但這兩個欄位**不存在**於
  上述驗證規則、也不存在於 `contact` 資料表、也不在 ORM 的可批量寫入欄位清單中。結果是：呼叫端
  必須送出完整報名資料才能通過驗證，但送出後**沒有任何欄位真正被更新**（只有 `updated_at` 時間戳
  改變）。
- **成功 HTTP status**：`200`
- **成功 Response JSON**：`{ "message": "更新成功", "data": { ...contact 欄位... } }`
- **錯誤 Response**：`404`，`{ "message": "找不到資料" }`
- **使用資料表**：`contact`
- **待決定事項**：這支 API 原本應該更新哪些欄位？可能的推測：(a) 誤用了 `POST /contact` 的驗證類別；
  (b) 原意是更新排序用的 `no` 欄位，但欄位名稱對錯了。**新專案實作前必須先確認**。
- **原始碼位置**：`app/Http/Controllers/Contact/ContactController.php` (`update`)
- **確認狀態**：KNOWN_LEGACY_ISSUE

## 12. `DELETE /api/v2/admin/contact`

- **需登入**：是
- **Request body**：`{ "ids": number | number[] }`（沒有固定 schema，陣列走批次分支、單一數字走
  單筆分支）
- **成功 HTTP status**：`200`
- **成功 Response JSON**：`{ "message": "刪除成功" }`
- **錯誤 HTTP status**：`404`
- **錯誤 Response JSON**：`{ "message": "以下的 id 不存在: 1, 2" }`（批次時列出全部不存在的 id）或
  `{ "message": "找不到 id: 5" }`（單筆時）
- **實際商業邏輯**：陣列模式先檢查全部 id 是否存在，若有任何不存在則整批回 404（不會刪除任何一筆）；
  全部存在才執行刪除。單筆模式：不存在則 404，存在則刪除。
- **使用資料表**：`contact`（硬刪除）
- **特殊條件**：**不會**連帶刪除 `contact_list` 中 `cid` 指向被刪除 `contact.id` 的資料列（現行
  資料庫沒有真正生效的外鍵級聯），會產生孤兒資料——新專案若要保持相容，**不應該**自行加上級聯刪除。
- **原始碼位置**：`app/Http/Controllers/Contact/ContactController.php` (`destroy`)
- **確認狀態**：CONFIRMED

## 13. `GET /api/v2/admin/contact-list`

- **需登入**：是
- **成功 Response**：`200`，`{ "data": [ {...contact_list 全欄位...}, ... ] }`
- **分頁格式**：無（回傳全表）
- **過濾規則**：無
- **使用資料表**：`contact_list`
- **原始碼位置**：`app/Http/Controllers/Contact/ContactListController.php` (`index`)
- **確認狀態**：CONFIRMED

## 14. `GET /api/v2/admin/contact-list/{id}`

- **需登入**：是
- **Path parameters**：`id`（integer）
- **成功 Response**：`200`，`contact_list` 全欄位
- **錯誤 Response**：`404`，`{ "message": "找不到資料" }`
- **使用資料表**：`contact_list`
- **原始碼位置**：`app/Http/Controllers/Contact/ContactListController.php` (`show`)
- **確認狀態**：CONFIRMED

## 15. `GET /api/v2/admin/contact-class/{id}`

- **需登入**：是
- **Path parameters**：`id`（integer）
- **過濾規則**：`del = 0`
- **成功 Response**：`200`，`contact_class` 全欄位
- **錯誤 Response**：`404`，`{ "message": "找不到資料" }`
- **使用資料表**：`contact_class`
- **原始碼位置**：`app/Http/Controllers/Contact/ContactClassController.php` (`show`)
- **確認狀態**：CONFIRMED

## 16. `POST /api/v2/admin/contact-class`

- **需登入**：是
- **Request body**：`name`（string, required）、`no`（integer, required）
- **成功 HTTP status**：`201`
- **成功 Response JSON**：`{ "message": "新增成功", "data": { ...contact_class 欄位... } }`
- **錯誤 HTTP status**：`400`
- **錯誤 Response JSON**：`{ "status": "error", "message": "<驗證錯誤訊息>" }`
- **使用資料表**：`contact_class`（寫入 `name`, `no`）
- **原始碼位置**：`app/Http/Controllers/Contact/ContactClassController.php` (`store`)
- **確認狀態**：CONFIRMED

## 17. `PUT/PATCH /api/v2/admin/contact-class/{id}`

- **需登入**：是
- **Path parameters**：`id`（integer）
- **Request body**：`name`（string, required）、`no`（integer, required）
- **過濾規則（查找時）**：`del = 0`
- **成功 Response**：`200`，`{ "message": "更新成功", "data": { ...contact_class 欄位... } }`
- **錯誤 Response**：`404`，`{ "message": "找不到資料" }`
- **使用資料表**：`contact_class`（讀取 + 更新 `name`, `no`）
- **原始碼位置**：`app/Http/Controllers/Contact/ContactClassController.php` (`update`)
- **確認狀態**：CONFIRMED（此支驗證欄位與實際寫入欄位一致，無疑點）

## 18. `DELETE /api/v2/admin/contact-class`

- **需登入**：是
- **Request body**：`{ "ids": number | number[] }`（同 #12 模式）
- **成功 Response**：`200`，`{ "message": "刪除成功" }`
- **錯誤 Response**：`404`，同 #12 訊息格式
- **使用資料表**：`contact_class`（硬刪除整列——注意此表也有 `del` 手動旗標欄位，但這支 API 是真的
  刪除整列，語意上與別處用 `del` 標記軟刪除不一致，UNCONFIRMED 是否為刻意設計）
- **原始碼位置**：`app/Http/Controllers/Contact/ContactClassController.php` (`destroy`)
- **確認狀態**：CONFIRMED（軟/硬刪除語意不一致標記於 known-legacy-issues.md）

## 19. `GET /api/v2/admin/contact/search/search-company`

- **需登入**：是
- **Query parameters**：`company`（string，選填，模糊比對關鍵字）
- **成功 Response**：`200`，分頁 envelope（同 #3），`data[]` 為 `contact` 全欄位
- **分頁格式**：`paginate(10)`
- **過濾規則**：`company LIKE '%<關鍵字>%'`（參數化查詢，無 SQL injection 風險；但使用者輸入若含
  `%`/`_` 萬用字元會影響比對範圍，未特別轉義，屬低風險已知行為）
- **使用資料表**：`contact`
- **原始碼位置**：`app/Http/Controllers/Contact/ContactController.php` (`searchCompany`)
- **確認狀態**：CONFIRMED

---

## 統一錯誤格式（跨端點）

目前有 3 種並存的錯誤格式，新專案應該逐端點保留對應格式（前端相容性優先）：

1. **FormRequest 驗證失敗**（`register`、`contact` 新增/更新、`contact-class` 新增/更新）：
   `400 { "status": "error", "message": "<第一條錯誤訊息>" }`
2. **登入的 inline 驗證失敗**：`422 { "message": "The given data was invalid.", "errors": { "email": ["..."] } }`
   （與上面的 400 格式不同，是 Laravel 的預設格式）
3. **找不到資料 / 找不到 id**：`404 { "message": "..." }`（純訊息，無 `status` 欄位）

詳見 `known-legacy-issues.md`。
