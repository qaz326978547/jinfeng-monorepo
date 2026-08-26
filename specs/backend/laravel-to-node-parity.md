# Laravel → Node Backend Parity Analysis

> 分析日期：2026-08-25，第三階段更新：2026-08-26。比對範圍：`specs/backend/migration-history/`、
> `specs/shared/api-contracts/`（Laravel 舊系統規格）vs `backend/src/`、`backend/tests/`（Node 實作現況）vs
> `frontend/`（實際呼叫模式）。
>
> **這是分析文件，第三階段的程式碼變更記錄在下方「第三階段更新」段落。** 所有結論皆交叉比對至少 2 個來源
> （規格文件 + 原始碼），不單看 OpenAPI。

---

## 1. 整體完成百分比

**19 支 Laravel API 中，Node 後端目前 6 支完全 DONE + 2 支 DONE 但帶有已標示的非功能性缺口（合計 8/19 ≈ 42%）。**

**⚠️ 這不代表整個 auth flow 已 production-ready**——`register`/`logout` 的 API 本身已完成，但 frontend 端(localStorage 動態讀取、logout UI、401 自動清 token、`/admin/*` route guard)完全未跟進，見 §10.13。

| 狀態 | 數量 | 佔比 | 說明 |
|---|---|---|---|
| **DONE** | 6 | 32% | `POST /api/v2/auth/login`、`POST /api/v2/auth/register`、`POST /api/v2/auth/logout`、`GET /api/v2/seo`、`GET /api/v2/contact-class`、`GET /api/v2/contact-quest` — 完整實作 + integration/unit test 全過 |
| **DONE(API+DB+Mail)/PARTIAL(Queue)** | 1 | 5% | `POST /api/v2/contact` — API 行為、DB atomicity、Mail(同步)皆 DONE；**Queue 未實作**(見 §1.2)，**不算 production parity 完整完成** |
| **DONE(API)/PARTIAL(cache)** | 1 | 5% | `GET /api/v2/faq` — 查詢/排序/欄位投影與 Laravel 完全一致，**但 24 小時 cache 尚未實作**（見 §1.1），留有明確 TODO，**不算 production parity 完整完成** |
| **NOT_IMPLEMENTED** | 11 | 58% | 全部 9 支 `admin/*` — **backend/src/routes 完全沒有掛載對應路由**，呼叫會落到 `notFoundHandler`(404) |
| **BEHAVIOR_MISMATCH** | 0 | — | 已實作的 8 支經 integration test 驗證，與規格一致，無 mismatch（`POST /contact` 的 DB atomicity、`logout` 的 stateless 設計皆是刻意的行為改善/決策，非 mismatch） |
| **UNKNOWN** | 0 | — | 無 |

**結論：`backend/` 現在能正確服務首頁 SEO meta、FAQ 頁、報名表單的下拉選單與送出、完整的登入/註冊/登出 API，但整個後台管理（`admin/*`，含檢視/編輯/刪除報名資料）仍未實作，且 frontend 尚未跟上 auth API 的變化，還不能取代 Laravel 後端。**

OpenAPI 契約層(`specs/shared/api-contracts/openapi.yaml`)已完整定義全部 19 個 operation(15 個 path），品質良好、可直接作為實作依據 —— 已實作的 8 支皆通過 `npm run openapi:validate`。

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

### 1.2 第四階段更新（2026-08-26）—— `POST /api/v2/contact`

**API behavior: DONE / DB atomicity: DONE / Mail: DONE (synchronous) / Queue parity: PARTIAL（deferred）。**

新增/修改檔案：

- `backend/src/modules/contact/`（新增）—— `contact.repository.ts` / `.schemas.ts` / `.service.ts` / `.controller.ts` / `.routes.ts`
- `backend/src/infrastructure/mail/`（新增）—— `mail.config.ts`、`mail-transport.ts`、`mail.service.ts`、`contact-notification.mail.ts`
- `backend/src/shared/errors/form-request-validation-error.ts`（新增）—— 第 3 種錯誤格式（見下方）
- `backend/src/middleware/validate-request.ts`（修改）—— 新增 `formRequestErrorFormat` 選項
- `backend/src/middleware/error-handler.ts`（修改）—— 新增 `FormRequestValidationError` 分支
- `backend/src/config/env.ts`（修改）—— 新增 `MAIL_*` + `RECIPIENT_EMAIL`（皆有預設值，未設定時視為「mail 未設定」而非啟動失敗）
- `backend/.env.example`（修改）—— 同步新增，全部 placeholder
- `backend/src/app.ts`、`backend/src/routes/index.ts`（修改）—— 組裝 `mailConfig`，並新增測試專用的 `mailTransport` 覆寫參數（見下方 Mail tests 說明）
- `backend/tests/helpers/build-test-app.ts`（修改）—— 新增 `createMockMailTransport()`，`buildTestApp` 支援注入 mock transport
- `backend/package.json`（修改）—— 新增 `nodemailer` + `@types/nodemailer`

**Intentional reliability improvement**：
```
database writes are atomic in Node implementation.
```
Legacy Laravel `ContactController@store` 沒有把 `contact` 與 `contact_list` 的寫入包在同一個 transaction 內（known-legacy-issues.md #8）。Node 實作用既有的 `infrastructure/database/transaction.ts::withTransaction` 把兩者包成一個 transaction：`contact` insert 失敗 → 直接 rollback；`contact_list` 任一筆 insert 失敗 → 連同已成功的 `contact` insert 一起 rollback。這是刻意的行為改善，不是 BEHAVIOR_MISMATCH。

**第 3 種錯誤格式**：`api-specification.md`「統一錯誤格式」文件的 3 種格式中，前兩種（`LegacyValidationError` 422、通用 `{message,code,requestId}` 500/404）已存在，但 `{status:"error", message}` 400（FormRequest 驗證失敗格式，`register`/`contact`/`contact-class` 共用）在此之前從未被實作過（`register` 是 501 stub，從未真正跑到驗證失敗分支）。本階段新增 `FormRequestValidationError` + `validateRequest({formRequestErrorFormat: true})`，只取 Zod 的第一條錯誤訊息，比照 Laravel `$validator->errors()->first()`。

**Validation parity 確認結果**：已重新檢查 `api-specification.md` #4 的「特殊條件」——文件同時記載了兩件事：(a) FormRequest 驗證規則要求 `contactList[].email` 必填；(b) `store()` controller 內另外有 `is_array($item) && array_key_exists('email', $item)` 的執行期防呆，沒有 email 的項目會被略過不寫入。**這兩者並不衝突**——(a) 決定請求能否通過驗證(400 與否)，(b) 是驗證通過後的一層額外防呆，在驗證已強制要求 email 的前提下必然不會被觸發。因此本階段**兩者都實作了**：Zod 要求 `email` 必填(對應 a)，`contact.repository.ts::insertContactList` 也保留 `filter((item) => Boolean(item.email))`(對應 b，目前必然為 true，程式碼註解已註明是防呆而非可觸發邏輯)。沒有發現需要停下來回報的真正衝突。

**`ticket` 空字串的相容性決策**：`api-specification.md` 記載 `ticket` 只允許 `"2"`/`"3"`，但前端(`SignUpClassForm.vue`)在使用者未點選發票單選鈕時，預設值是空字串 `""`（不是 `null`，也沒有 `required` 屬性強制選擇）。若嚴格套用 `enum(["2","3"])`，會讓「使用者不填發票選項」這個真實存在的常見操作直接 400，違反「維持 frontend request/response compatibility」的目標。已將空字串正規化為 `undefined`（等同未提供），再套用 enum 檢查——這是為了相容性做的判斷，已在 `contact.schemas.ts` 註解中說明。

**Mail 已知缺口**：舊 Laravel `SignedUpMail`/Blade template 的確切主旨(subject)與內文排版，在 `specs/backend/migration-history/` 全文搜尋皆找不到記錄——migration-spec 只記錄了「內容包含 company/class/num/tel」與收件人硬編碼，沒有保留原始信件模板本身。`contact-notification.mail.ts` 是依這份文件記載的欄位重建的最小等效版本(純文字信、固定主旨「新報名通知」)，**不是原始模板的逐字重現**。已在程式碼註解與此處明確標示為缺口，未自行杜撰更多內容或版面。

**Mail failure policy（intentional behaviour decision）**：`ContactMailService.sendContactNotification()` 永遠不會 throw——DB transaction 成功後才嘗試寄信；寄信失敗（或 mail 根本未設定）只記錄一行 log（僅 `contactId` + `error.name`，**不含** SMTP 密碼或原始 error 物件），API 仍回 201。原因：報名資料已經確實寫入資料庫，通知信只是附加動作，遺失通知信遠比讓使用者誤以為報名失敗、可能重複送出來得可接受。

**Mail tests 如何 mock**：`ContactRouterDeps`/`RouterDeps`/`CreateAppOptions` 新增了測試專用的 `mailTransport` 覆寫欄位（production 從不設定，只有 `buildTestApp({mailTransport})` 會用到），讓 integration test 能注入 `createMockMailTransport()` 直接斷言 `sendMail` 呼叫內容與失敗行為，全程不建立任何真實 SMTP 連線、不連正式環境。

### 1.3 第五階段更新（2026-08-26）—— `POST /api/v2/auth/register` + `POST /api/v2/auth/logout`

**Register: DONE / Logout: DONE (stateless semantics, 產品決策見 §10.13)。**

新增/修改檔案：

- `backend/src/config/env.ts`（修改）—— `JWT_EXPIRES_IN` 從 `z.string()` 改為固定 allowlist `z.enum(['1d','7d','14d','30d'])`，預設值從 `1d` 改為 `30d`
- `backend/.env.example`（修改）—— 同步改為 `JWT_EXPIRES_IN=30d`，加註允許值/預設值/上限
- `backend/src/modules/auth/user.repository.ts`（修改）—— 新增 `createUser()`、`DuplicateEmailError`、依 `users_email_unique` constraint 名稱辨識重複 email 的 helper
- `backend/src/modules/auth/auth.schemas.ts`（修改）—— `registerRequestSchema` 加上 `password === password_confirmation` 的 `.refine()`，required 欄位補上 `{error}` 客製訊息
- `backend/src/modules/auth/auth.service.ts`（修改）—— 新增 `register()`（bcrypt hash + repository 呼叫 + `DuplicateEmailError` → `FormRequestValidationError` 轉譯），`AuthServiceDeps` 新增 `bcryptSaltRounds`
- `backend/src/modules/auth/auth.controller.ts`（修改）—— `register`/`logout` 從 501 stub 換成真正實作
- `backend/src/modules/auth/auth.routes.ts`（修改）—— `/register` 補上 `formRequestErrorFormat: true`（修正 §10.3 分析階段發現的既有缺口）
- `backend/src/app.ts`、`backend/src/routes/index.ts`（修改）—— 把 `env.BCRYPT_SALT_ROUNDS` 組裝並傳給 auth router
- `backend/tests/integration/env.test.ts`（修改）—— 更新預設值斷言，新增 JWT_EXPIRES_IN allowlist 完整測試
- `backend/tests/unit/auth.service.test.ts`（修改）—— 新增 `register()` unit tests + 30d exp 驗證
- `backend/tests/integration/auth-register.test.ts`（新增）、`backend/tests/integration/auth-logout.test.ts`（新增）

**JWT_EXPIRES_IN 產品決策（呼應 §10.5/§10.9 的分析）**：從單純「限制上限」進一步收斂為**固定 allowlist**(`1d`/`7d`/`14d`/`30d`)，而不是「字串 + 範圍檢查」——因為 `z.string()` 搭配範圍檢查仍然要解析 `ms` 字串格式，允許意外的格式變體；改用列舉直接把「允許的值」收斂到 4 個明確選項，`31d`/`60d`/`90d`/`365d`/`10y`/`1h`~`12h`/空字串/任意其他 `jsonwebtoken`/`ms` 可解析字串全部在**啟動階段**被拒絕（`loadEnv()` 在 `server.ts::main()` 最開頭被無保護呼叫，驗證失敗直接讓 process crash，不會等到第一次 login 才 500）。預設值與上限皆定為 `30d`——產品需求是「只要 JWT 未過期且使用者沒有主動登出，就應該長時間維持登入狀態（涵蓋關閉/重開瀏覽器、重新整理）」，`30d` 是兩個目標的折衷：夠長，讓 frontend 未來把 token 存進 localStorage 後不會頻繁要求重新登入；同時仍是一個明確的上限，不是永久 JWT。

**Duplicate email 辨識方式**：`users` 表除了自增 PK 外只有一個唯一鍵 `users_email_unique`(email)（`backend/migrations/001_create_tables.sql` 第 45 行）。`isDuplicateEmailError()` 同時檢查 `error.code === 'ER_DUP_ENTRY'` **且** `error.sqlMessage` 包含 `users_email_unique` 這個 constraint 自己的名稱——這是比對我們自己定義的、穩定的索引識別碼，不是對任意錯誤訊息字串做脆弱的猜測比對；即使未來這張表新增其他唯一鍵，其他鍵觸發的 `ER_DUP_ENTRY` 也不會被誤判成 email 重複（已有專門測試覆蓋這個情境）。

**Logout 是 stateless 設計，不是遺漏**：`authenticate` middleware 已經確保跑到 `logout` handler 時一定有合法、未過期的 token；handler 本身不做任何 DB 寫入、不建 blacklist、不用 Redis、不改 DB schema。**同一顆尚未過期的 JWT 在呼叫 logout 之後仍然對 `authenticate` 有效**——這不是 bug，是 §10.9 選定方案 A 的明確 security trade-off，已有專門測試(`auth-logout.test.ts`)驗證並記錄這個行為。真正讓單一瀏覽器完成登出，要靠未來的 frontend 任務清除 `localStorage` 的 token。

---

## 2. API Parity Matrix

### 2.1 總覽表

| # | Method | Path | 狀態 | Node route 是否存在 | Frontend 使用中 | Test 存在 | OpenAPI 已定義 |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/v2/seo` | **DONE** | ✅ | ✅ 是(每頁載入都呼叫) | ✅ 5 tests | ✅ |
| 2 | GET | `/api/v2/contact-class` | **DONE** | ✅ | ✅ 是 | ✅ 5 tests | ✅ |
| 3 | GET | `/api/v2/contact-quest` | **DONE** | ✅ | ✅ 是 | ✅ 9 tests | ✅ |
| 4 | POST | `/api/v2/contact` | **DONE(API+DB+Mail)/PARTIAL(Queue)** | ✅ | ✅ 是(核心轉換流程) | ✅ 14 tests | ✅ |
| 5 | GET | `/api/v2/faq` | **DONE(API)/PARTIAL(cache)** | ✅ | ✅ 是 | ✅ 4 tests | ✅ |
| 6 | POST | `/api/v2/auth/login` | **DONE** | ✅ | ✅ 是 | ✅ 18 tests | ✅ |
| 7 | POST | `/api/v2/auth/register` | **DONE** | ✅ | ⚠️ 前端有呼叫但**未接 UI**(死碼，見 4.2) | ✅ 11 tests | ✅ |
| 8 | POST | `/api/v2/auth/logout` | **DONE(stateless)** | ✅ | ❌ 前端完全沒有登出功能(見 §10.13) | ✅ 6 tests | ✅ |
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

#### #4 `POST /api/v2/contact` — **DONE(API+DB+Mail)/PARTIAL(Queue)**
- Laravel：`ContactController.php` (`store`) + `CreateContactRequest.php`
- Node：`src/modules/contact/`(4 層結構) + `src/infrastructure/mail/`(獨立 mail infrastructure)
- Request validation：`contact.schemas.ts`——`class`/`quest`/`company`/`tel`(≤10)/`num` 必填；`contactList[]` 陣列，每項需 `name`/`email`(格式)/`cel`(≤10) 必填、`job` 選填；`ticket` 選填且僅允許 `"2"`/`"3"`（空字串正規化為未提供，見 §1.2 相容性決策）
- Auth：不需要
- DB query：insert `contact` 1 筆 + insert `contact_list` N 筆，**包在同一個 transaction 內**(intentional reliability improvement，見 §1.2，修正 known-legacy-issues.md #8)；任一 insert 失敗即整體 rollback
- Response：成功 `201` `{message, data}`(`data` 只有 `contact` 主表欄位，不含 `contactList`，與規格一致)；驗證失敗 `400` `{status:"error", message}`(新增 `FormRequestValidationError`，只取第一條錯誤訊息)
- Cache：無
- **Mail：已實作(同步 Nodemailer)**——DB transaction 成功後才寄信，收件人由 `RECIPIENT_EMAIL` 環境變數設定(不再硬編碼)，內容含 company/class/num/tel(見 §1.2 mail 已知缺口說明：原始 Blade 模板內容未保留，本次是依文件記載欄位重建的最小等效版本)
- **Queue：未實作**——本階段刻意不引入 BullMQ/Redis/worker，寄信是同步呼叫；若未來需要非同步化，需另開任務
- Side effects：寄信(失敗不影響 API 回應，見 §1.2 mail failure policy)
- **Test**：`tests/integration/contact.test.ts`(14)

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

#### #7 `POST /api/v2/auth/register` — **DONE**
- Laravel：`AuthController.php` (`register`) + `CreateUser.php`
- Node：`auth.routes.ts` → `auth.controller.ts::createRegisterHandler` → `auth.service.ts::AuthService.register` → `user.repository.ts::UserRepository.createUser`
- Request validation：`registerRequestSchema`(Zod)，欄位與規格一致(`name`/`email`/`password`≥6/`password_confirmation`/`is_admin`)，新增 `password === password_confirmation` 的 `.refine()`；路由已補上 `formRequestErrorFormat: true`(修正 §10.3 分析階段發現的缺口)，驗證失敗回 `400 {status:"error", message}`
- `BCRYPT_SALT_ROUNDS` 已接上：`AuthService.register()` 用它呼叫 `bcrypt.hash()`
- DB query：`INSERT INTO users (name, email, password[, is_admin])`——`is_admin` 只在有提供時才出現在欄位清單，未提供時讓 DB `DEFAULT 0` 生效
- Duplicate email：`UserRepository` 依 `users_email_unique` constraint 名稱辨識 `ER_DUP_ENTRY`，轉成 `400 {status:"error", message:"email 已被使用"}`（見 §1.3 辨識方式說明）
- Response：成功 `201 {message:"註冊成功"}`，不回 token、不自動登入，與規格一致
- Cache/Mail/Queue：無
- **Test**：`tests/integration/auth-register.test.ts`(11)+ `tests/unit/auth.service.test.ts` 的 `register()` 區塊(4)

#### #8 `POST /api/v2/auth/logout` — **DONE(stateless)**
- Laravel：`AuthController.php` (`logout`)——**KNOWN_LEGACY_ISSUE**：舊系統沒有中介層保護,未帶 token 會 500
- Node route：**已掛載且已用 `authenticate(jwtSecret)` 中介層保護**（`router.post('/logout', authenticate(deps.jwtSecret), logout)`）—— **這點已經修正了舊系統的已知問題**(未帶 token 會正確回 401，不會 500)
- Node controller：`logout` → 直接回 `200 {message:"登出成功"}`，不做任何 DB 寫入(方案 A，見 §10.9/§10.13)
- **明確的 security trade-off**：同一顆尚未過期的 token 在 logout 後仍對 `authenticate` 有效，這是刻意設計，已有測試驗證
- Cache/Mail/Queue：無
- **Test**：`tests/integration/auth-logout.test.ts`(6)

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
| **Auth** | register | bcrypt 雜湊 + insert `users` | ✅ 已實作，bcrypt 雜湊 + duplicate email 偵測 + `is_admin` DB default | **DONE** |
| | login | Passport token | ✅ JWT，帳密驗證邏輯一致 | **DONE** |
| | logout | 無中介層保護(500 bug) | ✅ 已修正保護 + 已實作 stateless logout(方案 A，見 §10.9/§10.13) | **DONE(stateless)** |
| | Passport → JWT | oauth_access_tokens 表 | JWT，無狀態、免資料庫 token 儲存 | 設計已確定，符合 AUTH_REIMPLEMENTATION_REQUIRED |
| | password hash compatibility | bcrypt | ✅ `AuthService` 用 `bcryptjs` 比對/產生 bcrypt hash,格式驗證更嚴謹，register/login 皆已驗證(round-trip test) | **DONE(雙向)** |
| | token invalidation | 無(Passport revoke 未使用) | ✅ 明確決策：不實作(方案 A)，同一 token 在 logout 後仍有效直到自然過期，已測試驗證此行為 | **DONE(決策為「不做」，非遺漏)** |
| | auth middleware | 無 route 保護(part of legacy issue) | ✅ `authenticate.ts` 已實作,JWT 驗證完整，現在掛在 logout(唯一需要它的既有路由) | DONE(元件本身) |
| | admin authorization | **完全沒有 is_admin 檢查** | `requireAdmin` middleware 已寫好但**未掛在任何路由**(因為 admin/* 都還沒實作)；已在 §10.13 正式記錄未來 admin/* 必須 `authenticate → requireAdmin → controller`，不得複製 legacy 的無檢查行為 | 待實作(產品方向已定案，見 §10.13) |
| **Contact** | create | insert + 無 transaction | ✅ 已實作,且改用 transaction(見 §1.2) | **DONE** |
| | ContactList nested create | 逐筆 insert,略過無 email 項目 | ✅ 已實作;略過邏輯保留但因 Zod 已要求 email,目前不可觸發(見 §1.2 validation parity 確認結果) | **DONE** |
| | company search | LIKE 模糊搜尋 | 未實作(`admin/contact/search/search-company`) | NOT_IMPLEMENTED |
| | admin Contact endpoints | 5 支(index/show/update/delete/search) | 全部未實作 | NOT_IMPLEMENTED |
| | mail notification | 硬編碼收件人,非同步 queue | ✅ 已實作(同步 Nodemailer);收件人改為 `RECIPIENT_EMAIL` 環境變數(修正已知問題 #11);**非同步 queue 未實作** | **DONE(同步)/PARTIAL(queue)** |
| | transaction behavior | **無 transaction**(已知問題) | ✅ 已實作,`contact`+`contact_list` 包在同一 transaction,任一失敗即 rollback(intentional reliability improvement) | **DONE** |
| **ContactClass** | CRUD | 5 支 | 僅 `index`(公開讀取)已實作,其餘 4 支(admin CRUD)未實作 | index: **DONE**;其餘 NOT_IMPLEMENTED |
| | soft delete / del flag | 讀取端點過濾 `del=0` | ✅ `index` 已過濾 `del=0`,與規格一致 | DONE(僅 index) |
| | bulk delete | 硬刪除,批次模式 | 未實作 | NOT_IMPLEMENTED |
| **ContactList** | index/show | 2 支,無過濾 | 未實作 | NOT_IMPLEMENTED |
| **ContactQuest** | index | 分頁,`del=0` 過濾 | ✅ 已實作,`del=0` 過濾 + 完整 Laravel 分頁 envelope | **DONE** |
| **FAQ** | index | 4 欄位投影,24hr cache | ✅ 查詢/投影/排序已實作;❌ cache 未實作 | **DONE(API)/PARTIAL(cache)** |
| | 24hr cache | file/array cache,無失效機制 | **Node 無任何 cache 套件依賴**,`faq.service.ts` 留有 TODO | NOT_IMPLEMENTED(基礎設施都沒有) |
| **SEO** | GET data | 無過濾,無分頁 | ✅ 已實作,`SELECT * FROM seo`,`del` 未過濾維持原樣 | **DONE** |
| **Mail** | SignedUpMail 等效物 | Laravel Mail + queue | ✅ `nodemailer` 已裝,`src/infrastructure/mail/` 獨立模組,同步寄送(非 queue) | **DONE(同步)** |
| | template parity | Laravel Blade mail template | ⚠️ 原始 subject/內文排版未保留於 migration-history,只重建了文件記載的 4 個欄位(company/class/num/tel);**已知缺口,見 §1.2** | PARTIAL(內容欄位 DONE,原始排版 UNCONFIRMED) |
| | recipient behavior | 硬編碼 email | ✅ 改為 `RECIPIENT_EMAIL` 環境變數(修正已知問題 #11),不再硬編碼 | **DONE(且已改善)** |
| **Queue** | 舊 Laravel queue | database driver,`jobs` 表 | Node 未實作任何 queue 機制,**無 BullMQ/Redis 等套件依賴**——本階段刻意排除(任務範圍明確排除),`POST /contact` 改為同步寄信 | **明確標示：仍未實作,PARTIAL/deferred** |
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
| `SignUpClassForm.vue` → `addContactInfo` | `POST /contact` | ✅ 已實作(含 transaction + mail) | ✅ 可用 |
| `pages/auth.vue` → `AuthApi.login` | `POST /auth/login` | ✅ 已實作 | ✅ 可用 |
| `api/auth.ts` → `AuthApi.register`(**未被任何頁面呼叫**) | `POST /auth/register` | ✅ 已實作 | Backend 已可用，但前端仍是死碼(無 UI)且呼叫本身有既有 bug(`$http` 沒把 `data` 傳進去，見 4.3)——等未來真的要做註冊 UI 才需要一併修正 |
| (無呼叫) | `POST /auth/logout` | ✅ 已實作(stateless) | Backend 已可用，但前端完全沒有登出 UI/呼叫路徑(見 §10.13)，目前無法透過前端觸發 |
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

第四階段實作後，**10 / 19 支**前端有實際呼叫的端點仍缺 backend 實作(第三階段後剩 11 支，本階段補上 `POST /contact`)。剩餘缺口全部集中在**整個後台管理(`admin/*`)**——首頁 SEO meta、FAQ 頁、報名表單的下拉選單資料與「送出」流程現在都能正確運作，使用者可以完整走完報名流程，但後台管理仍完全無法使用。

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

### 4.7 第四階段 `POST /api/v2/contact` frontend 相容性檢查結果

靜態比對 `frontend/api/signedUpClass.ts::SignedUpClassInfoApi.addContactInfo`、
`frontend/api/interface/signedUpClass.ts::AddContactInfo`/`ContactListInfo`、
`frontend/components/SignUpClassForm.vue` 的呼叫方式與型別定義：

- **endpoint path**：前端呼叫 `$http('post', 'contact', data)`(無前導斜線)，經 axios 的 `combineURLs` 正規化後與其他呼叫(如 `/contact-class`)等價解析為 `.../api/v2/contact`，**與 Node 掛載路徑一致，非 bug**
- **request shape**：`AddContactInfo` 型別的 12 個欄位(`class`/`quest`/`company`/`tel`/`num`/`last5`/`ticket`/`ticket_name`/`ticket_no`/`ticket_address`/`from`/`suggest_name`/`contactList`)與 `contactListItemSchema` 的 4 個欄位(`name`/`cel`/`job`/`email`)，與 Node 的 Zod schema 欄位名稱**逐一比對完全一致**
- **response shape**：`addContactInfo` 與呼叫端(`SignUpClassForm.vue::addSignedUpClass`)只檢查回傳值是否 truthy，不讀取 `data` 內任何具體欄位，Node 回傳的 `{message, data}` 形狀完全相容
- **錯誤處理**：前端失敗分支 `alert(err.data.message)` 只讀取 `message` 字串顯示，不比對確切文字內容，因此 §1.2 提到的「驗證錯誤訊息非逐字重現 Laravel 原文」不影響前端功能
- **frontend 不需要同步修改**：確認無誤，**未發現任何 mismatch**

---

## 5. Behavior Mismatch

目前已實作的 6 支端點,行為與規格比對結果：**無 mismatch**。

- `login`：bcrypt 比對邏輯、錯誤訊息、狀態碼皆與 `api-specification.md` #6 一致，且额外加了 hash 格式完整性檢查,屬於安全性強化而非行為偏離
- `seo`：`SELECT * FROM seo` 無過濾無排序，`del` 未過濾維持原樣，與規格一致
- `contact-class`：`del=0` 過濾 + `no DESC` 排序，與規格一致
- `contact-quest`：`del=0` 過濾 + `no DESC` 排序 + `paginate(10)` envelope，與規格一致；`links` 的省略號演算法未重建(見 §1.1)，屬於已揭露的簡化，不是未揭露的 mismatch
- `faq`：4 欄位投影 + `no DESC` 排序，`del` 未過濾維持原樣，與規格一致；**24 小時 cache 未實作是已知、已標示的差距，不是行為 mismatch**(功能輸出正確，只是每次都重新查詢)
- `contact`(POST)：驗證欄位、寫入欄位、成功/失敗 response 格式與 `api-specification.md`/`api-business-logic.md` #4 一致；**DB transaction 是刻意的行為改善(intentional reliability improvement)，不是 mismatch**；**Mail 內容/收件人邏輯已改善(環境變數化)，模板排版本身是重建品，非逐字複製**(已標示為缺口，見 §1.2)；**Queue 未實作是已知、已標示的差距**(改為同步寄信，不影響 API 成功路徑的可觀察行為)

其餘 13 支尚未實作,無行為可比對。**唯一已知會在實作時產生 mismatch 風險的是 #11 `PUT /admin/contact/{id}`**——因為舊行為本身就是「看似更新、實際無效」，新專案不應該原樣照抄一個已知無效的實作，但改變行為又是對現有系統的偏離，需要產品/需求方決策後才能定義「正確」行為與「mismatch」的基準。

---

## 6. Security Differences

| 項目 | Laravel 舊系統 | Node 現況 | 差異 |
|---|---|---|---|
| Admin 授權 | 只檢查登入,無 `is_admin` 檢查(已知問題 #2) | `requireAdmin` middleware 已寫好但未掛用(因為 admin/* 都沒實作) | 待決策：實作 admin/* 時要沿用舊行為還是修正為真正檢查 `is_admin` |
| Logout 保護 | 無中介層,未帶 token 會 500(已知問題 #3) | **已修正**——`authenticate` 中介層已掛在 logout 路由,未帶 token 正確回 401 | Node 已是改善版行為,無需額外處理 |
| 密碼雜湊 | bcrypt | bcrypt(`bcryptjs`),且比對前多一層 hash 格式驗證 | Node 更嚴謹 |
| JWT secret 管理 | Passport 用 OAuth client secret(資料庫存) | `.env` 的 `JWT_SECRET`,Zod 強制 ≥16 字元 | 設計改善,但**部署時必須確保 production `JWT_SECRET` 是高強度隨機值，不能沿用 `.env.example` 的 placeholder** |
| JWT 過期時間 | Passport token 理論上可被 revoke(資料庫存,但實際可靠性未經驗證,見 §10.2) | ✅ **已修正**——`JWT_EXPIRES_IN` 從自由字串改為固定 allowlist(`1d`/`7d`/`14d`/`30d`,預設/上限 `30d`),不可能設成事實上永久,啟動階段 fail fast | Node 已封閉「永久 JWT + 無 revoke」的風險組合(§10.5 分析的直接呼應);**但 logout 本身仍是 stateless,token 在 30 天上限內自然過期前技術上仍有效,這是刻意的 trade-off,不是缺陷** |
| Token 撤銷/revocation | Passport 支援 revoke(可靠性未經驗證) | 明確決策不實作(方案 A) | 若未來需要「立即撤銷」,升級路徑是 `users.token_version`(方案 C,見 §10.9),非本階段範圍 |
| CORS | 未知(規格文件未記錄舊 Laravel CORS 設定) | 預設 `CORS_ALLOWED_ORIGINS=''`(全擋)，機制良好但**尚未設定正式 origin** | 上線前必須設定,否則前端會被 CORS 擋下 |
| Email 收件人 | 硬編碼在程式碼 | ✅ 已改為 `RECIPIENT_EMAIL` 環境變數(修正已知問題 #11) | 已改善,**部署時務必在 Zeabur 設定真實值,`.env.example` 只是 placeholder** |
| SMTP 憑證 | 不適用(舊系統無此概念) | `MAIL_USERNAME`/`MAIL_PASSWORD` 走環境變數,錯誤 log 只記 `error.name`,不含原始 error 物件或密碼 | 新增面,已依「不得 hardcode / log 不含 secret」要求實作 |
| SQL Injection | Laravel 參數化查詢(已確認安全) | Node 用 `mysql2` 已實作部分皆用參數化查詢(`?` placeholder) | 一致,無新增風險 |
| Helmet / HTTP headers | 前端 `server/middleware/helmet.ts` 有掛;Laravel 端未知 | ✅ `backend/src/app.ts` 已掛 `helmet()` | Node 端已具備 |

---

## 7. Test Coverage Gaps

| 測試類型 | 現況 |
|---|---|
| Unit tests | `auth.service.test.ts`(10，含新增 register()/30d exp 測試)、`legacy-validation-error.test.ts`(2)、`laravel-pagination.test.ts`(5) |
| Integration tests | `auth-login.test.ts`(13)、`auth-register.test.ts`(11，新增)、`auth-logout.test.ts`(6，新增)、`seo.test.ts`(5)、`faq.test.ts`(4)、`contact-class.test.ts`(5)、`contact-quest.test.ts`(9)、`contact.test.ts`(14)+ 基礎設施類測試(`env`(23，含新增 JWT_EXPIRES_IN allowlist 測試)/`error-handler`/`graceful-shutdown`/`health`/`not-found`/`ready`/`validate-request`) |
| **完全缺少測試的 API** | **11 / 19 支**（全部 9 支 `admin/*` — `register`/`logout` 本階段補上測試，原本 13 支） |
| Migration parity tests | 無——`backend/scripts/verify-schema.ts` 存在但只驗證 schema 結構,不是「舊資料庫資料 vs 新程式行為」的 parity test |
| Frontend/backend contract tests | 無——目前沒有任何跨 repo 的 contract test(例如用 `openapi.yaml` 對前端呼叫做 schema 驗證) |

**建議**：對 §8 建議實作順序中列出的每一支 migration-critical endpoint,至少建立 1 支 integration test（比照 `auth-login.test.ts`/本階段 4 支新測試的模式：`tests/helpers/build-test-app.ts` 已提供可重用的測試 app 建構工具,可直接沿用）。

---

## 8. 建議實作順序

依「前端阻斷程度」與「風險」排序：

1. ~~**`GET /api/v2/seo`**~~ —— **已於第三階段完成**
2. ~~**`GET /api/v2/faq`**~~ —— **已於第三階段完成**(API 行為),cache 仍待補
3. ~~**`GET /api/v2/contact-class`** + **`GET /api/v2/contact-quest`**~~ —— **已於第三階段完成**
4. ~~**`POST /api/v2/contact`**~~ —— **已於第四階段完成**(API/DB transaction/同步 Mail),Queue 仍待補(deferred)
5. ~~**`POST /api/v2/auth/register`**~~ —— **已於第五階段完成**
6. ~~**`POST /api/v2/auth/logout`**~~ —— **已於第五階段完成**(方案 A，stateless)；frontend 尚未跟進(登出 UI、localStorage 清除、401 導頁)，屬於獨立的 frontend 任務(見 §10.13)
6.5 **`admin/*` 開始實作前的建議前置工作**——**下一批建議項目**。既然 auth API 已完整，下一步應是 frontend auth improvement(login 持久化驗證、logout UI、401 自動清 token、`/admin/*` route guard，見 §10.13 清單)，讓後台管理實作出來後真的能被使用；純 API 角度也可以直接開始下列 admin 端點。
7. **`GET/DELETE /api/v2/admin/contact`** + **`GET /api/v2/admin/contact/{id}`** + **`GET /api/v2/admin/contact/search/search-company`** —— 後台核心讀取/刪除功能,先做這些(邏輯明確、無疑點);實作時記得掛 `authenticate → requireAdmin`(見 §10.13 決策)
8. **`admin/contact-class` 全部 4 支** —— 邏輯明確,可與上一批一起做
9. **`PUT /api/v2/admin/contact/{id}`** —— **排在最後**，因為必須先等需求方針對 known-legacy-issues.md #1 做出決策,且前端呼叫本身也有 bug(缺少 `{id}`)需要同步修正
10. **`admin/contact-list` 2 支** —— 前端目前未使用,優先度最低,可視情況併入 API 完整度需求再做

**跨端點的前置決策(需求方決定,非技術問題)**：
- known-legacy-issues #1（`PUT /admin/contact/{id}` 真正該更新什麼）
- known-legacy-issues #2（admin/* 是否要補上真正的 `is_admin` 檢查——這是行為變更）
- known-legacy-issues #6（`seo`/`faq` 的 `del` 未過濾是否為疏漏）
- known-legacy-issues #10（`contact-class` 硬刪除 vs `del` 軟刪除語意是否統一）
- ~~Mail/Queue 技術選型~~ —— **已於第四階段決定**：Mail 採 Nodemailer 同步寄信；Queue 刻意排除在本階段外，若未來需要非同步化(例如寄信對外部 SMTP 延遲敏感)，需另開任務評估 BullMQ+Redis 等方案

---

## 9. Production Cutover Criteria

**以下條件必須全部滿足，才可以考慮以 Node backend 取代 Laravel：**

| # | 條件 | 目前狀態 |
|---|---|---|
| 1 | frontend 使用中的 API 全部 DONE | ⚠️ 進行中：10/19 前端使用中的端點仍是 NOT_IMPLEMENTED(全部是 `admin/*`；`register`/`logout` 的 backend 已 DONE，但前端本來就沒有呼叫它們，見下方第 2 項的說明) |
| 2 | auth flow 完整(login/register/logout 皆可用) | ⚠️ **backend API 本身 DONE**(login/register/logout 三支都完整實作+測試)，**但 auth flow 整體仍不算 production-ready**——frontend 完全沒跟上：無登出 UI、`AuthApi.register` 是死碼、Authorization header 非動態讀取、401 不會清 token/導頁、`/admin/*` 無 route guard(完整清單見 §10.13)。**這是本階段任務明確要求不要虛報的項目。** |
| 3 | admin authorization 確認 | ⚠️ 產品決策已在 §10.13 正式記錄(未來 admin/* 必須 `authenticate → requireAdmin`)，但**尚未實作**(admin/* 整批都還沒開始) |
| 4 | database schema compatible | ✅ 已完成(`backend/migrations/` 與 database-schema.md 一致，本階段也未修改 schema) |
| 5 | mail confirmed | ⚠️ 進行中：`POST /contact` 的同步 Mail 已 DONE,但原始模板內容/排版是重建品非逐字複製(已知缺口，見 §1.2);其餘尚無其他端點需要 mail |
| 6 | queue confirmed | ❌ 刻意 deferred(本階段任務範圍明確排除,`POST /contact` 用同步寄信) |
| 7 | cache confirmed | ❌ FAQ 24hr cache 仍未實作(API 行為本身已 DONE) |
| 8 | CORS confirmed | ⚠️ 機制已就緒,但正式 origin 尚未設定 |
| 9 | backend tests passed | ✅ 120/120 全數通過(本階段從 79 增加到 120),覆蓋率提升到 8/19 端點 |
| 10 | frontend build passed | ✅ `npm run build` 通過(與 API 是否可用無關,純建置檢查；本階段未修改 frontend) |
| 11 | staging integration test passed | ❌ 尚未進行(backend 功能仍不足,無法有意義地跑 staging 測試) |

**目前 11 項中 3 項達成、4 項進行中(schema/build/測試綠燈已達成；auth API/admin 授權決策/mail 皆有進展但帶明確保留)，其餘 4 項仍未達成。距離可以考慮 cutover 仍早期，核心阻礙是整個 `admin/*`(9/19 端點,47%)尚未開始實作，以及 frontend 完全沒有跟上這批 auth API 的變化(見 §10.13 的 frontend 待辦清單)。**

---

## 10. Auth Migration Decision — Register / Logout（分析階段，2026-08-26，未實作）

> **本節僅為分析與決策記錄，對應 `docs/Node Auth parity.md` 的第一階段要求。**
> **本節產出時未修改任何程式碼，`register`/`logout` 狀態維持 §1 總覽表中的 PARTIAL（501 stub）不變。**

### 10.1 舊 Laravel register 行為

| 項目 | 內容 |
|---|---|
| Request validation | `name`(必填)、`email`(必填、格式、`users.email` 唯一)、`password`(必填、≥6 字元、需搭配 `password_confirmation` 相同)、`password_confirmation`(必填)、`is_admin`(選填 boolean) |
| Password hashing | bcrypt |
| Duplicate email | 屬於 FormRequest 驗證規則的一部分 → `400 {status:"error", message}`，不是獨立的 409 |
| DB 寫入欄位 | `users.name`/`email`/`password`(雜湊後)；`is_admin` 僅在有提供時寫入，否則吃 DB default `0` |
| Response status | 成功 `201`；驗證失敗 `400` |
| Response body | 成功僅 `{"message":"註冊成功"}`，**不含使用者資料或 token** |
| 是否直接產生 access token | **否**，需另外呼叫 `/auth/login` |
| Side effect | 無（單一 insert，不需要 transaction） |

### 10.2 舊 Laravel logout 行為

`known-legacy-issues.md` #3：路由沒有掛認證中介層，處理邏輯內部假設一定有已登入使用者，未帶有效憑證時對 `null` 呼叫方法直接拋例外 → **500**（而非乾淨的 401）。規格文件明確標示這是「不要照抄」的已知問題；新專案應該用中介層明確要求認證並回 401。

### 10.3 Node login 現況（已實作，供 register/logout 對齊參考）

| 項目 | 內容 |
|---|---|
| JWT payload | `{ sub: number, email: string, isAdmin: boolean }` |
| expiresIn | 讀自 `JWT_EXPIRES_IN` env var；**Zod schema 目前只驗證非空字串，無上限、無格式檢查**（見 §10.5） |
| Authentication middleware | `authenticate.ts` 已完整實作（驗證 JWT、掛 `req.user`），是通用元件；目前只掛在 `logout` 路由 |
| User lookup | `UserRepository.findByEmail`，`SELECT id,email,password,is_admin FROM users WHERE email=?` |
| Password compatibility | ✅ 已確認相容——`isSupportedBcryptHash` 正則 `/^\$2[aby]\$\d{2}\$/` 同時涵蓋 PHP `password_hash()` 預設的 `$2y$` 前綴與 bcryptjs 的 `$2a$/$2b$`，bcrypt 是跨語言標準格式 |
| Response contract | `200 {token}` / `401 {message:"帳號或密碼錯誤"}` |

`register` 路由已掛 `validateRequest(registerRequestSchema)`，**但沒有設定 `formRequestErrorFormat: true`**——若現在直接移除 stub，驗證失敗會回錯的 envelope（目前程式碼的一般 400 格式，不是規格要求的 `{status:"error",message}`）。這是本次分析發現的既有缺口，已列入 §10.10 register implementation plan。

### 10.4 Frontend auth flow

搜尋全部 `login`/`logout`/`register`/`Authorization`/token storage/401 handling：

- **Login**：`pages/auth.vue` → `AuthApi.login`(`api/auth.ts`) → `POST /auth/login` → 成功寫入 `localStorage.setItem('token', ...)` → `router.push('/admin/contact')`
- **Register**：`AuthApi.register` 存在於 `api/auth.ts`，但**沒有任何頁面呼叫它**——`pages/auth.vue` 只有登入表單，沒有註冊 UI，屬於死碼
- **Logout**：**完全不存在**——全 repo 搜尋 `logout`/`Logout`/`removeToken` 沒有任何命中；`useAuthStore.setToken(null)` 這個清除函式已存在但從未被呼叫
- **Token storage**：`localStorage`，經 `useAuthStore` 的 `token` computed 讀取
- **Authorization header**：`utils/http.ts` 在 **axios instance 建立時算一次**(`'Bearer ' + token.value`)，不是每次請求動態讀取——登入後同一頁面內的後續請求標頭不會自動更新（既有前端限制，本階段不修改，只回報）
- **401 handling**：`isResponseOK` 統一攔截，`401 → alert('請先登入')`，**沒有自動清除 token 或導回登入頁**
- **`/admin/*` 路由守衛**：**不存在**——沒有任何 middleware/`definePageMeta` 在進入前檢查 token，頁面殼會直接渲染，只有頁面內部的 API 呼叫會因未帶有效 token 而 401

```
登入:   pages/auth.vue → AuthApi.login → POST /auth/login（✅ DONE）
        → localStorage.setItem('token') → router.push('/admin/contact')
登出:   （不存在）—— 無 UI、無呼叫路徑
註冊:   AuthApi.register 已定義但 0 個呼叫點（死碼）
後續請求: Authorization header 於 axios instance 建立時讀一次，非每請求動態讀取
401:    isResponseOK → alert('請先登入')，不清除 token、不導頁
/admin/* 路由守衛: 不存在，純靠 API 401 擋
```

### 10.5 JWT 過期策略 + 「永久 JWT」風險分析

**目前實際策略**：`.env.example` 預設 `JWT_EXPIRES_IN=1d`；`env.ts` 的 Zod schema 是 `z.string().default('1d')`——**只驗證非空字串，沒有上限或格式檢查**。

- 空字串會通過 Zod 驗證，但在 `jwt.sign()` 時會因 `expiresIn` 格式不合法而丟出例外 → 500（安全的失敗模式）
- 但**操作者可以合法設定成 `"10y"`、`"36500d"` 這類事實上永久的值**，Zod 完全不會擋下來
- `logout` 目前是 501 stub，尚未有任何 server-side 撤銷機制

**結論**：若 `JWT_EXPIRES_IN` 未來被設成事實上永久，且 logout 只做純 stateless（方案 A），則「登出」在事實上完全不生效——已登出裝置的 token 若外洩，永遠可被重放。**這個組合不得視為 production-safe**，除非同時滿足：(a) `JWT_EXPIRES_IN` 被限制在合理範圍內，(b) 團隊接受「token 自然過期前這段時間內無法強制登出」是可接受風險。

### 10.6 Register 確認事項

- Laravel bcrypt ↔ Node bcrypt：✅ 相容
- Node 新建 hash ↔ 既有 users table：✅ 相容——bcryptjs 產生的 hash 是標準 bcrypt 格式，寫回同一個 `VARCHAR(255) users.password`，即使舊 Laravel 系統還在跑也能互相驗證
- Duplicate email error 是否符合 frontend：**無法判斷**——`AuthApi.register` 是死碼，`isResponseOK` 沒有為 register 客製任何 alert（連 `addContactInfo` 的 `alert(err.data.message)` 都沒有）
- Register 是否應直接 login：**否**，規格明確記載只回 `{message:"註冊成功"}`；目前也沒有前端 UI 依賴任一種行為，維持規格原樣風險最低

### 10.7 Admin 未來沿用性確認

`authenticate.ts`（JWT 驗證 + 掛 `req.user`）與 `requireAdmin`(檢查 `req.user.isAdmin`) **都已經是通用元件**，未來實作 `admin/*` 時可以**直接沿用，不需要修改這兩個 middleware**。唯一要決定的是「是否要真的掛 `requireAdmin`」這個產品決策（對齊 known-legacy-issues.md #2：舊系統完全沒檢查 `is_admin`，只要登入就能呼叫全部 admin 端點）。

### 10.8 Logout 四方案比較

| 方案 | 新增基礎設施 | Schema 改動 | 每次請求成本 | 複雜度 | 適合本專案？ |
|---|---|---|---|---|---|
| **A. 純 stateless** | 無 | 無 | 0（現有 `authenticate` 已是純 stateless 驗證） | 最低 | ✅ 是，前提是 `JWT_EXPIRES_IN` 被限制在合理範圍 |
| **B. JWT denylist** | Redis（目前完全沒有，`docker-compose.yml` 只有 `mysql`）或退而求其次用 MySQL 新表 + 清理機制 | 需要新表（若不用 Redis） | +1 次查詢/請求 | 中 | 目前規模不必要，且會引入新基礎設施 |
| **C. token version** | 無 | `users` 新增 1 個欄位(`token_version`) | +1 次查詢/請求(目前 `authenticate` 完全不碰 DB，這會改變其效能特性) | 中低 | 未來若真的需要「立即強制登出」才值得升級 |
| **D. refresh token** | 需要新表 + rotation 邏輯 + 新端點 | 較大改動 | 較高 | 最高 | **過度設計**，不建議 |

### 10.9 推薦方案

**現在採用方案 A（純 stateless），且把限制 `JWT_EXPIRES_IN` 上限當成方案 A 能成立的必要條件，而不是可選項。**

理由：(1) 目前規模是內部小型後台（課程報名/聯絡資料管理），非需要即時強制登出的高風險系統；(2) Laravel Passport 的可撤銷語意本就標記為 `AUTH_REIMPLEMENTATION_REQUIRED`，新專案不需要相容；(3) 零新增基礎設施、零 schema 改動、`authenticate` middleware 完全不用改；(4) `authenticate` 已確保跑到 handler 時一定有合法 token，handler 只需回 `200 {message:"登出成功"}`。

**必要前提（非加分項）**：限制 `JWT_EXPIRES_IN` 上限（建議在 Zod schema 加格式/範圍驗證），並重新評估預設值是否要低於現在的 `1d`。

**未來升級路徑（現在不做，只記錄決策）**：若業務日後需要「立即撤銷特定使用者權限」（離職員工、帳號外洩），下一步是方案 C(`users.token_version`)，因為只需要對既有 `users` 表加一個欄位，不需要新基礎設施；不建議跳到方案 B 或 D。

**DB schema 是否需要修改**：Register 不需要；Logout(方案 A) 不需要（未來升級到方案 C 才需要新增 `users.token_version`）。
**Redis 是否需要**：不需要（方案 A 完全不需要，即使未來做方案 B 也可以先用 MySQL 新表代替）。

### 10.10 Register implementation plan

1. `auth.routes.ts` 的 `/register` 路由補上 `formRequestErrorFormat: true`（修正本次發現的缺口）
2. Email 唯一性：讓 DB 的 `users_email_unique` 索引接住重複 insert，捕捉唯一鍵衝突後轉成 `FormRequestValidationError('email 已被使用')`（比預先 SELECT 檢查更 race-safe；確切中文文案 Laravel 原文未保留於 migration-spec，屬於與 `POST /contact` 相同性質的已知缺口）
3. 密碼雜湊改用 `BCRYPT_SALT_ROUNDS`（env 已定義但目前整個 `src/` 沒有任何地方讀取，需要在此接上）
4. `UserRepository` 新增 `createUser` 方法（insert `name`/`email`/雜湊後 `password`/`is_admin`?? 讓 DB default 生效）
5. 回應 `201 {message:"註冊成功"}`，不回 token、不自動登入
6. 沿用既有 `modules/auth/` 目錄，不需要新模組
7. 建議測試：成功註冊、重複 email、密碼與確認密碼不符、缺欄位、`is_admin` 選填、新 hash 可被既有 login 流程驗證（往返測試）

### 10.11 Logout implementation plan（方案 A）

1. `auth.controller.ts::logout` 從 `throw NotImplementedError` 改成：因 `authenticate` middleware 已確保跑到這裡一定有合法 `req.user`，直接回 `200 {message:"登出成功"}`，不做任何 DB 寫入
2. 不需要新的 repository/service 方法
3. **同批次強烈建議附帶**：為 `JWT_EXPIRES_IN` 加上範圍驗證，重新評估預設值是否要低於現在的 `1d`——這是讓方案 A 成立的必要條件，不是額外加分
4. 建議測試：合法 token → 200；缺 token/無效 token/過期 token → 401；確認 response shape

### 10.12 Security risks

- **最主要風險**：`JWT_EXPIRES_IN` 目前沒有上限驗證，若被誤設成事實上永久，搭配純 stateless logout，已登出/外洩的 token 會永遠有效——**必須靠限制過期時間上限來封閉，不是靠 logout 端點本身**
- **權限降級延遲風險**：`isAdmin` 在登入當下寫進 JWT payload，之後若在 DB 把某帳號的 `is_admin` 改回 0，該帳號手上「舊」的 token 在自然過期前仍持有 admin 權限——與上一點共用同一個解法（縮短過期時間）
- `admin/*` 一旦開始實作，`requireAdmin` 存在但目前完全沒有路由使用——必須主動決定要不要掛，否則會用「忘記掛」的方式意外複製舊系統的已知問題（known-legacy-issues.md #2）
- `BCRYPT_SALT_ROUNDS` 目前定義了但整個 `src/` 沒有任何地方讀取——等 register 實作時才會生效，需同時確認正式環境(Zeabur)有設定合理值(不是測試用的 `4`)
- 前端沒有 `/admin/*` 路由守衛、Authorization header 非每請求動態讀取、401 不會自動清 token/導頁——這些是既有前端限制，不是後端安全漏洞（資料仍由後端 API 授權把關），但會讓使用者對登入狀態的認知與實際狀態產生落差，建議未來作為獨立的 frontend 任務處理

### 10.13 實作結果（第五階段，2026-08-26）——`register`/`logout` 已完成

> §10.1–§10.12 是分析階段的紀錄，保留原樣供追溯；以下記錄實際採用的決策與實作結果。

**JWT_EXPIRES_IN 最終決策**：

- 允許值：`1d`、`7d`、`14d`、`30d`（固定 allowlist，見 `src/config/env.ts`）
- 預設值：`30d`
- 上限：`30d`
- 不接受任何其他 `jsonwebtoken`/`ms` 可解析字串（含空字串、`1h`~`12h`、`31d`/`60d`/`90d`/`365d`/`10y`/`"forever"`/`"never"` 等），一律在**應用程式啟動階段** fail fast（`server.ts::main()` 開頭無保護呼叫 `getEnv()`），不是等第一次 login 才 500

**產品決策（登入持久性）**：使用者登入後，Frontend 將 JWT 持久化於 `localStorage`。只要滿足以下三個條件，就應該維持登入狀態：

1. JWT 尚未過期
2. 使用者沒有主動登出
3. `localStorage` 沒有被清除（例如未使用無痕模式、未手動清瀏覽器資料）

關閉瀏覽器、重新開啟瀏覽器、重新整理頁面，都**不**應該因此自動登出。JWT 最長 `30` 天後，無論是否操作過，都必須重新登入——沒有永久 JWT，也沒有 refresh token 靜默延長這個上限。**這個決策目前只有 backend 端(`JWT_EXPIRES_IN=30d`)已經到位；frontend 目前完全沒有把 token 存進 `localStorage` 之外的任何持久化/生命週期管理邏輯**（見下方 frontend 待辦清單）。

**Admin 授權決策（正式記錄）**：未來所有 `/api/v2/admin/*` endpoint 實作時，路由鏈必須是：

```
authenticate → requireAdmin → controller
```

**不得**複製 Laravel 舊系統「只要登入即可操作任何 admin API」的 known-legacy-issue #2。`authenticate`/`requireAdmin` 兩個 middleware 都已經是可直接掛用的既有元件，不需要修改。

**Register 實作結果**：`bcrypt`(`BCRYPT_SALT_ROUNDS` 已接上) + `INSERT INTO users`；`is_admin` 未提供時不寫入該欄位，讓 DB `DEFAULT 0` 生效；重複 email 透過辨識 `users_email_unique` constraint 名稱轉成 `400 {status:"error", message:"email 已被使用"}`(不是猜測任意 `ER_DUP_ENTRY` 訊息字串)；成功回應維持 `201 {message:"註冊成功"}`,不回 token、不自動登入,與 legacy contract 完全一致。

**Logout 實作結果**：純 stateless(方案 A)。`authenticate` middleware 已保證跑到 handler 時 token 合法,handler 直接回 `200 {message:"登出成功"}`,無 DB 寫入、無 blacklist、無 Redis、無 schema 改動。**明確的、已測試驗證的 trade-off**：同一顆未過期的 JWT 在呼叫 logout 之後，對 `authenticate` 仍然有效，直到自然過期(最長 30 天)或使用者所在裝置上的 `localStorage` 被清除。

**⚠️ 不算完整 production-ready 的原因**：backend 這三支 API 全部完成、全部測試通過，但**auth flow 作為一個整體體驗，仍未 production-ready**，因為 frontend 完全沒有跟進。以下是下一個獨立 frontend 任務需要達成的清單（本階段明確排除，未修改任何 frontend 檔案）：

- [ ] login 成功後，JWT 存入 `localStorage`（目前已經有做，維持現況）
- [ ] 重新整理頁面後仍能從 `localStorage` 取得 token 並視為已登入
- [ ] 關閉並重新開啟瀏覽器後，只要 token 未過期，仍保持登入狀態
- [ ] `axios`/`utils/http.ts` 改成**每次 request 動態讀取** `localStorage` 的 token,而不是在 instance 建立時只讀一次（見 §10.4 已記錄的既有限制）
- [ ] 新增登出 UI(按鈕/選單項目),呼叫 `POST /auth/logout`，並清除 `localStorage` 的 token
- [ ] API 回傳 `401` 時，自動清除失效的 `localStorage` token 並導回 `/auth`(目前只有 `alert('請先登入')`,不會清 token 或導頁)
- [ ] `/admin/*` 加上 frontend route guard(目前頁面殼會直接渲染,不檢查 token)

以上皆不屬於本階段(`docs/Node Auth parity.md` 第二階段實作)的工作範圍。

---

## 11. Admin API Migration Plan（分析階段，2026-08-26，未實作）

> **本節僅為分析與規劃記錄，對應 `docs/Admin API migration planning.md`（或同名任務）的第一階段要求。**
> **本節產出時未修改任何程式碼、未修改 frontend、未實作任何 admin endpoint、未 commit。**
> **Authorization 已正式決定（見 §10.13）：所有 `admin/*` 未來實作皆必須 `authenticate → requireAdmin → controller`，不得複製 Laravel「只登入即可操作 admin API」的 known-legacy-issue #2。**

### 11.0 資料來源（本節專用）

除 §附錄 既有來源外，額外重新閱讀：`frontend/pages/admin/contact/index.vue`、`contact_class.vue`、`contact_detail.vue`、`contact_quest.vue`、`[id].vue`、`class/[id].vue`、`class/create_class.vue`，以及 `specs/shared/api-contracts/openapi.yaml` 完整的 9 個 admin path 定義（第 552–840 行）。

### 11.1 逐支 Admin API 15 項屬性矩陣

#### #9 `GET /api/v2/admin/contact`

| 屬性 | 內容 |
|---|---|
| 1. Method | GET |
| 2. Path | `/api/v2/admin/contact` |
| 3. Laravel controller/action | `Contact\ContactController@index` |
| 4. Frontend caller | `pages/admin/contact/index.vue::getContactData` → `SignedUpClassInfoApi.getContact({page})` |
| 5. Request schema | Query `page`（選填，Laravel 慣例預設 1） |
| 6. Response schema | `PaginatedResponse<Contact>`；與前端 `ContactData` interface 逐欄位一致 |
| 7. SQL behavior | `SELECT * FROM contact ORDER BY created_at DESC` |
| 8. Pagination | `paginate(10)`，可直接沿用 `laravel-pagination.ts` |
| 9. Transaction | 不需要（純讀取） |
| 10. Side effects | 無 |
| 11. authenticate | 需要 |
| 12. requireAdmin | 需要 |
| 13. Legacy bugs | 無此支特有問題（共通的 known-legacy-issue #2 見 §11.4） |
| 14. Frontend mismatch | 無 |
| 15. Implementation risk | **低** |

**分類：SAFE_TO_MIGRATE**

---

#### #10 `GET /api/v2/admin/contact/{id}`

| 屬性 | 內容 |
|---|---|
| 1. Method | GET |
| 2. Path | `/api/v2/admin/contact/{id}` |
| 3. Laravel controller/action | `ContactController@show` |
| 4. Frontend caller | `pages/admin/contact/[id].vue::getContactListData` → `getSingleContact(id)`（**唯讀顯示頁，無編輯表單**） |
| 5. Request schema | Path `id: integer` |
| 6. Response schema | `Contact` + 巢狀關聯資料（見下方 ⚠️） |
| 7. SQL behavior | `SELECT * FROM contact WHERE id=?` + `SELECT * FROM contact_list WHERE cid=?` |
| 8. Pagination | 不適用 |
| 9. Transaction | 不需要 |
| 10. Side effects | 無 |
| 11. authenticate | 需要 |
| 12. requireAdmin | 需要 |
| 13. Legacy bugs | 無此支特有問題 |
| 14. Frontend mismatch | **⚠️ 發現一個新的、未在先前分析中記錄的欄位命名衝突（見下方）** |
| 15. Implementation risk | 低（僅限於下方單一欄位命名決策） |

**⚠️ 新發現的來源衝突 — 巢狀關聯的 key 命名**：

- `openapi.yaml` 的 `Contact` schema：`contactList`（camelCase），註解「Only present when loaded via GET /api/v2/admin/contact/{id} (with('contactList'))」
- `frontend/api/interface/signedUpClass.ts`：`export interface ContactListData extends Contact { contact_list: ContactList[]; }`（**snake_case**）
- `pages/admin/contact/[id].vue` 模板實際存取：`contactListData?.contact_list`（snake_case）

**這是兩個文件互相衝突的具體案例**。技術上的合理解釋是：Laravel Eloquent 對關聯（`with('contactList')`，`contactList()` 是 camelCase 的 relation method 名稱）預設 `toArray()`/`toJson()` 序列化行為會把 relation 名稱轉成 **snake_case** 輸出，所以真實 API 回應很可能是 `contact_list`，而 `openapi.yaml` 當初可能誤植成 relation method 名稱本身（`contactList`）。前端型別與模板都是 `contact_list`，這通常代表當初是**對照真實 API 回應**寫的，可信度較高。

**但依照指示「如果這些來源互相衝突，分類為 REQUIRES_PRODUCT_DECISION，不要自行猜測」——本欄位命名本身正式標記為待確認項目，不自行選定。** 這支端點的其餘部分（查詢邏輯、分頁、`Contact` 主體欄位）完全清楚無爭議，只有這一個巢狀 key 的大小寫需要在實作前用「已知一組真實帳密登入舊 Laravel 系統手動打一次這支 API」或「直接問需求方/翻查 Laravel 原始碼」的方式確認，而不是我自行判斷。

**分類：SAFE_TO_MIGRATE（主體邏輯），但巢狀 key 命名本身需先確認 —— 建議實作前用一次性方式確認真實欄位名稱，而非直接開始寫測試/程式碼**

---

#### #11 `PUT/PATCH /api/v2/admin/contact/{id}` — 重新分析

| 屬性 | 內容 |
|---|---|
| 1. Method | PUT/PATCH |
| 2. Path | `/api/v2/admin/contact/{id}` |
| 3. Laravel controller/action | `ContactController@update` |
| 4. Frontend caller | `api/signedUpClass.ts::updateContactInfo`（**已重新確認：不是「漏了 `{id}`」這麼簡單 —— 全 repo 搜尋，這個函式的呼叫端(call site) 是 0。沒有任何頁面呼叫它。它是完全孤立的死碼**，`PUT /admin/contact`(缺 `{id}`) 這個路徑字串本身也只存在於這個從未被呼叫的函式定義裡） |
| 5. Request schema（驗證規則） | `ContactCreateRequest`（與 `POST /contact` 完全相同：`class`/`quest`/`company`/`tel`/`num`/`contactList[]` 皆必填） |
| 6. Response schema | `200 {message, data:Contact}` / `404 {message}` |
| 7. SQL behavior（實際寫入） | 只嘗試更新 `name` 與 `no` —— 但 Eloquent `$fillable` 不包含這兩個欄位（`contact` 表甚至沒有 `name` 欄位），**實務上兩者都寫不進去，只有 `updated_at` 會變** |
| 8. Pagination | 不適用 |
| 9. Transaction | 不適用（沒有真正的寫入） |
| 10. Side effects | 無（因為是 no-op） |
| 11. authenticate | 需要 |
| 12. requireAdmin | 需要 |
| 13. Legacy bugs | **KNOWN_LEGACY_ISSUE #1** —— 驗證規則與實際寫入欄位完全對不上，生產環境等同無效更新 |
| 14. Frontend mismatch | 前端呼叫端存在但**完全未被使用**（0 call site），且該呼叫本身路徑缺 `{id}` —— 但因為從未執行過，這個「bug」從未在生產環境被觸發過 |
| 15. Implementation risk | **高**——三個來源（驗證規則／實際寫入欄位／UI 需求）互相不一致，且 UI 端完全沒有编輯表單可供推斷「應該」編輯哪些欄位 |

**重新確認結果**：

- **前端為什麼漏 `{id}`**：不是「漏」，是這個函式從未被接上任何 UI，`{id}` 缺失只是死碼裡的其中一個症狀，不是一個真正在生產環境發生過的 bug
- **Laravel validation 欄位**：`class`/`quest`/`company`/`tel`/`num`/`contactList[]`（與新增報名相同）
- **Laravel 實際 update 欄位**：`name`、`no`（皆非法欄位，寫入失敗，等同 no-op）
- **DB schema**：`contact` 表沒有 `name` 欄位；`no` 欄位存在但不在 Eloquent `$fillable` 允許清單內
- **UI 實際可編輯欄位**：**零**——`[id].vue` 是純顯示頁，沒有任何輸入框或送出按鈕
- **OpenAPI contract**：`requestBody` 直接複用 `ContactCreateRequest`（與驗證規則一致），但這個 schema 本身跟「實際會發生什麼」完全脫節

**三個來源（驗證規則 vs 實際寫入 vs UI 需求）彼此不一致，且沒有任何 UI 訊號可以推斷「正確」行為應該是什麼。**

**分類：REQUIRES_PRODUCT_DECISION**（維持先前分析的判斷，本次重新確認後結論不變，但補上「前端其實是完全孤立的死碼」這個新事實，代表**目前沒有任何生產風險**——這支端點在被實作之前，暫不支援不會影響任何現有使用者）

---

#### #12 `DELETE /api/v2/admin/contact`

| 屬性 | 內容 |
|---|---|
| 1. Method | DELETE |
| 2. Path | `/api/v2/admin/contact` |
| 3. Laravel controller/action | `ContactController@destroy` |
| 4. Frontend caller | `pages/admin/contact/index.vue::deleteContactData` → `deleteContactInfo({ids})`（**永遠送陣列**，即使只刪一筆） |
| 5. Request schema | `{ids: number \| number[]}`（`DeleteByIdsRequest`，openapi 標記 UNCONFIRMED shape，但前端行為明確） |
| 6. Response schema | `200 {message}` / `404 {message}`（列出不存在的 id） |
| 7. SQL behavior | 陣列模式：先查全部 id 是否存在，任一不存在則整批 404 不刪；全存在才 `DELETE ... WHERE id IN (...)` |
| 8. Pagination | 不適用 |
| 9. Transaction | Legacy 無；可比照 `POST /contact` 加上 transaction 包住「查詢存在性 + 刪除」，屬於選配的可靠性改善，非必要 |
| 10. Side effects | **不會**連帶刪除 `contact_list` 對應資料（known-legacy-issue #9），**必須保留這個現況，不得自行加上 cascade delete** |
| 11. authenticate | 需要 |
| 12. requireAdmin | 需要 |
| 13. Legacy bugs | known-legacy-issue #9（孤兒資料）——明確標示為「保留現況」，不是要修的 bug |
| 14. Frontend mismatch | 無 |
| 15. Implementation risk | 低（邏輯清楚）；中（若不小心把「保留現況」誤實作成「順手修正」cascade delete，會製造與正式環境不同的資料庫最終狀態） |

**分類：SAFE_TO_MIGRATE**（前提：不得加上 cascade delete）

---

#### #13 `GET /api/v2/admin/contact-list`

| 屬性 | 內容 |
|---|---|
| 1. Method | GET |
| 2. Path | `/api/v2/admin/contact-list` |
| 3. Laravel controller/action | `ContactListController@index` |
| 4. Frontend caller | **無**（`api/signedUpClass.ts` 底部只有註解列出這個路徑） |
| 5. Request schema | 無 |
| 6. Response schema | `{data: ContactList[]}` |
| 7. SQL behavior | `SELECT * FROM contact_list`（無過濾、無排序） |
| 8. Pagination | 無 |
| 9. Transaction | 不需要 |
| 10. Side effects | 無 |
| 11. authenticate | 需要 |
| 12. requireAdmin | 需要 |
| 13. Legacy bugs | 無 |
| 14. Frontend mismatch | 不適用（前端未使用） |
| 15. Implementation risk | 低 |

**分類：SAFE_TO_MIGRATE（優先度最低——目前無任何消費者）**

---

#### #14 `GET /api/v2/admin/contact-list/{id}`

| 屬性 | 內容 |
|---|---|
| 1. Method | GET |
| 2. Path | `/api/v2/admin/contact-list/{id}` |
| 3. Laravel controller/action | `ContactListController@show` |
| 4. Frontend caller | 無 |
| 5. Request schema | Path `id: integer` |
| 6. Response schema | `ContactList`（全欄位） |
| 7. SQL behavior | `SELECT * FROM contact_list WHERE id=?` |
| 8. Pagination | 不適用 |
| 9. Transaction | 不需要 |
| 10. Side effects | 無 |
| 11. authenticate | 需要 |
| 12. requireAdmin | 需要 |
| 13. Legacy bugs | 無 |
| 14. Frontend mismatch | 不適用 |
| 15. Implementation risk | 低 |

**分類：SAFE_TO_MIGRATE（優先度最低）**

---

#### #15 `GET /api/v2/admin/contact-class/{id}`

| 屬性 | 內容 |
|---|---|
| 1. Method | GET |
| 2. Path | `/api/v2/admin/contact-class/{id}` |
| 3. Laravel controller/action | `ContactClassController@show` |
| 4. Frontend caller | `pages/admin/contact/class/[id].vue::getContactClassData` → `getSingleContactClass(id)` |
| 5. Request schema | Path `id: integer` |
| 6. Response schema | `ContactClass`（全欄位），與前端 interface 完全一致 |
| 7. SQL behavior | `SELECT * FROM contact_class WHERE id=? AND del=0` |
| 8. Pagination | 不適用 |
| 9. Transaction | 不需要 |
| 10. Side effects | 無 |
| 11. authenticate | 需要 |
| 12. requireAdmin | 需要 |
| 13. Legacy bugs | 無 |
| 14. Frontend mismatch | 無 |
| 15. Implementation risk | 低 |

**分類：SAFE_TO_MIGRATE**

---

#### #16 `POST /api/v2/admin/contact-class`

| 屬性 | 內容 |
|---|---|
| 1. Method | POST |
| 2. Path | `/api/v2/admin/contact-class` |
| 3. Laravel controller/action | `ContactClassController@store` |
| 4. Frontend caller | `pages/admin/contact/class/create_class.vue::addContactClassData` → `addContactClass({name, no})` |
| 5. Request schema | `{name: string(必填), no: integer(必填)}` |
| 6. Response schema | `201 {message, data:ContactClass}` / `400 {status:"error", message}` |
| 7. SQL behavior | `INSERT INTO contact_class (name, no)`，`del` 走 DB default `0` |
| 8. Pagination | 不適用 |
| 9. Transaction | 不需要（單一 insert） |
| 10. Side effects | 無 |
| 11. authenticate | 需要 |
| 12. requireAdmin | 需要 |
| 13. Legacy bugs | 無 |
| 14. Frontend mismatch | 無，欄位完全對齊 |
| 15. Implementation risk | 低 |

**分類：SAFE_TO_MIGRATE**

---

#### #17 `PUT/PATCH /api/v2/admin/contact-class/{id}`

| 屬性 | 內容 |
|---|---|
| 1. Method | PUT/PATCH |
| 2. Path | `/api/v2/admin/contact-class/{id}` |
| 3. Laravel controller/action | `ContactClassController@update`——api-specification.md 明確標註「此支驗證欄位與實際寫入欄位一致，無疑點」（與 #11 恰成對比） |
| 4. Frontend caller | **兩個呼叫點**：`pages/admin/contact/contact_class.vue::updateContactClassData(id,no,name)` 與 `pages/admin/contact/class/[id].vue::updateContactClassData()`，皆呼叫 `UpdateContactClass(id, {name, no})` |
| 5. Request schema | `{name: string(必填), no: integer(必填)}` |
| 6. Response schema | `200 {message, data:ContactClass}` / `404 {message}` |
| 7. SQL behavior | 先 `WHERE id=? AND del=0` 查詢確認存在，再 `UPDATE contact_class SET name=?, no=? WHERE id=?` |
| 8. Pagination | 不適用 |
| 9. Transaction | 不需要（單一 update，查詢+更新可視情況包 transaction，非必要） |
| 10. Side effects | 無 |
| 11. authenticate | 需要 |
| 12. requireAdmin | 需要 |
| 13. Legacy bugs | 無——這是唯一被規格明確排除「有疑點」的 update 端點 |
| 14. Frontend mismatch | 無，兩個呼叫點欄位皆一致 |
| 15. Implementation risk | 低 |

**分類：SAFE_TO_MIGRATE**

---

#### #18 `DELETE /api/v2/admin/contact-class`

| 屬性 | 內容 |
|---|---|
| 1. Method | DELETE |
| 2. Path | `/api/v2/admin/contact-class` |
| 3. Laravel controller/action | `ContactClassController@destroy` |
| 4. Frontend caller | `pages/admin/contact/contact_class.vue::deleteContactClassData` → `deleteSingleContactClass({ids})`（永遠陣列形式） |
| 5. Request schema | `{ids: number \| number[]}` |
| 6. Response schema | `200 {message}` / `404 {message}` |
| 7. SQL behavior | 與 #12 相同的「先查存在性、任一不存在整批 404」模式，**但這裡是真正的硬刪除整列**——即使 `contact_class` 表本身也有 `del` 欄位 |
| 8. Pagination | 不適用 |
| 9. Transaction | 同 #12，選配 |
| 10. Side effects | 無已知關聯資料需要處理 |
| 11. authenticate | 需要 |
| 12. requireAdmin | 需要 |
| 13. Legacy bugs | known-legacy-issue #10——軟刪除旗標(`del`)與硬刪除 API 並存，語意不一致，**明確標示「保留現況」，不是要修的 bug** |
| 14. Frontend mismatch | 無，永遠陣列形式 |
| 15. Implementation risk | 低（邏輯清楚）；中（若把「保留現況」誤實作成「順手統一改成軟刪除」，會是未經授權的行為變更） |

**分類：SAFE_TO_MIGRATE**（前提：維持硬刪除，不得自行改成軟刪除）

---

#### #19 `GET /api/v2/admin/contact/search/search-company`

| 屬性 | 內容 |
|---|---|
| 1. Method | GET |
| 2. Path | `/api/v2/admin/contact/search/search-company` |
| 3. Laravel controller/action | `ContactController@searchCompany` |
| 4. Frontend caller | `pages/admin/contact/index.vue::searchContactInfo` → `searchContactInfo({company})` |
| 5. Request schema | Query `company`（選填字串） |
| 6. Response schema | `PaginatedResponse<Contact>` |
| 7. SQL behavior | `SELECT * FROM contact WHERE company LIKE '%<company>%'`（參數化查詢） |
| 8. Pagination | `paginate(10)`，可直接沿用 `laravel-pagination.ts` |
| 9. Transaction | 不需要 |
| 10. Side effects | 無 |
| 11. authenticate | 需要 |
| 12. requireAdmin | 需要 |
| 13. Legacy bugs | 無(`%`/`_` 萬用字元未轉義是已知、低風險、規格本身標註可接受的行為，非需要修正的 bug) |
| 14. Frontend mismatch | 無 |
| 15. Implementation risk | 低 |

**分類：SAFE_TO_MIGRATE**

### 11.2 分類總表

| 分類 | 端點 |
|---|---|
| **SAFE_TO_MIGRATE** | #9 `GET admin/contact`、#10 `GET admin/contact/{id}`(巢狀 key 命名需先一次性確認)、#12 `DELETE admin/contact`、#13 `GET admin/contact-list`、#14 `GET admin/contact-list/{id}`、#15 `GET admin/contact-class/{id}`、#16 `POST admin/contact-class`、#17 `PUT admin/contact-class/{id}`、#18 `DELETE admin/contact-class`、#19 `GET admin/contact/search/search-company`（共 9 支，含 #10 的條件） |
| **MIGRATE_WITH_INTENTIONAL_FIX** | **無**——本批 9 支中，known-legacy-issues 明確記載的 #9(孤兒資料)、#10(軟硬刪除不一致) 兩項規格本身都寫明「保留現況」，不屬於「有明確 bug 且能可靠推導正確行為並應該修正」的情境，因此不落入這個分類 |
| **REQUIRES_PRODUCT_DECISION** | #11 `PUT admin/contact/{id}`（三方來源衝突 + UI 零訊號） |

### 11.3 Frontend Mismatch 總結

| 端點 | Mismatch | 影響 |
|---|---|---|
| #10 `GET admin/contact/{id}` | **新發現**：巢狀關聯 key，openapi 寫 `contactList`，前端型別/模板用 `contact_list` | 若照抄 openapi 字面命名實作，`[id].vue` 的「參加人員名單」表格會靜默顯示空清單(不會報錯,只是查無資料),需要在實作前確認真實欄位名稱 |
| #11 `PUT admin/contact/{id}` | 呼叫端存在但 0 call site,且缺 `{id}` | 目前對生產環境零影響(死碼);若未來真的要接上編輯 UI,除了要解決 REQUIRES_PRODUCT_DECISION,也要同時修正這個呼叫本身 |
| 其餘 7 支 | 無 | — |

### 11.4 Legacy Bugs 總結（本批相關）

| # | 問題 | 端點 | 建議 Node 行為 |
|---|---|---|---|
| known-legacy-issues #1 | 驗證欄位與實際寫入欄位不一致 | #11 | 不得照抄；需要產品決策 |
| known-legacy-issues #2 | admin/* 完全沒有 `is_admin` 檢查 | 全部 9 支 | **已決策修正**——一律 `authenticate → requireAdmin`，不複製這個問題 |
| known-legacy-issues #9 | `DELETE admin/contact` 不會級聯刪除 `contact_list` | #12 | **保留現況**，不得自行加 cascade |
| known-legacy-issues #10 | `contact_class` 軟刪除旗標與硬刪除 API 並存 | #18 | **保留現況**，不得自行改成軟刪除 |

### 11.5 建議 Migration Batches

**Batch 1（優先）—— 唯讀、無 side effect、契約明確**：
1. `GET /api/v2/admin/contact`(#9)
2. `GET /api/v2/admin/contact/{id}`(#10)——**實作前先確認巢狀 key 命名**
3. `GET /api/v2/admin/contact-class/{id}`(#15)
4. `GET /api/v2/admin/contact/search/search-company`(#19)
5. `GET /api/v2/admin/contact-list`(#13)、`GET /api/v2/admin/contact-list/{id}`(#14)——可與上述一起做，但因目前零消費者，優先度可再往後放

**Batch 2（其次）—— 簡單 create/update/delete，契約乾淨無疑點**：
6. `POST /api/v2/admin/contact-class`(#16)
7. `PUT /api/v2/admin/contact-class/{id}`(#17)

**Batch 3（最後）—— legacy 行為有問題 / destructive operation**：
8. `DELETE /api/v2/admin/contact`(#12)——destructive，需注意「不得加 cascade」
9. `DELETE /api/v2/admin/contact-class`(#18)——destructive，需注意「不得改成軟刪除」
10. `PUT /api/v2/admin/contact/{id}`(#11)——**維持 REQUIRES_PRODUCT_DECISION，不排入任何 batch，等待決策**

### 11.6 Admin Authorization Integration Test 規劃

對 Batch 1/2/3 中每一支實作出來的端點，建議至少 3 個授權層級測試（沿用 `authenticate`/`requireAdmin` 既有元件，不需新的 middleware）：

```
無 Authorization header          → 401
一般使用者 JWT(isAdmin:false)     → 403（來自 requireAdmin，非 controller 邏輯本身）
admin JWT(isAdmin:true)          → 依端點正常進入 controller(200/201/實際業務邏輯)
```

比照現有 `auth-logout.test.ts` 的模式，可以直接用 `jwt.sign({sub,email,isAdmin}, JWT_SECRET, {expiresIn:'1h'})` 產生兩種 token(一般/admin)重複用在每支端點的測試檔開頭，不需要為每支端點重新設計授權測試邏輯——這部分測試程式碼可以高度共用（例如抽成一個 `tests/helpers/auth-tokens.ts` 之類的共用 helper，屆時實作階段再建立）。

### 11.7 預估完成後的 Parity %

- 若完成 Batch 1 + Batch 2 + Batch 3 中的 #12/#18（**共 9 支中的 8 支，排除 #11**）：**16/19 ≈ 84%**（14 支完全 DONE + 2 支帶已知非功能性缺口的 DONE：`GET faq` cache 待補、`POST contact` queue 待補）；`PUT admin/contact/{id}` 維持 NOT_IMPLEMENTED，正式標記為「等待產品決策」而非「尚未排入工作」
- 若 #11 未來也被決策並實作：**17/19 ≈ 89%**

### 11.8 尚未解決的 Production Cutover Blockers（完成這 9 支後）

即使 Admin API 全部(含 #11)完成，以下項目仍會繼續卡住 §9 的 production cutover checklist，**不會**因為 admin API 完成而自動解決：

1. **Frontend 完全沒有跟進**（§10.13 清單）——即使 backend admin API 全部就緒，`pages/admin/*` 目前的呼叫方式(尤其是 Authorization header 非動態讀取)仍然可能造成登入後立即呼叫 admin API 時帶著過期的 header
2. FAQ 24 小時 cache 仍未實作
3. `POST /contact` 的 Queue 化仍是 deferred
4. `CORS_ALLOWED_ORIGINS` 正式 origin 尚未設定
5. Production `JWT_SECRET`/`RECIPIENT_EMAIL`/`MAIL_*` 是否已在 Zeabur 設定真實值尚未驗證(這在本分析範圍外，屬於部署檢查)
6. Mail 模板原始內容/排版仍是重建品，非逐字複製(已知缺口)
7. Staging integration test 完全沒有進行過
8. 若 `PUT /admin/contact/{id}` 決策後選擇「新增全新的正確行為」而非「維持 legacy no-op」，需要**同時**新增前端編輯 UI(目前完全不存在)，這是一筆跨 stack 的工作，不只是後端 API

---

## 附錄：資料來源

- `specs/shared/api-contracts/api-specification.md`、`api-business-logic.md`、`openapi.yaml`、`auth-login.md`
- `specs/backend/migration-history/known-legacy-issues.md`、`database-schema.md`
- `backend/src/`（全部 routes/modules/middleware/infrastructure）
- `backend/tests/`（全部 unit/integration）
- `backend/docker-compose.yml`（確認無 Redis service）
- `frontend/api/`、`frontend/store/`、`frontend/pages/`（含 `pages/admin/contact/*.vue` 逐檔重新確認呼叫端）、`frontend/components/`、`frontend/layouts/`、`frontend/utils/http.ts`
- `specs/shared/api-contracts/openapi.yaml` 完整 9 個 admin path 定義（§11 專用）
