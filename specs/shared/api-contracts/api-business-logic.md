# API 商業邏輯（api-business-logic.md）

> 框架無關的偽程式碼描述，供新 Node.js 專案直接參考實作。原始碼位置僅供查證，不代表需要理解
> Laravel 語法。

## 1. `GET /api/v2/seo`

```text
1. 查詢 seo 表全部欄位、全部資料列（無過濾、無排序、無分頁）
2. 回傳 200 + JSON array
```

原始碼：`app/Http/Controllers/SeoController.php`

## 2. `GET /api/v2/contact-class`

```text
1. 查詢 contact_class 表，條件 del = 0
2. 依 no 欄位由大到小排序
3. 回傳 200 + JSON array（不分頁）
```

原始碼：`app/Http/Controllers/Contact/ContactClassController.php`

## 3. `GET /api/v2/contact-quest`

```text
1. 查詢 contact_quest 表，條件 del = 0
2. 依 no 欄位由大到小排序
3. 分頁，每頁 10 筆，依 query string ?page= 決定頁碼
4. 回傳 200 + 分頁 envelope
```

原始碼：`app/Http/Controllers/Contact/ContactQuestController.php`

## 4. `POST /api/v2/contact`

```text
1. 驗證 request body（見 api-specification.md #4 的欄位表）
2. 若驗證失敗 → 回傳 400 + { status: "error", message: <第一條錯誤> }
3. 建立 contact 資料列，寫入除 contactList 外的所有 request 欄位
   （del/no 使用資料庫預設值 0，不由 request 指定）
4. 對 contactList 陣列的每一個項目：
   a. 若該項目不是物件、或沒有 email 欄位 → 略過（不寫入、不報錯）
   b. 否則建立一筆 contact_list 資料，欄位 name/email/job/cel 取自該項目，
      cid 設為步驟 3 建立的 contact.id
   （注意：目前沒有把步驟 3-4 包在同一個 transaction 內，若步驟 4 中途拋出例外，
    步驟 3 建立的 contact 與已建立的部分 contact_list 資料都不會回滾）
5. 寄送一封 Email 通知（非同步佇列），收件人固定為 a0930532215@gmail.com（不是可設定值），
   內容包含 company / class / num / tel
6. 回傳 201 + { message: "新增成功", data: <步驟 3 建立的 contact 資料> }
   （data 不包含 contactList）
```

原始碼：`app/Http/Controllers/Contact/ContactController.php` (`store`)

## 5. `GET /api/v2/faq`

```text
1. 檢查快取 key "faq" 是否存在且未過期（TTL 1440 分鐘 = 24 小時）
2. 若快取存在 → 直接回傳快取內容
3. 若快取不存在：
   a. 查詢 faq 表全部資料（不過濾 del）
   b. 對每筆資料只取 id/name/info/no 四個欄位
   c. 依 no 欄位由大到小排序
   d. 寫入快取 key "faq"，TTL 1440 分鐘
4. 回傳 200 + JSON array
```

原始碼：`app/Http/Controllers/Contact/FAQController.php`

## 6. `POST /api/v2/auth/login`

```text
1. 驗證 request body：email 必填且需符合 email 格式；password 必填字串
2. 若驗證失敗 → 回傳 422（Laravel 預設格式，見 api-specification.md 統一錯誤格式章節）
3. 用 email 查詢 users 表找出對應帳號
4. 若找不到帳號，或密碼比對失敗（bcrypt 驗證 users.password）
   → 回傳 401 + { message: "帳號或密碼錯誤" }（找不到帳號與密碼錯誤回傳同一種訊息）
5. 驗證成功：
   [AUTH_REIMPLEMENTATION_REQUIRED 從這裡開始——以下描述僅供參考舊行為，
    新專案應該用自己的驗證機制取代]
   a. (舊行為) 簽發一個 Laravel Passport personal access token，寫入 oauth_access_tokens
   b. (新專案) 依新專案的 auth 設計簽發自己的 token（例如 JWT）
6. 回傳 200 + { token: <步驟 5 產生的 token 字串> }
```

原始碼：`app/Http/Controllers/Auth/AuthController.php` (`login`)

## 7. `POST /api/v2/auth/register`

```text
1. 驗證 request body（見 api-specification.md #7 欄位表，含 email 唯一性檢查）
2. 若驗證失敗 → 回傳 400 + { status: "error", message: <第一條錯誤> }
3. 用 bcrypt 對 password 做雜湊
4. 建立 users 資料列：name、email、雜湊後的 password；若 request 有帶 is_admin 則一併寫入
5. 回傳 201 + { message: "註冊成功" }（不回傳使用者資料或 token）
```

原始碼：`app/Http/Controllers/Auth/AuthController.php` (`register`)

## 8. `POST /api/v2/auth/logout`

```text
[AUTH_REIMPLEMENTATION_REQUIRED — 以下為新專案應有的行為，非舊系統實際行為]
1. 驗證 request 是否帶有效的 Authorization: Bearer <token>
2. 若無效或缺少 → 回傳 401
3. 若有效 → 依新專案的驗證機制使該 token/session 失效
4. 回傳 200 + { message: "登出成功" }

[KNOWN_LEGACY_ISSUE — 僅供參考，不要照抄]
舊系統這裡沒有中介層保護，若沒帶 token 會嘗試對 null 呼叫方法而拋出例外，變成 500 而非 401。
```

原始碼：`app/Http/Controllers/Auth/AuthController.php` (`logout`)

## 9. `GET /api/v2/admin/contact`

```text
1. 驗證使用者已登入（見第 6/8 節的新驗證機制）
2. 查詢 contact 表，依 created_at 由新到舊排序
3. 分頁，每頁 10 筆，依 query string ?page= 決定頁碼
4. 回傳 200 + 分頁 envelope
```

原始碼：`app/Http/Controllers/Contact/ContactController.php` (`index`)

## 10. `GET /api/v2/admin/contact/{id}`

```text
1. 驗證使用者已登入
2. 用 path parameter id 查詢 contact 資料列
3. 若找不到 → 回傳 404 + { message: "找不到資料" }
4. 若找到 → 一併查詢 contact_list 表中 cid = id 的所有資料列
5. 回傳 200 + { ...contact 欄位, contactList: [...contact_list 資料] }
```

原始碼：`app/Http/Controllers/Contact/ContactController.php` (`show`)

## 11. `PUT/PATCH /api/v2/admin/contact/{id}`

```text
[KNOWN_LEGACY_ISSUE — 舊系統行為記錄如下，正確行為需要專案負責人決定後才實作]
1. 驗證 request body：要求完整報名資料欄位（class/quest/company/tel/num/contactList[] 等）
2. 若驗證失敗 → 回傳 400
3. 用 path parameter id 查詢 contact 資料列
4. 若找不到 → 回傳 404 + { message: "找不到資料" }
5. 若找到：嘗試更新 name 與 no 兩個欄位——但這兩個欄位不存在於步驟 1 的驗證規則、
   也不是 contact 表允許批量寫入的欄位，實務上兩者都寫不進去，只有 updated_at 時間戳會改變
6. 回傳 200 + { message: "更新成功", data: <幾乎沒有變化的 contact 資料> }

>>> 新專案實作前必須先確認：這支 API 真正應該更新哪些欄位？<<<
```

原始碼：`app/Http/Controllers/Contact/ContactController.php` (`update`)

## 12. `DELETE /api/v2/admin/contact`

```text
1. 驗證使用者已登入
2. 讀取 request body 的 ids 欄位
3. 若 ids 是陣列：
   a. 查詢這些 id 中，哪些在 contact 表真實存在
   b. 若有任何一個 id 不存在 → 回傳 404 + { message: "以下的 id 不存在: <清單>" }
      （這種情況下完全不執行刪除，即使部分 id 有效）
   c. 若全部存在 → 刪除這些 id 對應的 contact 資料列（硬刪除，不觸發任何關聯清理）
   d. 回傳 200 + { message: "刪除成功" }
4. 若 ids 是單一數值：
   a. 查詢該 id 是否存在
   b. 不存在 → 回傳 404 + { message: "找不到 id: <id>" }
   c. 存在 → 刪除該筆 contact 資料，回傳 200 + { message: "刪除成功" }

注意：刪除 contact 不會連帶刪除 contact_list 中 cid 指向它的資料列（現行資料庫沒有生效的外鍵），
新專案應保持這個現況（不要自行加上級聯刪除）。
```

原始碼：`app/Http/Controllers/Contact/ContactController.php` (`destroy`)

## 13. `GET /api/v2/admin/contact-list`

```text
1. 驗證使用者已登入
2. 查詢 contact_list 表全部資料（無過濾、無排序、無分頁）
3. 回傳 200 + { data: [...] }
```

原始碼：`app/Http/Controllers/Contact/ContactListController.php` (`index`)

## 14. `GET /api/v2/admin/contact-list/{id}`

```text
1. 驗證使用者已登入
2. 用 path parameter id 查詢 contact_list 資料列
3. 找不到 → 404 + { message: "找不到資料" }
4. 找到 → 200 + contact_list 全欄位
```

原始碼：`app/Http/Controllers/Contact/ContactListController.php` (`show`)

## 15. `GET /api/v2/admin/contact-class/{id}`

```text
1. 驗證使用者已登入
2. 用 path parameter id 查詢 contact_class 資料列，條件 del = 0
3. 找不到 → 404 + { message: "找不到資料" }
4. 找到 → 200 + contact_class 全欄位
```

原始碼：`app/Http/Controllers/Contact/ContactClassController.php` (`show`)

## 16. `POST /api/v2/admin/contact-class`

```text
1. 驗證使用者已登入
2. 驗證 request body：name（必填字串）、no（必填整數）
3. 驗證失敗 → 400
4. 建立 contact_class 資料列（name、no；del 使用資料庫預設值 0）
5. 回傳 201 + { message: "新增成功", data: <新建立的資料> }
```

原始碼：`app/Http/Controllers/Contact/ContactClassController.php` (`store`)

## 17. `PUT/PATCH /api/v2/admin/contact-class/{id}`

```text
1. 驗證使用者已登入
2. 驗證 request body：name（必填字串）、no（必填整數）
3. 用 path parameter id 查詢 contact_class 資料列，條件 del = 0
4. 找不到 → 404 + { message: "找不到資料" }
5. 找到 → 更新 name 與 no 兩個欄位
6. 回傳 200 + { message: "更新成功", data: <更新後的資料> }
```

原始碼：`app/Http/Controllers/Contact/ContactClassController.php` (`update`)

## 18. `DELETE /api/v2/admin/contact-class`

```text
1. 驗證使用者已登入
2. 讀取 request body 的 ids 欄位
3. 邏輯與第 12 節（DELETE contact）完全相同：
   - 陣列模式：任何一個 id 不存在就整批回 404，全部存在才刪除
   - 單值模式：不存在回 404，存在則刪除
4. 這裡是真的刪除整列（不是把 del 欄位設成 1），即使這張表本身也有 del 欄位
```

原始碼：`app/Http/Controllers/Contact/ContactClassController.php` (`destroy`)

## 19. `GET /api/v2/admin/contact/search/search-company`

```text
1. 驗證使用者已登入
2. 讀取 query parameter company（可為空字串）
3. 查詢 contact 表，條件 company LIKE '%<company>%'（參數化查詢）
4. 分頁，每頁 10 筆
5. 回傳 200 + 分頁 envelope
```

原始碼：`app/Http/Controllers/Contact/ContactController.php` (`searchCompany`)
