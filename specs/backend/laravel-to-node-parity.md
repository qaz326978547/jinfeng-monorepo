# Laravel → Node Backend Parity Analysis

> 分析日期：2026-08-25，第三階段更新：2026-08-26。比對範圍：`specs/backend/migration-history/`、
> `specs/shared/api-contracts/`（Laravel 舊系統規格）vs `backend/src/`、`backend/tests/`（Node 實作現況）vs
> `frontend/`（實際呼叫模式）。
>
> **這是分析文件，第三階段的程式碼變更記錄在下方「第三階段更新」段落。** 所有結論皆交叉比對至少 2 個來源
> （規格文件 + 原始碼），不單看 OpenAPI。

---

## 1. 整體完成百分比

**19 支 Laravel API 中，Node 後端目前 4 支完全 DONE + 1 支 API 行為 DONE（cache 待補）（合計 5/19 ≈ 26%）。**

| 狀態 | 數量 | 佔比 | 說明 |
|---|---|---|---|
| **DONE** | 4 | 21% | `POST /api/v2/auth/login`、`GET /api/v2/seo`、`GET /api/v2/contact-class`、`GET /api/v2/contact-quest` — 完整實作 + integration/unit test 全過 |
| **DONE(API)/PARTIAL(cache)** | 1 | 5% | `GET /api/v2/faq` — 查詢/排序/欄位投影與 Laravel 完全一致，**但 24 小時 cache 尚未實作**（見 §1.1），留有明確 TODO，**不算 production parity 完整完成** |
| **PARTIAL** | 2 | 11% | `POST /api/v2/auth/register`、`POST /api/v2/auth/logout` — 路由已掛載、Zod 驗證已定義,但 controller 直接 `throw NotImplementedError`（HTTP 501），無任何商業邏輯、無測試 |
| **NOT_IMPLEMENTED** | 12 | 63% | `contact`（POST）、全部 9 支 `admin/*` — **backend/src/routes 完全沒有掛載對應路由**，呼叫會落到 `notFoundHandler`(404) |
| **BEHAVIOR_MISMATCH** | 0 | — | 已實作的 5 支經 integration test 驗證，與規格一致，無 mismatch |
| **UNKNOWN** | 0 | — | 無 |

**結論：`backend/` 現在能正確服務 4 個前端頁面級功能（首頁 SEO meta、FAQ 頁、報名表單的課程分類/問題選項下拉選單），但報名表單「送出」本身（`POST /contact`）與整個後台管理仍未實作，還不能取代 Laravel 後端。**

OpenAPI 契約層(`specs/shared/api-contracts/openapi.yaml`)已完整定義全部 19 個 operation(15 個 path），品質良好、可直接作為實作依據 —— 已實作的 5 支皆通過 `npm run openapi:validate`。

### 1.1 第三階段更新（2026-08-26）—— 第一批 Public Read API

新增/修改檔案：

- `backend/src/shared/http/laravel-pagination.ts`（新增）—— 重建 Laravel `paginate(10)` JSON envelope 的共用工具
- `backend/src/modules/seo/`（新增）—— `seo.repository.ts` / `.service.ts` / `.controller.ts` / `.routes.ts`
- `backend/src/modules/faq/`（新增）—— 同上 4 層結構，service 內留 `TODO(parity)` cache 註記
- `backend/src/modules/contact-class/`（新增）—— 同上 4 層結構
- `backend/src/modules/contact-quest/`（新增）—— 多一個 `contact-quest.schemas.ts`（`?page=` 驗證）
- `backend/src/routes/index.ts`（修改）—— 掛載上述 4 個 router 到 `/api/v2/{seo,faq,contact-class,contact-quest}`
- `backend/src/middleware/validate-request.ts`（修改）—— **修正一個現有 bug**，見下方「意外發現」

**意外發現並修正的既有 bug**：`validate-request.ts` 原本用 `Object.assign(req.query, schemas.query.parse(req.query))` 寫回驗證結果，但 **Express 5 的 `req.query` 是一個每次存取都重新解析 URL 的 getter，不是快取值**，對它回傳的物件做 `Object.assign` 會在下一次讀取時整個消失。這條路徑在這次之前完全沒有路由使用過 `query` schema（auth 模組只用 `body`），所以這個 bug 從未被實際觸發或測到過。本階段實作 `contact-quest` 的 `?page=` 驗證時首次踩到，已改用 `Object.defineProperty(req, 'query', {value: parsed, ...})` 覆蓋整個 getter 修正，並在 `tests/integration/validate-request.test.ts` 補上一個回歸測試。**這是這次任務範圍內、為了讓 `contact-quest` 正確運作而必要的最小修正，不是無關的程式碼改動。**

**`links` 欄位的簡化說明**：`contact-quest` 分頁 envelope 的 `links` 陣列採用 Laravel 預設分頁器在頁數較少時（<12 頁）的「small slider」演算法（列出全部頁碼，無省略號）—— 這是這個 app 實際資料量（課程分類/問題選項這類人工維護的小清單）永遠會落入的情況。**雙位數頁碼時 Laravel 會切換成帶省略號（`...`）的 windowed 演算法，這個階段沒有重建**，因為 (a) 前端只讀取 `.data`，完全不使用 `links`，(b) 現有規格文件的 `links` 範例本身是截斷的，沒有完整資料可以逐位元核對，重建會變成「猜」而非「依規格實作」。已在 `laravel-pagination.ts` 的註解中明確記錄這個已知限制。

---

## 2. API Parity Matrix

### 2.1 總覽表

| # | Method | Path | 狀態 | Node route 是否存在 | Frontend 使用中 | Test 存在 | OpenAPI 已定義 |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/v2/seo` | **DONE** | ✅ | ✅ 是(每頁載入都呼叫) | ✅ 5 tests | ✅ |
| 2 | GET | `/api/v2/contact-class` | **DONE** | ✅ | ✅ 是 | ✅ 5 tests | ✅ |
| 3 | GET | `/api/v2/contact-quest` | **DONE** | ✅ | ✅ 是 | ✅ 9 tests | ✅ |
| 4 | POST | `/api/v2/contact` | NOT_IMPLEMENTED | ❌ | ✅ 是(核心轉換流程) | ❌ | ✅ |
| 5 | GET | `/api/v2/faq` | **DONE(API)/PARTIAL(cache)** | ✅ | ✅ 是 | ✅ 4 tests | ✅ |
| 6 | POST | `/api/v2/auth/login` | **DONE** | ✅ | ✅ 是 | ✅ 18 tests | ✅ |
| 7 | POST | `/api/v2/auth/register` | PARTIAL(501 stub) | ✅(stub) | ⚠️ 前端有呼叫但**未接 UI**(見 4.2) | ❌ | ✅ |
| 8 | POST | `/api/v2/auth/logout` | PARTIAL(501 stub) | ✅(stub) | ❌ 前端完全沒有登出功能 | ❌ | ✅ |
| 9 | GET | `/api/v2/admin/contact` | NOT_IMPLEMENTED | ❌ | ✅ 是 | ❌ | ✅ |
| 10 | GET | `/api/v2/admin/contact/{id}` | NOT_IMPLEMENTED | ❌ | ✅ 是 | ❌ | ✅ |
| 11 | PUT/PATCH | `/api/v2/admin/contact/{id}` | NOT_IMPLEMENTED + **KNOWN_LEGACY_ISSUE** | ❌ | ⚠️ 是,但前端呼叫**沒帶 `{id}`**(見 5.1) | ❌ | ✅ |
| 12 | DELETE | `/api/v2/admin/contact` | NOT_IMPLEMENTED | ❌ | ✅ 是 | ❌ | ✅ |
| 13 | GET | `/api/v2/admin/contact-list` | NOT_IMPLEMENTED | ❌ | ❌ 前端未呼叫(只有註解) | ❌ | ✅ |
| 14 | GET | `/api/v2/admin/contact-list/{id}` | NOT_IMPLEMENTED | ❌ | ❌ 前端未呼叫(只有註解) | ❌ | ✅ |
| 15 | GET | `/api/v2/admin/contact-class/{id}` | NOT_IMPLEMENTED | ❌ | ✅ 是 | ❌ | ✅ |
| 16 | POST | `/api/v2/admin/contact-class` | NOT_IMPLEMENTED | ❌ | ✅ 是 | ❌ | ✅ |
| 17 | PUT/PATCH | `/api/v2/admin/contact-class/{id}` | NOT_IMPLEMENTED | ❌ | ✅ 是 | ❌ | ✅ |
| 18 | DELETE | `/api/v2/admin/contact-class` | NOT_IMPLEMENTED | ❌ | ✅ 是 | ❌ | ✅ |
| 19 | GET | `/api/v2/admin/contact/search/search-company` | NOT_IMPLEMENTED | ❌ | ✅ 是 | ❌ | ✅ |

### 2.2 逐端點詳細比對

以下只列出「舊 Laravel controller/action」「目前 Node route/controller/service」「request validation」「認證/授權需求」「database query」「response schema/HTTP status」「cache/mail/queue」「side effects」8 個未在總覽表出現的欄位。

#### #1 `GET /api/v2/seo` — **DONE**
- Laravel：`app/Http/Controllers/SeoController.php`
- Node：`src/modules/seo/seo.routes.ts` → `seo.controller.ts::createListSeoHandler` → `seo.service.ts::SeoService.listAll` → `seo.repository.ts::SeoRepository.findAll`
- Request validation：不適用(無 body)
- Auth/Authz：不需要
- DB query：`SELECT * FROM seo`（無過濾、無排序 —— `del` 未過濾維持原樣,未修正已知疑點）
- Response schema/status：`200` + JSON array，`seo` 表全欄位，與 `frontend/api/interface/seo.ts` 的 `SeoData` 逐欄位一致
- Cache/Mail/Queue：無
- Side effects：無
- **Test**：`tests/integration/seo.test.ts`(5)

#### #2 `GET /api/v2/contact-class` — **DONE**
- Laravel：`ContactClassController.php`
- Node：`src/modules/contact-class/`(routes → controller → service → repository，4 層結構同 auth 模組)
- DB query：`SELECT * FROM contact_class WHERE del = 0 ORDER BY no DESC`
- Response：`200` + JSON array（不分頁），與 `frontend/api/interface/signedUpClass.ts` 的 `ContactClass[]` 一致
- Cache/Mail/Queue：無
- **Test**：`tests/integration/contact-class.test.ts`(5)

#### #3 `GET /api/v2/contact-quest` — **DONE**
- Laravel：`ContactQuestController.php`
- Node：`src/modules/contact-quest/`（多一個 `contact-quest.schemas.ts` 驗證 `?page=`）
- DB query：`SELECT COUNT(*) ... WHERE del=0` + `SELECT * FROM contact_quest WHERE del = 0 ORDER BY no DESC LIMIT ? OFFSET ?`
- Response：`200` + 完整 Laravel 分頁 envelope（`current_page`/`data`/`first_page_url`/`from`/`last_page`/`last_page_url`/`links`/`next_page_url`/`path`/`per_page`/`prev_page_url`/`to`/`total`）—— 由新建的共用工具 `src/shared/http/laravel-pagination.ts` 產生，欄位集合對齊 `openapi.yaml` 的 `PaginatedResponse` schema
- `links` 演算法簡化說明見 §1.1
- `?page=` 缺省/非數字時 fallback 為 1（比照 Laravel `Paginator::resolveCurrentPage()`，不是驗證錯誤）
- Cache/Mail/Queue：無
- **Test**：`tests/integration/contact-quest.test.ts`(9) + `tests/unit/laravel-pagination.test.ts`(5)

#### #4 `POST /api/v2/contact`
- Laravel：`ContactController.php` (`store`) + `CreateContactRequest.php`
- Node：**無**
- Request validation（需重建）：`class`/`quest`/`company`/`tel`(≤10)/`num` 必填；`contactList[]` 陣列，每項需 `name`/`email`(格式)/`cel`(≤10) 必填、`job` 選填
- Auth：不需要
- DB query：insert `contact` 1 筆 + insert `contact_list` N 筆（**目前沒有 transaction**，見 5.2）
- Response：成功 `201` `{message, data}`；驗證失敗 `400` `{status:"error", message}`
- Cache：無
- **Mail：需要**——寄送通知信到硬編碼 `a0930532215@gmail.com`（見 §6 Mail 段落）
- **Queue：需要**——舊系統用非同步 queue 寄信（見 §6 Queue 段落）
- Side effects：寄信

#### #5 `GET /api/v2/faq` — **DONE(API)/PARTIAL(cache)**
- Laravel：`FAQController.php`
- Node：`src/modules/faq/`(4 層結構)
- DB query：`SELECT id, name, info, no FROM faq ORDER BY no DESC`（不過濾 `del`，維持原樣）
- Response：`200` + JSON array（只 4 欄位投影），與 `frontend/api/interface/signedUpClass.ts` 的 `FAQData[]` 一致
- **Cache：仍未實作**——`faq.service.ts` 內留有 `TODO(parity): restore FAQ 24-hour cache before production cutover.` 註記；每次呼叫都直接打 DB，功能正確但非功能面(效能/production parity)尚未完成
- Mail/Queue：無
- **Test**：`tests/integration/faq.test.ts`(4)

#### #6 `POST /api/v2/auth/login` — **DONE**
- Laravel：`AuthController.php` (`login`)
- Node：`src/modules/auth/auth.routes.ts` → `auth.controller.ts::createLoginHandler` → `auth.service.ts::AuthService.login` → `user.repository.ts::UserRepository.findByEmail`
- Request validation：`loginRequestSchema`（Zod，`email`/`password` 必填,`legacyErrorFormat: true` 讓錯誤格式對齊 Laravel 422）
- Auth：不需要（登入本身）
- DB query：`SELECT id,email,password,is_admin FROM users WHERE email=? LIMIT 1`
- Response：成功 `200 {token}`；失敗 `401 {message:"帳號或密碼錯誤"}`（帳號不存在與密碼錯誤統一訊息，與規格一致）
- 密碼比對：bcrypt，且**額外加了 hash 格式完整性檢查**(`isSupportedBcryptHash`)，比 Laravel 舊行為更嚴謹
- Token：JWT（`sub`/`email`/`isAdmin`），符合 AUTH_REIMPLEMENTATION_REQUIRED 的設計自由度
- Cache/Mail/Queue：無
- **Test 覆蓋**：`tests/integration/auth-login.test.ts`(13)、`tests/unit/auth.service.test.ts`(5)

#### #7 `POST /api/v2/auth/register` — PARTIAL
- Laravel：`AuthController.php` (`register`) + `CreateUser.php`
- Node route：**已掛載**(`router.post('/register', validateRequest({body: registerRequestSchema}), register)`)
- Node controller：`auth.controller.ts::register` → **`throw new NotImplementedError(...)` → HTTP 501**，沒有任何 DB 寫入邏輯
- Request validation：`registerRequestSchema` 已定義(Zod)，欄位與規格一致(`name`/`email`/`password`≥6/`password_confirmation`/`is_admin`)，**但目前驗證通過後直接 501，驗證本身沒有實質意義**
- `BCRYPT_SALT_ROUNDS` 環境變數已在 `src/config/env.ts` 定義，但**目前整個 `src/` 沒有任何地方讀取它**（因為 register 尚未實作雜湊邏輯）
- DB query：規格要求 insert `users`，Node 尚未實作
- Cache/Mail/Queue：無

#### #8 `POST /api/v2/auth/logout` — PARTIAL
- Laravel：`AuthController.php` (`logout`)——**KNOWN_LEGACY_ISSUE**：舊系統沒有中介層保護,未帶 token 會 500
- Node route：**已掛載且已用 `authenticate(jwtSecret)` 中介層保護**（`router.post('/logout', authenticate(deps.jwtSecret), logout)`）—— **這點已經修正了舊系統的已知問題**(未帶 token 會正確回 401，不會 500)
- Node controller：`logout` → `throw new NotImplementedError(...)` → HTTP 501，沒有任何 token 失效邏輯
- Cache/Mail/Queue：無

#### #9 `GET /api/v2/admin/contact`
- Laravel：`ContactController.php` (`index`)
- Node：**無**
- Auth：需要（規格：任何已登入使用者，無角色檢查——見 known-legacy-issues #2）
- DB query：`SELECT * FROM contact ORDER BY created_at DESC`，`paginate(10)`
- Response：`200` + 分頁 envelope

#### #10 `GET /api/v2/admin/contact/{id}`
- Laravel：`ContactController.php` (`show`)
- Node：**無**
- DB query：`SELECT * FROM contact WHERE id=?` + `SELECT * FROM contact_list WHERE cid=?`（巢狀組裝）
- Response：`200 {...contact, contactList:[...]}`；找不到 `404 {message}`

#### #11 `PUT/PATCH /api/v2/admin/contact/{id}` — **KNOWN_LEGACY_ISSUE，需先決策**
- Laravel：`ContactController.php` (`update`)——驗證規則要求完整報名資料，但實際只嘗試寫入不存在的 `name`/`no` 欄位，**生產環境等同無效更新**
- Node：**無**
- **這支在被排入實作前，必須先由需求方決定「這支 API 到底該更新什麼欄位」**（見 known-legacy-issues.md #1），照抄舊行為（做一個生產環境已知無效的 API）意義不大，但擅自改行為又可能破壞前端既有期待——見 §9 建議實作順序

#### #12 `DELETE /api/v2/admin/contact`
- Laravel：`ContactController.php` (`destroy`)
- Node：**無**
- Request body：`{ids: number | number[]}`（無固定 schema，需依陣列/單值分流驗證）
- DB query：批次模式先查全部 id 是否存在，任何一個不存在則整批 404 不刪除；單值模式各自處理
- **特殊規則**：**不可**自行加上級聯刪除 `contact_list`（見已知問題 #9，正式資料庫本就沒有生效外鍵）

#### #13 `GET /api/v2/admin/contact-list`
- Laravel：`ContactListController.php` (`index`)
- Node：**無**
- DB query：`SELECT * FROM contact_list`（無過濾無分頁）
- Response：`200 {data:[...]}`
- **前端目前未呼叫**——`api/signedUpClass.ts` 底部只有註解列出這個路徑，沒有實際 export 的函式呼叫它

#### #14 `GET /api/v2/admin/contact-list/{id}`
- 同上，Laravel：`ContactListController.php` (`show`)，Node：**無**，**前端未呼叫**

#### #15 `GET /api/v2/admin/contact-class/{id}`
- Laravel：`ContactClassController.php` (`show`)
- Node：**無**
- DB query：`SELECT * FROM contact_class WHERE id=? AND del=0`
- Response：`200` 全欄位；`404 {message}`

#### #16 `POST /api/v2/admin/contact-class`
- Laravel：`ContactClassController.php` (`store`)
- Node：**無**
- Request validation：`name`(string, required)、`no`(integer, required)
- Response：`201 {message, data}`；驗證失敗 `400`

#### #17 `PUT/PATCH /api/v2/admin/contact-class/{id}`
- Laravel：`ContactClassController.php` (`update`)——**這支驗證欄位與實際寫入欄位一致，無疑點**（與 #11 相反）
- Node：**無**
- DB query：`UPDATE contact_class SET name=?, no=? WHERE id=? AND del=0`

#### #18 `DELETE /api/v2/admin/contact-class`
- Laravel：`ContactClassController.php` (`destroy`)——**真正硬刪除整列**（即使該表也有 `del` 欄位，語意不一致，見已知問題 #10）
- Node：**無**

#### #19 `GET /api/v2/admin/contact/search/search-company`
- Laravel：`ContactController.php` (`searchCompany`)
- Node：**無**
- DB query：`SELECT * FROM contact WHERE company LIKE '%<keyword>%'`（參數化），`paginate(10)`

---

## 3. 功能 Parity Matrix

| 功能領域 | 項目 | Laravel 行為 | Node 現況 | 狀態 |
|---|---|---|---|---|
| **Auth** | register | bcrypt 雜湊 + insert `users` | 501 stub，無邏輯 | NOT_IMPLEMENTED |
| | login | Passport token | ✅ JWT，帳密驗證邏輯一致 | **DONE** |
| | logout | 無中介層保護(500 bug) | 已掛 `authenticate` 中介層(修正)，但 501 stub 無失效邏輯 | PARTIAL |
| | Passport → JWT | oauth_access_tokens 表 | JWT，無狀態、免資料庫 token 儲存 | 設計已確定，符合 AUTH_REIMPLEMENTATION_REQUIRED |
| | password hash compatibility | bcrypt | ✅ `AuthService` 用 `bcryptjs` 比對現有 bcrypt hash,格式驗證更嚴謹 | DONE(僅登入路徑) |
| | token invalidation | 無(Passport revoke 未使用) | 未實作(logout 是 stub) | NOT_IMPLEMENTED |
| | auth middleware | 無 route 保護(part of legacy issue) | ✅ `authenticate.ts` 已實作,JWT 驗證完整 | DONE(元件本身),但只掛在 logout |
| | admin authorization | **完全沒有 is_admin 檢查** | `requireAdmin` middleware 已寫好但**未掛在任何路由**(因為 admin/* 都還沒實作) | 待決策(見 known-legacy-issues #2)+待實作 |
| **Contact** | create | insert + 無 transaction | 未實作 | NOT_IMPLEMENTED |
| | ContactList nested create | 逐筆 insert,略過無 email 項目 | 未實作 | NOT_IMPLEMENTED |
| | company search | LIKE 模糊搜尋 | 未實作 | NOT_IMPLEMENTED |
| | admin Contact endpoints | 5 支(index/show/update/delete/search) | 全部未實作 | NOT_IMPLEMENTED |
| | mail notification | 硬編碼收件人,非同步 queue | 未實作,**Node 無任何 mail 套件** | NOT_IMPLEMENTED |
| | transaction behavior | **無 transaction**(已知問題) | 未實作;`backend/src/infrastructure/database/transaction.ts` 已存在通用 transaction 工具,可直接用於新實作 | 基礎設施已就緒,業務邏輯未寫 |
| **ContactClass** | CRUD | 5 支 | 僅 `index`(公開讀取)已實作,其餘 4 支(admin CRUD)未實作 | index: **DONE**;其餘 NOT_IMPLEMENTED |
| | soft delete / del flag | 讀取端點過濾 `del=0` | ✅ `index` 已過濾 `del=0`,與規格一致 | DONE(僅 index) |
| | bulk delete | 硬刪除,批次模式 | 未實作 | NOT_IMPLEMENTED |
| **ContactList** | index/show | 2 支,無過濾 | 未實作 | NOT_IMPLEMENTED |
| **ContactQuest** | index | 分頁,`del=0` 過濾 | ✅ 已實作,`del=0` 過濾 + 完整 Laravel 分頁 envelope | **DONE** |
| **FAQ** | index | 4 欄位投影,24hr cache | ✅ 查詢/投影/排序已實作;❌ cache 未實作 | **DONE(API)/PARTIAL(cache)** |
| | 24hr cache | file/array cache,無失效機制 | **Node 無任何 cache 套件依賴**,`faq.service.ts` 留有 TODO | NOT_IMPLEMENTED(基礎設施都沒有) |
| **SEO** | GET data | 無過濾,無分頁 | ✅ 已實作,`SELECT * FROM seo`,`del` 未過濾維持原樣 | **DONE** |
| **Mail** | SignedUpMail 等效物 | Laravel Mail + queue | **`backend/package.json` 沒有任何 mail 套件**(無 nodemailer 等) | NOT_IMPLEMENTED(連依賴都沒裝) |
| | template parity | Laravel Blade mail template | 不存在 | NOT_IMPLEMENTED |
| | recipient behavior | 硬編碼 email | 不適用(尚未實作) | NOT_IMPLEMENTED |
| **Queue** | 舊 Laravel queue | database driver,`jobs` 表 | Node 未實作任何 queue 機制,**無 BullMQ/Redis 等套件依賴** | **明確標示：完全未實作** |
| **Cache** | FAQ cache | Laravel cache facade(driver 未知,見 known-legacy-issues #12 提及 Redis/file 皆有可能) | **Node 無任何 cache 套件依賴**(無 ioredis/node-cache) | **明確標示：完全未實作** |
| | Redis/file cache 差異 | 未確認(`.env` 實際值未知) | 不適用 | UNCONFIRMED(舊系統本身) |
| **CORS** | 舊 production origins | 未在規格文件中記錄(Laravel CORS 設定未擷取) | `backend/.env.example` 的 `CORS_ALLOWED_ORIGINS` **預設為空字串**（`env.ts` default `''`）——目前若不設定,**沒有任何跨來源瀏覽器請求會被允許** | 待設定，非程式碼問題 |
| | Node CORS config | — | `src/config/cors.ts` 邏輯完整(allowlist + credentials)，機制已就緒 | 機制 DONE,**環境變數尚未設定正式 origin**(`https://laborservice5690.com` 等) |
| | frontend origin compatibility | — | 前端用 `axios` + `withCredentials:true`,需要後端 `credentials:true`(已符合)+ 正確 origin allowlist | 待設定驗證 |
| **Database** | schema parity | 25 張表 | `backend/migrations/`(5 個 SQL 檔)已建立全部 25 張表結構,與 `specs/backend/migration-history/database-schema.md` 一致 | **DONE**(schema 層) |
| | migration parity | — | `backend/scripts/migrate.ts` + `node_schema_migrations` 追蹤表,可重複執行 | DONE |
| | timestamps | 多數表有 created_at/updated_at | schema 已保留,一致 | DONE |
| | soft delete/del semantics | 多表用 `del` tinyint 手動旗標,語意不一致(部分硬刪除) | schema 已保留 `del` 欄位,但**應用層邏輯尚未實作**,無從驗證是否照規格處理 | 待業務邏輯驗證 |
| | nullability | 見 database-schema.md 逐欄位 | schema 已 1:1 保留 | DONE |
| | transaction usage | `POST /contact` 無 transaction(已知問題) | `transaction.ts` 工具已就緒,尚未用於任何業務邏輯 | 待實作時決定是否修正(建議修正,見已知問題 #8) |

---

## 4. Frontend Dependency Mapping

### 4.1 完整對照表

| Frontend caller | Endpoint | Backend 實作 | Parity 狀態 |
|---|---|---|---|
| `layouts/default.vue`(`useFetch`) | `GET /seo` | ✅ 已實作 | ✅ 可用 |
| `components/FaqComponent.vue`(`useFetch`) | `GET /faq` | ✅ 已實作(cache 待補) | ✅ 可用 |
| `SignUpClassForm.vue` → `getContactClass` | `GET /contact-class` | ✅ 已實作 | ✅ 可用 |
| `SignUpClassForm.vue` | `GET /contact-quest` | ✅ 已實作(含完整分頁 envelope) | ✅ 可用 |
| `SignUpClassForm.vue` → `addContactInfo` | `POST /contact` | 無 | ❌ 阻斷(核心報名轉換流程) |
| `pages/auth.vue` → `AuthApi.login` | `POST /auth/login` | ✅ 已實作 | ✅ 可用 |
| `api/auth.ts` → `AuthApi.register`(**未被任何頁面呼叫**) | `POST /auth/register` | 501 stub | 目前無影響(UI 沒有註冊頁面/表單) |
| (無呼叫) | `POST /auth/logout` | 501 stub(但已受保護) | 目前無影響(前端完全沒有登出功能) |
| `pages/admin/contact/index.vue` 等 → `getContact` | `GET /admin/contact` | 無 | ❌ 阻斷 |
| `pages/admin/contact/[id].vue` → `getSingleContact` | `GET /admin/contact/{id}` | 無 | ❌ 阻斷 |
| `updateContactInfo` | `PUT /admin/contact`（**缺少 `{id}`**） | 無 | ❌ 阻斷 + **request/response 格式不一致**(見 5.1) |
| `deleteContactInfo` | `DELETE /admin/contact` | 無 | ❌ 阻斷 |
| `searchContactInfo` | `GET /admin/contact/search/search-company` | 無 | ❌ 阻斷 |
| `getSingleContactClass` | `GET /admin/contact-class/{id}` | 無 | ❌ 阻斷 |
| `addContactClass` | `POST /admin/contact-class` | 無 | ❌ 阻斷 |
| `UpdateContactClass` | `PUT /admin/contact-class/{id}` | 無 | ❌ 阻斷(此呼叫格式正確) |
| `deleteSingleContactClass` | `DELETE /admin/contact-class` | 無 | ❌ 阻斷 |
| `FAQInfoApi.getContact`(**未被任何頁面呼叫**) | `GET /admin/faq`（**此路徑不存在於 19 支規格中**） | 無 | 死碼,非缺口(見 5.3) |
| (無呼叫) | `GET /admin/contact-list` | 無 | 前端未使用,非阻斷 |
| (無呼叫) | `GET /admin/contact-list/{id}` | 無 | 前端未使用,非阻斷 |

### 4.2 Frontend 使用中但 Backend 尚未實作的 endpoint

第三階段實作後，**11 / 19 支**前端有實際呼叫的端點仍缺 backend 實作(原本 15 支，`seo`/`faq`/`contact-class`/`contact-quest` 這 4 支已於本階段補上)。剩餘缺口全部集中在：**報名表單「送出」本身(`POST /contact`)**與**整個後台管理(`admin/*`)**——首頁 SEO meta、FAQ 頁、報名表單的下拉選單資料現在都能正確載入，但使用者還無法真正送出報名表單，後台也完全無法使用。

### 4.3 Request/Response 格式不一致

- **`PUT /admin/contact` 缺少 `{id}` path 參數**（`api/signedUpClass.ts:55`）—— 與 OpenAPI 契約(`/admin/contact/{id}`)不符,即使 backend 之後補上這支 API,**前端這處呼叫本身也需要修正**才能正確運作(這是既有前端 bug,不是 backend 缺口)
- **`AuthApi.register` 沒有把 `data` 傳給 `$http`**（`api/auth.ts:31`：`$http<any>('post', '/auth/register')`，漏了第三個參數）—— 目前無影響是因為完全沒有 UI 呼叫它,但若未來要接上註冊表單,這個呼叫本身需要先修正
- `FAQInfoApi.getContact` 呼叫 `/admin/faq`，這個路徑不存在於任何規格文件——**死碼，建議之後清理或確認是否為誤植**

### 4.4 Authentication header 差異

前端 `utils/http.ts` 固定帶 `Authorization: 'Bearer ' + token.value || ''`——注意這是**在 axios instance 建立時算一次**（模組載入時的 `token.value`），不是每次請求動態讀取，若使用者登入後 token 改變，既有的 `ajax` instance 標頭不會自動更新(除非重新整理頁面觸發模組重新初始化)。這是前端既有的架構限制,與 backend 是否實作無關,但會影響「登入後直接呼叫需要授權的 API」這個使用者流程的實測結果，值得在功能測試階段留意。

### 4.5 Status code 差異

尚無法比對——backend 對應端點都還沒實作。已實作的 `login` 401/200 與規格一致。

### 4.6 第三階段新增 4 支端點的 frontend 相容性檢查結果

靜態比對 `frontend/layouts/default.vue`、`frontend/components/FaqComponent.vue`、
`frontend/components/SignUpClassForm.vue`、`frontend/api/interface/seo.ts`、
`frontend/api/interface/signedUpClass.ts` 的呼叫方式與型別定義，與本階段的 4 支 Node 實作逐欄位比對：

- **endpoint path**：`/seo`、`/faq`、`/contact-class`、`/contact-quest` 四支皆一致
- **response shape**：`SeoData[]`、`FAQData[]`、`ContactClass[]` 與 Node 回傳欄位逐一比對，**完全一致**
- **pagination shape**：`contact-quest` 前端型別 `ContactClassData` 期待 `current_page`/`data`/`first_page_url`/`from`/`last_page`/`last_page_url`/`next_page_url`/`path`/`per_page`/`prev_page_url`/`to`/`total`，Node 回傳的 envelope 全部欄位都有(額外多出前端型別沒宣告的 `links`，但前端只讀取 `.data`，多出的欄位不影響執行)
- **frontend 不需要同步修改**：確認無誤，**未發現任何 mismatch**，這 4 支的前端呼叫可以直接對接本階段實作，不需修改 `frontend/`

---

## 5. Behavior Mismatch

目前已實作的 5 支端點,行為與規格比對結果：**無 mismatch**。

- `login`：bcrypt 比對邏輯、錯誤訊息、狀態碼皆與 `api-specification.md` #6 一致，且额外加了 hash 格式完整性檢查,屬於安全性強化而非行為偏離
- `seo`：`SELECT * FROM seo` 無過濾無排序，`del` 未過濾維持原樣，與規格一致
- `contact-class`：`del=0` 過濾 + `no DESC` 排序，與規格一致
- `contact-quest`：`del=0` 過濾 + `no DESC` 排序 + `paginate(10)` envelope，與規格一致；`links` 的省略號演算法未重建(見 §1.1)，屬於已揭露的簡化，不是未揭露的 mismatch
- `faq`：4 欄位投影 + `no DESC` 排序，`del` 未過濾維持原樣，與規格一致；**24 小時 cache 未實作是已知、已標示的差距，不是行為 mismatch**(功能輸出正確，只是每次都重新查詢)

其餘 14 支尚未實作,無行為可比對。**唯一已知會在實作時產生 mismatch 風險的是 #11 `PUT /admin/contact/{id}`**——因為舊行為本身就是「看似更新、實際無效」，新專案不應該原樣照抄一個已知無效的實作，但改變行為又是對現有系統的偏離，需要產品/需求方決策後才能定義「正確」行為與「mismatch」的基準。

---

## 6. Security Differences

| 項目 | Laravel 舊系統 | Node 現況 | 差異 |
|---|---|---|---|
| Admin 授權 | 只檢查登入,無 `is_admin` 檢查(已知問題 #2) | `requireAdmin` middleware 已寫好但未掛用(因為 admin/* 都沒實作) | 待決策：實作 admin/* 時要沿用舊行為還是修正為真正檢查 `is_admin` |
| Logout 保護 | 無中介層,未帶 token 會 500(已知問題 #3) | **已修正**——`authenticate` 中介層已掛在 logout 路由,未帶 token 正確回 401 | Node 已是改善版行為,無需額外處理 |
| 密碼雜湊 | bcrypt | bcrypt(`bcryptjs`),且比對前多一層 hash 格式驗證 | Node 更嚴謹 |
| JWT secret 管理 | Passport 用 OAuth client secret(資料庫存) | `.env` 的 `JWT_SECRET`,Zod 強制 ≥16 字元 | 設計改善,但**部署時必須確保 production `JWT_SECRET` 是高強度隨機值，不能沿用 `.env.example` 的 placeholder** |
| CORS | 未知(規格文件未記錄舊 Laravel CORS 設定) | 預設 `CORS_ALLOWED_ORIGINS=''`(全擋)，機制良好但**尚未設定正式 origin** | 上線前必須設定,否則前端會被 CORS 擋下 |
| Email 收件人 | 硬編碼在程式碼 | 尚未實作;若比照舊行為建議改用環境變數(known-legacy-issues #11 已建議) | 待實作時決定 |
| SQL Injection | Laravel 參數化查詢(已確認安全) | Node 用 `mysql2` 已實作部分皆用參數化查詢(`?` placeholder) | 一致,無新增風險 |
| Helmet / HTTP headers | 前端 `server/middleware/helmet.ts` 有掛;Laravel 端未知 | ✅ `backend/src/app.ts` 已掛 `helmet()` | Node 端已具備 |

---

## 7. Test Coverage Gaps

| 測試類型 | 現況 |
|---|---|
| Unit tests | `auth.service.test.ts`(5)、`legacy-validation-error.test.ts`(2)、`laravel-pagination.test.ts`(5，新增) |
| Integration tests | `auth-login.test.ts`(13)、`seo.test.ts`(5，新增)、`faq.test.ts`(4，新增)、`contact-class.test.ts`(5，新增)、`contact-quest.test.ts`(9，新增)+ 基礎設施類測試(`env`/`error-handler`/`graceful-shutdown`/`health`/`not-found`/`ready`/`validate-request`，共 14 支，`validate-request` 新增 1 支 Express 5 query getter 回歸測試) |
| **完全缺少測試的 API** | **14 / 19 支**（`contact` POST + 全部 9 支 `admin/*` + `register`/`logout` 兩支 stub，原本 18 支，本階段減少 4 支） |
| Migration parity tests | 無——`backend/scripts/verify-schema.ts` 存在但只驗證 schema 結構,不是「舊資料庫資料 vs 新程式行為」的 parity test |
| Frontend/backend contract tests | 無——目前沒有任何跨 repo 的 contract test(例如用 `openapi.yaml` 對前端呼叫做 schema 驗證) |

**建議**：對 §8 建議實作順序中列出的每一支 migration-critical endpoint,至少建立 1 支 integration test（比照 `auth-login.test.ts`/本階段 4 支新測試的模式：`tests/helpers/build-test-app.ts` 已提供可重用的測試 app 建構工具,可直接沿用）。

---

## 8. 建議實作順序

依「前端阻斷程度」與「風險」排序：

1. ~~**`GET /api/v2/seo`**~~ —— **已於第三階段完成**
2. ~~**`GET /api/v2/faq`**~~ —— **已於第三階段完成**(API 行為),cache 仍待補
3. ~~**`GET /api/v2/contact-class`** + **`GET /api/v2/contact-quest`**~~ —— **已於第三階段完成**
4. **`POST /api/v2/contact`** —— **下一批建議項目**。核心轉換流程,依賴 `contact` + `contact_list` 兩表,建議直接補上 transaction(修正已知問題 #8,不影響成功路徑行為)；**Mail/Queue 依賴需要先決定技術方案**(是否要 nodemailer + BullMQ,或先用同步寄信简化,見下方「待決策」)
5. **`POST /api/v2/auth/register`** —— 路由與驗證已存在,只差 controller 的 bcrypt + insert 邏輯,補完即可
6. **`POST /api/v2/auth/logout`** —— 同上,路由與保護已存在,只差 token 失效邏輯(JWT 是無狀態的,若要做到真正「失效」需要額外的 blocklist 機制,需先決定要不要做,或先做成「僅前端清除 token」的簡化版)
7. **`GET/DELETE /api/v2/admin/contact`** + **`GET /api/v2/admin/contact/{id}`** + **`GET /api/v2/admin/contact/search/search-company`** —— 後台核心讀取/刪除功能,先做這些(邏輯明確、無疑點)
8. **`admin/contact-class` 全部 4 支** —— 邏輯明確,可與上一批一起做
9. **`PUT /api/v2/admin/contact/{id}`** —— **排在最後**，因為必須先等需求方針對 known-legacy-issues.md #1 做出決策,且前端呼叫本身也有 bug(缺少 `{id}`)需要同步修正
10. **`admin/contact-list` 2 支** —— 前端目前未使用,優先度最低,可視情況併入 API 完整度需求再做

**跨端點的前置決策(需求方決定,非技術問題)**：
- known-legacy-issues #1（`PUT /admin/contact/{id}` 真正該更新什麼）
- known-legacy-issues #2（admin/* 是否要補上真正的 `is_admin` 檢查——這是行為變更）
- known-legacy-issues #6（`seo`/`faq` 的 `del` 未過濾是否為疏漏）
- known-legacy-issues #10（`contact-class` 硬刪除 vs `del` 軟刪除語意是否統一）
- Mail/Queue 技術選型（沿用「同步寄信」簡化版，或導入 BullMQ+Redis 等效物）

---

## 9. Production Cutover Criteria

**以下條件必須全部滿足，才可以考慮以 Node backend 取代 Laravel：**

| # | 條件 | 目前狀態 |
|---|---|---|
| 1 | frontend 使用中的 API 全部 DONE | ⚠️ 進行中：11/19 前端使用中的端點仍是 NOT_IMPLEMENTED(原 15，本階段完成 4 支) |
| 2 | auth flow 完整(login/register/logout 皆可用) | ❌ 僅 login DONE,register/logout 為 501 stub |
| 3 | admin authorization 確認 | ❌ 待需求方決策(known-legacy-issues #2)+ 待實作 |
| 4 | database schema compatible | ✅ 已完成(`backend/migrations/` 與 database-schema.md 一致) |
| 5 | mail confirmed | ❌ 未實作,連套件依賴都沒有 |
| 6 | queue confirmed | ❌ 未實作,連套件依賴都沒有 |
| 7 | cache confirmed | ❌ FAQ 24hr cache 仍未實作(API 行為本身已 DONE) |
| 8 | CORS confirmed | ⚠️ 機制已就緒,但正式 origin 尚未設定 |
| 9 | backend tests passed | ✅ 65/65 全數通過(本階段從 36 增加到 65),覆蓋率提升到 5/19 端點 |
| 10 | frontend build passed | ✅ `npm run build` 通過(與 API 是否可用無關,純建置檢查) |
| 11 | staging integration test passed | ❌ 尚未進行(backend 功能仍不足,無法有意義地跑 staging 測試) |

**目前 11 項中 3 項達成、1 項進行中(schema/build/測試綠燈已達成，frontend API 覆蓋率從 21% 提升到 42%)，其餘 7 項仍未達成。距離可以考慮 cutover 仍早期，核心阻礙是 `POST /contact` 與整個 `admin/*`(12/19 端點,63%)尚未開始實作。**

---

## 附錄：資料來源

- `specs/shared/api-contracts/api-specification.md`、`api-business-logic.md`、`openapi.yaml`
- `specs/backend/migration-history/known-legacy-issues.md`、`database-schema.md`
- `backend/src/`（全部 routes/modules/middleware/infrastructure）
- `backend/tests/`（全部 unit/integration）
- `frontend/api/`、`frontend/store/`、`frontend/pages/`、`frontend/components/`、`frontend/layouts/`、`frontend/utils/http.ts`
