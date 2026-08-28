# Laravel → Node Backend Parity Analysis

> 分析日期：2026-08-25，第三階段更新：2026-08-26。比對範圍：`specs/backend/migration-history/`、
> `specs/shared/api-contracts/`（Laravel 舊系統規格）vs `backend/src/`、`backend/tests/`（Node 實作現況）vs
> `frontend/`（實際呼叫模式）。
>
> **這是分析文件，第三階段的程式碼變更記錄在下方「第三階段更新」段落。** 所有結論皆交叉比對至少 2 個來源
> （規格文件 + 原始碼），不單看 OpenAPI。

---

## 1. 整體完成百分比

**19 支 Laravel API 中，Node 後端目前 16 支完全 DONE + 2 支 DONE 但帶有已標示的非功能性缺口 + 1 支正式 DEFERRED（合計 18/19 ≈ 95% 功能完成；16/19 ≈ 84% 無任何保留的完整 DONE）。**

**⚠️ 這不代表 production-ready**——見下方「功能 endpoint 完成率 vs production parity」的區分，以及 §9 production cutover checklist。所有已排入實作範圍的 admin API 都已完成；frontend auth UX(localStorage 動態讀取、logout UI、401 自動清 token、`/admin/*` route guard)已於 2026-08-27 完成並跟上，見 §10.14；FAQ cache 與 Contact Queue 仍是 PARTIAL，兩者都**不計入** production-ready 的判斷。

| 狀態 | 數量 | 佔比 | 說明 |
|---|---|---|---|
| **DONE** | 16 | 84% | `login`/`register`/`logout`、`seo`、`contact-class`、`contact-quest`、全部 6 支唯讀 admin 端點、`POST admin/contact-class`、`PUT admin/contact-class/{id}`、`DELETE admin/contact`、`DELETE admin/contact-class` — 完整實作 + integration/unit test 全過 |
| **DONE(API+DB+Mail)/PARTIAL(Queue)** | 1 | 5% | `POST /api/v2/contact` — **不算 production parity 完整完成**（Queue 未實作，見 §1.2） |
| **DONE(API)/PARTIAL(cache)** | 1 | 5% | `GET /api/v2/faq` — **不算 production parity 完整完成**（cache 未實作，見 §1.1） |
| **DEFERRED / NOT_REQUIRED_BY_CURRENT_UI** | 1 | 5% | `PUT /api/v2/admin/contact/{id}` — **正式決策不在本階段實作**，理由見 §11.1 #11 與 §11.9（三方 contract 衝突 + frontend 0 call site + legacy no-op）。**不得視為「忘記實作」的 NOT_IMPLEMENTED，也不為了湊 19/19 而人工創造新行為** |
| **NOT_IMPLEMENTED** | 0 | 0% | 無——所有已排定的端點都已完成，僅 `PUT admin/contact/{id}` 因產品決策維持 DEFERRED |
| **BEHAVIOR_MISMATCH** | 0 | — | 已實作的 18 支經 integration test 驗證，與規格一致，無 mismatch |
| **UNKNOWN** | 0 | — | 無 |

**功能 endpoint 完成率 vs production parity（依指示明確區分）**：
- **功能 endpoint 完成率**：18/19 ≈ 95%（DONE + 帶已知缺口的 DONE），或嚴格只算完全無保留的 DONE 則 16/19 ≈ 84%
- **Production parity**：明顯更低——即使全部 19 支都是 DONE，FAQ cache、Contact Queue、frontend 完全未跟進、CORS 正式 origin、production 環境變數、staging test 等 §9 checklist 項目都還沒有一項是完全達成的「可以切換」狀態，見 §9 完整表格

**結論：`backend/` 現在能正確服務首頁 SEO meta、FAQ 頁、報名表單的下拉選單與送出、完整的登入/註冊/登出 API，以及完整的後台報名資料/課程分類管理（列表/檢視/搜尋/新增/修改/刪除），只剩 `PUT admin/contact/{id}` 因產品決策維持不實作。但 frontend 尚未跟上這幾批 API 的變化，還不能取代 Laravel 後端。**

OpenAPI 契約層(`specs/shared/api-contracts/openapi.yaml`)已完整定義全部 19 個 operation(15 個 path），品質良好、可直接作為實作依據 —— 已實作的 18 支皆通過 `npm run openapi:validate`，先前階段並修正了一處文件本身的錯誤（見 §1.4）。

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

### 1.4 第六階段更新（2026-08-26）—— Admin Batch 1（6 支唯讀端點）

**`GET admin/contact`、`GET admin/contact/{id}`、`GET admin/contact-class/{id}`、`GET admin/contact/search/search-company`、`GET admin/contact-list`、`GET admin/contact-list/{id}`：全部 DONE。`PUT admin/contact/{id}` 正式 DEFERRED，未排入本批或任何已排程的下一批。**

新增/修改檔案：

- `backend/src/shared/http/request-path.ts`（新增）—— 從 `contact-quest.controller.ts` 抽出的 `buildRequestPath()`，供新的 admin 分頁端點共用；**未修改 `contact-quest.controller.ts` 本身**(它保留自己原本的區域副本，避免碰觸已測試過的既有程式碼)
- `backend/src/shared/http/pagination-query.schema.ts`（新增）—— 共用的 `?page=` Zod schema，同上，未回頭修改 `contact-quest.schemas.ts`
- `backend/src/modules/contact-list/`（新增模組）—— `contact-list.repository.ts` / `.schemas.ts` / `.service.ts` / `.controller.ts` / `.routes.ts`（`admin/contact-list` 兩支）
- `backend/src/modules/contact/contact.repository.ts`（修改）—— 新增 `countAll`/`findPage`/`findById`/`findContactListByContactId`/`countByCompany`/`findByCompanyPage`（共用既有 `ContactRepository`，未另建 admin 專用 repository）
- `backend/src/modules/contact/admin-contact.schemas.ts`/`admin-contact.service.ts`/`admin-contact.controller.ts`/`admin-contact.routes.ts`（新增，`modules/contact/` 的 admin 專用 sibling 檔案）
- `backend/src/modules/contact-class/contact-class.repository.ts`（修改）—— 新增 `findByIdActive`
- `backend/src/modules/contact-class/admin-contact-class.schemas.ts`/`admin-contact-class.service.ts`/`admin-contact-class.controller.ts`/`admin-contact-class.routes.ts`（新增）
- `backend/src/routes/index.ts`（修改）—— 掛載 3 個 admin router，各自內部 `router.use(authenticate, requireAdmin)`
- `backend/tests/helpers/auth-tokens.ts`（新增）—— 共用的 `normalUserToken()`/`adminUserToken()`/`expiredToken()`
- `backend/tests/integration/admin-contact.test.ts`、`admin-contact-class.test.ts`、`admin-contact-list.test.ts`（新增）
- `specs/shared/api-contracts/openapi.yaml`（修改）—— contract correction，見下方

**Architecture 決策**：沒有建立獨立的 `modules/admin/` 目錄。Admin 專用的 service/controller/routes 以「同一 resource 目錄下的 sibling 檔案」形式存在（例如 `modules/contact/admin-contact.routes.ts` 緊鄰 `modules/contact/contact.routes.ts`），並直接重用同一個 `ContactRepository`/`ContactClassRepository` 實例類別（只是新增方法，不是新建 class）。這樣公開版與管理版的查詢邏輯共用同一個 repository，同時保持「public 端點與 admin 端點責任分離」——因為 authorization 是掛在各自的 `*.routes.ts`（middleware 層），repository 完全不知道呼叫者是不是 admin，符合指示「Authorization 必須放 route/middleware layer，不要在 repository 判斷 admin」。`contact-list` 因為在既有模組中沒有對應的 public resource（規格中沒有 `GET /contact-list` 這種公開端點），所以新開一個和其他 resource 同級的 `modules/contact-list/`，而不是塞進 `modules/contact/`。

**Authorization 實作**：`AdminContactRouterDeps`/`AdminContactClassRouterDeps`/`ContactListRouterDeps` 都收 `jwtSecret`，各自的 router 在最上層用 `router.use(authenticate(deps.jwtSecret), requireAdmin)`，其後掛載的所有子路由自動繼承這個保護，不需要每支 route 個別重複掛。三層驗證(401/403/200)已用共用的 `tests/helpers/auth-tokens.ts` 覆蓋每一支端點。

**`contact_list` contract correction（依產品決策執行）**：`GET /admin/contact/{id}` 的 response 巢狀 key 正式採用 `contact_list`（snake_case），已同步修正 `specs/shared/api-contracts/openapi.yaml` 的 `Contact` schema（原本誤植為 `contactList`），並在 schema description 中註明這是文件更正、來源依據為何。**注意**：`openapi.yaml` 另外還有幾處 `contactList`（`ContactCreateRequest.contactList`，`POST /contact` 與 `PUT /admin/contact/{id}` 的**請求** body 欄位），這些是完全不同的欄位（前端送出的報名人員陣列，已在 `POST /contact` 實作中確認為 camelCase 且已測試），**沒有被這次修正影響、也不應該被影響**——已逐一核對過，只改了 `Contact` schema 的**回應**巢狀 key。`npm run openapi:validate` 通過。

**Search-company 排序的忠實實作**：`api-specification.md`/`api-business-logic.md` 對 #19 都沒有提到任何 `ORDER BY`（不像 #9 明確寫「依 created_at 由新到舊排序」）。`findByCompanyPage` 因此**沒有加任何 ORDER BY**，忠實反映規格沒說的就不加，不是因為疏漏或依賴 MySQL 未定義的預設順序做了任何假設。

**404 回應格式**：`GET admin/contact/{id}`、`GET admin/contact-class/{id}`、`GET admin/contact-list/{id}` 的 404 都是 controller 直接 `res.status(404).json({message:"找不到資料"})`，**沒有**經過既有的 `NotFoundError`/`isAppError` 通用分支——因為那個分支會額外夾帶 `code`/`requestId` 欄位，不符合 `api-specification.md`「統一錯誤格式」#3 記載的純 `{message}` 格式。這是刻意的選擇，不是遺漏了要用共用錯誤類別。

### 1.5 第七階段更新（2026-08-26）—— Admin CUD Batch（4 支寫入端點）

**`POST admin/contact-class`、`PUT admin/contact-class/{id}`、`DELETE admin/contact`、`DELETE admin/contact-class`：全部 DONE。`PUT admin/contact/{id}` 依然刻意不實作，維持 DEFERRED。**

新增/修改檔案：

- `backend/src/shared/http/delete-ids.schema.ts`（新增）—— `{ids: number | number[]}` 共用 Zod schema，`DELETE admin/contact`/`DELETE admin/contact-class` 共用
- `backend/src/modules/contact/contact.repository.ts`（修改）—— 新增 `deleteByIds`（transaction 包住 existence check + delete）
- `backend/src/modules/contact/admin-contact.service.ts`/`.controller.ts`/`.routes.ts`（修改）—— 新增 DELETE handler
- `backend/src/modules/contact-class/contact-class.repository.ts`（修改）—— 新增 `create`/`updateActive`/`deleteByIds`
- `backend/src/modules/contact-class/admin-contact-class.schemas.ts`（修改）—— 新增 `contactClassWriteRequestSchema`(POST/PUT 共用)
- `backend/src/modules/contact-class/admin-contact-class.service.ts`/`.controller.ts`/`.routes.ts`（修改）—— 新增 create/update/delete handler
- `backend/tests/integration/admin-contact.test.ts`（修改）—— 新增 DELETE 測試區塊(13 個)
- `backend/tests/integration/admin-contact-class.test.ts`（修改）—— 新增 POST/PUT/DELETE 測試區塊(25 個)

**Delete transaction 行為**：`deleteByIds`(both `contact` 與 `contact_class`) 用既有 `withTransaction` 把「existence check」與「delete」包成一個 transaction——這是刻意的可靠性改善(比照 `POST /contact` 的先例)，但**observable behavior 與 legacy 完全一致**：任一 id 不存在，整批不刪除，回 404 列出所有不存在的 id(陣列模式)或該筆 id(單值模式)；全部存在才真正刪除。已用測試明確驗證「missing id 時 DELETE 查詢完全不會被送出」。

**No-cascade 確認**：`DELETE admin/contact` 的 repository 方法只碰 `contact` 表，測試明確斷言**沒有任何一次 query 涉及 `contact_list`**——保留 known-legacy-issues.md #9 記載的孤兒資料現況，未自行加上 cascade delete。

**Hard-delete 確認**：`DELETE admin/contact-class` 送出的是真正的 `DELETE FROM contact_class WHERE id IN (...)`，測試明確斷言**沒有任何一次 query 是 `UPDATE ... SET del`**——保留 known-legacy-issues.md #10 記載的「與 `del` 旗標語意不一致」現況，未自行統一成軟刪除。

**PUT admin/contact-class/{id} 的「不修改 del」確認**：`updateActive()` 的 `UPDATE` 陳述式固定是 `UPDATE contact_class SET name = ?, no = ? WHERE id = ?`，SQL 文字本身就不包含 `del` 欄位，物理上不可能意外修改它；測試也對 SQL 字串做了精確比對。

**Delete request validation 邊界**：`deleteByIdsSchema` 明確拒絕空陣列、`0`、負數、字串 id、字串陣列——皆有對應測試。**驗證失敗的錯誤格式**：legacy Laravel 的 `destroy()` 沒有 FormRequest（不像 register/contact/contact-class 的 create/update），所以這個 edge case 規格沒有定義專屈格式；依指示「不要自行加入複雜新 semantics」，直接沿用既有 `validateRequest` 的通用 400 `{message,code,requestId}` 格式，而不是套用 `formRequestErrorFormat`。已在 schema 註解中記錄這個判斷依據。

**Frontend compatibility**：靜態重新確認 `deleteContactInfo()`、`addContactClass()`、`UpdateContactClass()`、`deleteSingleContactClass()` 四個函式的 request path/body/response 處理，**與本次實作完全一致，未發現新 mismatch**，沒有任何端點因相容性問題而停止實作。

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
| 9 | GET | `/api/v2/admin/contact` | **DONE** | ✅ | ✅ 是 | ✅ 6 tests | ✅ |
| 10 | GET | `/api/v2/admin/contact/{id}` | **DONE** | ✅ | ✅ 是 | ✅ 4 tests | ✅(已修正 contact_list key) |
| 11 | PUT/PATCH | `/api/v2/admin/contact/{id}` | **DEFERRED / NOT_REQUIRED_BY_CURRENT_UI**(正式決策,見 §11.1 #11/§11.9) + **KNOWN_LEGACY_ISSUE** | ❌ | ❌ 呼叫端存在但 0 call site,完全死碼(見 §11.1 #11 重新確認) | ❌ | ✅(request schema 仍在,但不代表要實作) |
| 12 | DELETE | `/api/v2/admin/contact` | **DONE** | ✅ | ✅ 是 | ✅ 13 tests | ✅ |
| 13 | GET | `/api/v2/admin/contact-list` | **DONE** | ✅ | ❌ 前端未呼叫(只有註解) | ✅ 3 tests | ✅ |
| 14 | GET | `/api/v2/admin/contact-list/{id}` | **DONE** | ✅ | ❌ 前端未呼叫(只有註解) | ✅ 2 tests | ✅ |
| 15 | GET | `/api/v2/admin/contact-class/{id}` | **DONE** | ✅ | ✅ 是 | ✅ 4 tests | ✅ |
| 16 | POST | `/api/v2/admin/contact-class` | **DONE** | ✅ | ✅ 是 | ✅ 7 tests | ✅ |
| 17 | PUT/PATCH | `/api/v2/admin/contact-class/{id}` | **DONE** | ✅ | ✅ 是 | ✅ 7 tests | ✅ |
| 18 | DELETE | `/api/v2/admin/contact-class` | **DONE** | ✅ | ✅ 是 | ✅ 11 tests | ✅ |
| 19 | GET | `/api/v2/admin/contact/search/search-company` | **DONE** | ✅ | ✅ 是 | ✅ 4 tests | ✅ |

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
- **Test**：`tests/integration/faq.test.ts`(7，含 3 支 admin 寫入後立即反映在 public GET 的整合測試)

#### #5b `GET/POST/PUT/DELETE /api/v2/admin/faq` — **Admin management DONE**
- **New Node/Admin feature, not legacy parity requirement.** 沒有已確認的 Laravel admin FAQ API——`frontend/api/faq.ts` 的 `FAQInfoApi.getContact()` 呼叫 `/admin/faq`，但這是死碼（未被任何頁面呼叫），且該路徑不存在於本文件已確認的 19 支規格中（見 §5.3）。本批純粹是為了讓 `/admin/contact/contact_quest` 後台頁面能管理 `faq` 表而新增的功能，不是還原任何 Laravel 行為。
- Node：`src/modules/faq/admin-faq.routes.ts` → `admin-faq.controller.ts` → `admin-faq.service.ts` → 共用 `faq.repository.ts::FaqRepository`(新增 `findAllForAdmin`/`findById`/`create`/`update`/`deleteByIds`)
- Authorization：`authenticate` → `requireAdmin`（掛在 router 層，同 `admin-contact-class` 的作法）
- `GET /admin/faq`：與 public 完全相同的 4 欄位投影/`no DESC`排序（不過濾 `del`），envelope 為 `{ data: [...] }`——這是全新 envelope（既有 admin list 只有 `admin/contact` 的 Laravel 分頁格式可參考，且 `admin/contact-class` 根本沒有 index endpoint），刻意選用簡單陣列 envelope 而非套用分頁格式
- `POST /admin/faq`：`name`/`info`/`no` 皆為必填（Zod + `formRequestErrorFormat`），INSERT 不寫入 `del`，交給 DB 欄位預設值（`faq.del` 實際上是 `DEFAULT NULL`，非 `contact_class.del` 的 `DEFAULT 0`——已在 migration 中確認，寫入邏輯本來就不受影響因為 public GET 從不過濾 `del`）
- `PUT /admin/faq/{id}`：先查存在（`findById`，不過濾 `del`，因為 public 端本來就不過濾），不存在回 404 `{message:'找不到資料'}`；只允許更新 `name`/`info`/`no`，永不寫 `id`/`del`
- `DELETE /admin/faq`：**硬刪除**（真正 `DELETE FROM faq`，非 `del=1`）——比照 `contact_class` 的既有實作（`known-legacy-issues.md` #10 將 `contact_class`／`contact_quest`／`seo`／`faq` 歸為同一類「`del` 旗標與硬刪除 API 並存」的表，且沒有任何已確認的 legacy FAQ admin API 與此牴觸）；existence check + delete 包在同一個 transaction，批次刪除具原子性；共用 `deleteByIdsSchema`(`{ids: number | number[]}`)
- **Cache/資料新鮮度**：目前 FAQ 完全沒有實作任何 cache（見上方 #5 的 `TODO(parity)`），所以 admin 寫入後，下一次 public `GET /api/v2/faq` 立即可見，不需要額外的 cache invalidation 邏輯——`tests/integration/faq.test.ts` 新增 3 支整合測試直接驗證這個行為（新增/修改/刪除後 public GET 立即反映）
- **Test**：`tests/integration/admin-faq.test.ts`(32：401/403/200/ordering/empty list、create success/validation ×4/預設 del 行為、update success/only-allowed-fields/404/validation/bad id、delete single/batch/atomic 404/scalar 404/hard-delete 確認/invalid payload ×5)

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

#### #9 `GET /api/v2/admin/contact` — **DONE**
- Laravel：`ContactController.php` (`index`)
- Node：`modules/contact/admin-contact.routes.ts` → `admin-contact.controller.ts::createAdminListContactHandler` → `admin-contact.service.ts::AdminContactService.listPage` → `contact.repository.ts::ContactRepository.countAll`/`findPage`（共用既有 `ContactRepository`）
- Auth：`authenticate → requireAdmin`（正式決策，見 §10.13——不複製 known-legacy-issues #2 的「只登入即可」漏洞）
- DB query：`SELECT * FROM contact ORDER BY created_at DESC LIMIT ? OFFSET ?` + `SELECT COUNT(*) ...`，`paginate(10)`
- Response：`200` + 完整 Laravel 分頁 envelope（沿用 `laravel-pagination.ts`）
- **Test**：`tests/integration/admin-contact.test.ts` 的 `GET /api/v2/admin/contact` 區塊(6)

#### #10 `GET /api/v2/admin/contact/{id}` — **DONE**
- Laravel：`ContactController.php` (`show`)
- Node：`admin-contact.controller.ts::createAdminGetContactHandler` → `AdminContactService.getById` → `ContactRepository.findById` + `findContactListByContactId`（巢狀組裝）
- DB query：`SELECT * FROM contact WHERE id=?` + `SELECT * FROM contact_list WHERE cid=?`
- Response：`200 {...contact, contact_list:[...]}`——**巢狀 key 已依產品決策確認為 `contact_list`（snake_case），已同步修正 `openapi.yaml`（見 §1.4）**；找不到 `404 {message}`（純訊息，無 code/requestId）
- **Test**：`tests/integration/admin-contact.test.ts` 的 `GET /api/v2/admin/contact/{id}` 區塊(4)，含「絕不出現 camelCase `contactList` key」的專門測試

#### #11 `PUT/PATCH /api/v2/admin/contact/{id}` — **DEFERRED / NOT_REQUIRED_BY_CURRENT_UI**（正式決策，2026-08-26）
- Laravel：`ContactController.php` (`update`)——驗證規則要求完整報名資料，但實際只嘗試寫入不存在的 `name`/`no` 欄位，**生產環境等同無效更新**
- Node：**無，且本階段正式決定不實作**
- **決策理由**（不是「還沒排到」，是明確決定暫不做）：(1) frontend 呼叫端 0 call site，完全死碼；(2) 沒有任何編輯 UI；(3) legacy Laravel 行為本身是已知的 no-op/broken；(4) validation 規則／DB 實際寫入欄位／UI 需求三方互相衝突，無法可靠推導正確行為；(5) 現行產品功能完全不依賴這支 API
- **不得**為了追求 19/19 而自行發明一套新行為。若未來真的需要「編輯報名資料」功能，應該以新的 frontend + backend contract 重新設計，而不是修補這支歷史遺留、從未真正動過的端點

#### #12 `DELETE /api/v2/admin/contact` — **DONE**
- Laravel：`ContactController.php` (`destroy`)
- Node：`admin-contact.controller.ts::createAdminDeleteContactHandler` → `AdminContactService.deleteByIds` → `contact.repository.ts::ContactRepository.deleteByIds`(transaction 包 existence check + delete)
- Request validation：`shared/http/delete-ids.schema.ts::deleteByIdsSchema`（共用），拒絕空陣列/`0`/負數/字串 id
- DB query：`SELECT id FROM contact WHERE id IN (...)` 確認存在性，全部存在才 `DELETE FROM contact WHERE id IN (...)`
- Response：全部刪除成功 `200 {message:"刪除成功"}`；任一不存在 `404`(陣列模式列出全部不存在 id、單值模式只列該 id)
- **特殊規則**：**不可**自行加上級聯刪除 `contact_list`（見已知問題 #9，正式資料庫本就沒有生效外鍵）——**已用測試明確驗證沒有任何一次 query 碰到 `contact_list`**
- **Test**：`tests/integration/admin-contact.test.ts` 的 DELETE 區塊(13)

#### #13 `GET /api/v2/admin/contact-list` — **DONE**
- Laravel：`ContactListController.php` (`index`)
- Node：新模組 `modules/contact-list/`（因為沒有對應的 public resource 可以掛靠）
- DB query：`SELECT * FROM contact_list`（無過濾無分頁）
- Response：`200 {data:[...]}`
- **前端目前未呼叫**——實作優先度最低，純為 parity 完整性補上
- **Test**：`tests/integration/admin-contact-list.test.ts` 的 index 區塊(3)

#### #14 `GET /api/v2/admin/contact-list/{id}` — **DONE**
- 同上，Laravel：`ContactListController.php` (`show`)，Node：`contact-list.repository.ts::findById`，**前端未呼叫**，404 為 `{message:"找不到資料"}`
- **Test**：`tests/integration/admin-contact-list.test.ts` 的 show 區塊(2)

#### #15 `GET /api/v2/admin/contact-class/{id}` — **DONE**
- Laravel：`ContactClassController.php` (`show`)
- Node：`modules/contact-class/admin-contact-class.routes.ts` → `admin-contact-class.controller.ts` → `AdminContactClassService.getByIdActive` → `contact-class.repository.ts::ContactClassRepository.findByIdActive`（共用既有 repository class，新增方法）
- DB query：`SELECT * FROM contact_class WHERE id=? AND del=0`
- Response：`200` 全欄位；`404 {message}`（涵蓋「id 不存在」與「id 存在但 del=1」兩種情況，皆由同一條 SQL 的 `WHERE del=0` 過濾掉）
- **Test**：`tests/integration/admin-contact-class.test.ts`(6，含 401/403/200/SQL 驗證/不存在/del=1 六種情境)

#### #16 `POST /api/v2/admin/contact-class` — **DONE**
- Laravel：`ContactClassController.php` (`store`)
- Node：`admin-contact-class.controller.ts::createAdminCreateContactClassHandler` → `AdminContactClassService.create` → `contact-class.repository.ts::ContactClassRepository.create`
- Request validation：`admin-contact-class.schemas.ts::contactClassWriteRequestSchema`——`name`(string, required)、`no`(integer, required)，`formRequestErrorFormat: true`
- DB query：`INSERT INTO contact_class (name, no) VALUES (?, ?)`——`del` 不出現在欄位清單，讓 DB `DEFAULT 0` 生效，插入後重新 `SELECT * FROM contact_class WHERE id = ?` 取得完整列
- Response：`201 {message:"新增成功", data}`；驗證失敗 `400 {status:"error", message}`
- **Test**：`tests/integration/admin-contact-class.test.ts` 的 POST 區塊(7)

#### #17 `PUT/PATCH /api/v2/admin/contact-class/{id}` — **DONE**
- Laravel：`ContactClassController.php` (`update`)——**這支驗證欄位與實際寫入欄位一致，無疑點**（與 #11 相反）
- Node：`admin-contact-class.controller.ts::createAdminUpdateContactClassHandler` → `AdminContactClassService.updateActive` → `ContactClassRepository.updateActive`
- DB query：先 `SELECT * FROM contact_class WHERE id = ? AND del = 0` 確認存在(不存在或 `del=1` 皆視為 404)，存在才 `UPDATE contact_class SET name = ?, no = ? WHERE id = ?`(SQL 本身不含 `del`，物理上不可能誤改)，再重新 `SELECT` 取得更新後的完整列
- Response：`200 {message:"更新成功", data}`；不存在 `404 {message:"找不到資料"}`
- **Test**：`tests/integration/admin-contact-class.test.ts` 的 PUT 區塊(7)

#### #18 `DELETE /api/v2/admin/contact-class` — **DONE**
- Laravel：`ContactClassController.php` (`destroy`)——**真正硬刪除整列**（即使該表也有 `del` 欄位，語意不一致，見已知問題 #10）
- Node：`admin-contact-class.controller.ts::createAdminDeleteContactClassHandler` → `AdminContactClassService.deleteByIds` → `ContactClassRepository.deleteByIds`(transaction 包 existence check + delete，邏輯與 #12 相同模式)
- DB query：`SELECT id FROM contact_class WHERE id IN (...)` 確認存在，全部存在才 `DELETE FROM contact_class WHERE id IN (...)`——**真正的 `DELETE`，不是 `UPDATE ... SET del=1`**，已用測試明確驗證沒有任何一次 query 是帶 `del` 的 `UPDATE`
- Response：同 #12 的訊息格式(陣列列出全部不存在 id / 單值列出該 id)
- **Test**：`tests/integration/admin-contact-class.test.ts` 的 DELETE 區塊(11)

#### #19 `GET /api/v2/admin/contact/search/search-company` — **DONE**
- Laravel：`ContactController.php` (`searchCompany`)
- Node：`admin-contact.controller.ts::createAdminSearchContactHandler` → `AdminContactService.searchByCompany` → `ContactRepository.countByCompany`/`findByCompanyPage`
- DB query：`SELECT * FROM contact WHERE company LIKE ? LIMIT ? OFFSET ?`（參數化），`paginate(10)`；**無 ORDER BY**——規格沒有記載排序，未自行假設(見 §1.4)
- Response：`200` + 完整 Laravel 分頁 envelope
- **Test**：`tests/integration/admin-contact.test.ts` 的 search-company 區塊(4)，含一則明確驗證萬用字元/類 SQL injection 字串只作為參數化值、不改變 SQL 結構的測試

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
| | admin authorization | **完全沒有 is_admin 檢查** | ✅ **已實作於 6 支唯讀端點**——`admin-contact.routes.ts`/`admin-contact-class.routes.ts`/`contact-list.routes.ts` 皆用 `router.use(authenticate, requireAdmin)`，401/403/200 三層皆有測試覆蓋；已在 §10.13 正式記錄未來所有 admin/* 都必須遵循同一模式，不得複製 legacy 的無檢查行為 | **DONE(已實作 6 支)/待擴及其餘 admin 端點** |
| **Contact** | create | insert + 無 transaction | ✅ 已實作,且改用 transaction(見 §1.2) | **DONE** |
| | ContactList nested create | 逐筆 insert,略過無 email 項目 | ✅ 已實作;略過邏輯保留但因 Zod 已要求 email,目前不可觸發(見 §1.2 validation parity 確認結果) | **DONE** |
| | company search | LIKE 模糊搜尋 | ✅ 已實作(`admin/contact/search/search-company`)，無 ORDER BY(規格未記載) | **DONE** |
| | admin Contact endpoints | 5 支(index/show/update/delete/search) | index/show/search/delete 4 支已實作；update(`PUT admin/contact/{id}`) 正式 DEFERRED(§11.1 #11) | **4/5 DONE、1 DEFERRED** |
| | mail notification | 硬編碼收件人,非同步 queue | ✅ 已實作(同步 Nodemailer);收件人改為 `RECIPIENT_EMAIL` 環境變數(修正已知問題 #11);**非同步 queue 未實作** | **DONE(同步)/PARTIAL(queue)** |
| | transaction behavior | **無 transaction**(已知問題) | ✅ 已實作,`contact`+`contact_list` 包在同一 transaction,任一失敗即 rollback(intentional reliability improvement) | **DONE** |
| **ContactClass** | CRUD | 5 支 | 公開 `index`、admin `show`/`store`/`update`/`delete` 全部已實作 | **5/5 DONE** |
| | soft delete / del flag | 讀取端點過濾 `del=0` | ✅ `index` 已過濾 `del=0`,與規格一致 | DONE(僅 index) |
| | bulk delete | 硬刪除,批次模式 | 未實作 | NOT_IMPLEMENTED |
| **ContactList** | index/show | 2 支,無過濾 | ✅ 已實作(`modules/contact-list/`)，前端目前未使用 | **DONE** |
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
| `pages/admin/contact/index.vue` 等 → `getContact` | `GET /admin/contact` | ✅ 已實作 | ✅ 可用 |
| `pages/admin/contact/[id].vue` → `getSingleContact` | `GET /admin/contact/{id}` | ✅ 已實作(`contact_list` key 已對齊前端) | ✅ 可用 |
| `updateContactInfo` | `PUT /admin/contact`（**缺少 `{id}`，且 0 call site**） | 正式 DEFERRED(§11.1 #11) | 不適用——此呼叫從未被任何 UI 觸發，backend 暫不支援對現有功能零影響 |
| `deleteContactInfo` | `DELETE /admin/contact` | ✅ 已實作 | ✅ 可用 |
| `searchContactInfo` | `GET /admin/contact/search/search-company` | ✅ 已實作 | ✅ 可用 |
| `getSingleContactClass` | `GET /admin/contact-class/{id}` | ✅ 已實作 | ✅ 可用 |
| `addContactClass` | `POST /admin/contact-class` | ✅ 已實作 | ✅ 可用 |
| `UpdateContactClass` | `PUT /admin/contact-class/{id}` | ✅ 已實作 | ✅ 可用 |
| `deleteSingleContactClass` | `DELETE /admin/contact-class` | ✅ 已實作 | ✅ 可用 |
| `FAQInfoApi.getContact`(**未被任何頁面呼叫**) | `GET /admin/faq`（**此路徑不存在於 19 支規格中**） | 無 | 死碼,非缺口(見 5.3) |
| (無呼叫) | `GET /admin/contact-list` | ✅ 已實作 | 前端未使用,非阻斷 |
| (無呼叫) | `GET /admin/contact-list/{id}` | ✅ 已實作 | 前端未使用,非阻斷 |

### 4.2 Frontend 使用中但 Backend 尚未實作的 endpoint

第七階段（Admin CUD Batch）實作後，**0 / 19 支**前端有實際呼叫的端點仍缺 backend 實作(第六階段後剩 4 支，本階段全部補上：`DELETE admin/contact`、`POST admin/contact-class`、`PUT admin/contact-class/{id}`、`DELETE admin/contact-class`)。前端目前實際呼叫的每一支 admin API 都已對接完成；唯一仍未實作的 `PUT admin/contact/{id}`(舊 API #11)因為 §11.1 已確認前端呼叫端是 0 call site 的死碼，不落在「前端使用中」的統計裡。

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

### 4.8 第六階段 Admin Batch 1（6 支唯讀端點）frontend 相容性檢查結果

靜態重新比對 `pages/admin/contact/index.vue`、`pages/admin/contact/[id].vue`、
`pages/admin/contact/class/[id].vue`、相關 `api/signedUpClass.ts` 函式：

- **endpoint path**：`GET admin/contact`、`GET admin/contact/{id}`、`GET admin/contact/search/search-company`、`GET admin/contact-class/{id}` 四支皆一致
- **query**：`page`/`company` 參數名稱與型別一致
- **response**：`ContactData`/`ContactClass` 型別逐欄位比對一致；**`GET admin/contact/{id}` 的 `contact_list` 巢狀 key 現在完全對齊**（這正是本批修正的項目——修正前若照 openapi 原文實作會導致 `[id].vue` 的「參加人員名單」表格靜默空白）
- **pagination**：與 `admin/contact` 索引頁的分頁邏輯（`currentPage`/`displayedPages`）相容
- **frontend 不需要同步修改**：確認無誤，**未發現任何新的 mismatch**（`updateContactInfo` 的既有問題已於 §11.1 #11 記錄為死碼，非本批新發現）

### 4.9 第七階段 Admin CUD Batch（4 支寫入端點）frontend 相容性檢查結果

靜態重新確認 `api/signedUpClass.ts` 的 `deleteContactInfo()`、`addContactClass()`、`UpdateContactClass()`、`deleteSingleContactClass()` 四個函式：

- **`deleteContactInfo({ids})`**：前端在呼叫前一律先把單一數字正規化成陣列(`if (!Array.isArray(ids)) ids=[ids]`)，與 backend 支援 `number|number[]` 的 schema 相容；`$http('delete', 'admin/contact', ids)` 把整個 `{ids}` 物件當作 axios 的 `data` 送出，`express.json()` 對 DELETE 方法一樣會解析 body，無相容性問題
- **`addContactClass({name,no})`**：欄位名稱與型別與 `contactClassWriteRequestSchema` 完全一致
- **`UpdateContactClass(id,{name,no})`**：id 在 URL path、body 只有 `{name,no}`，與 `PUT /admin/contact-class/{id}` 的實作完全一致
- **`deleteSingleContactClass({ids})`**：同 `deleteContactInfo`，永遠陣列形式
- 全部四個函式的呼叫端都只檢查回傳值是否 truthy(`if(res){...}`)，不比對回應內容的具體欄位，因此 response shape 的微小差異也不會造成前端行為變化
- **frontend 不需要同步修改**：確認無誤，**未發現任何 mismatch**，沒有任何端點因相容性問題而暫停實作

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
| Integration tests | `auth-login.test.ts`(13)、`auth-register.test.ts`(11)、`auth-logout.test.ts`(6)、`seo.test.ts`(5)、`faq.test.ts`(4)、`contact-class.test.ts`(5)、`contact-quest.test.ts`(9)、`contact.test.ts`(14)、`admin-contact.test.ts`(33，本階段擴充)、`admin-contact-class.test.ts`(31，本階段擴充)、`admin-contact-list.test.ts`(9)+ 基礎設施類測試(`env`(23)/`error-handler`/`graceful-shutdown`/`health`/`not-found`/`ready`/`validate-request`) |
| **完全缺少測試的 API** | **1 / 19 支**（僅 `PUT admin/contact/{id}`，正式 DEFERRED，不需要測試，原本 5 支） |
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
6.5 ~~**`admin/*` 開始實作前的建議前置工作**~~ —— 純 API 角度已在第六/七階段直接開始並完成下列 admin 端點；**frontend auth improvement(§10.13 清單)本身仍未開始**，不受此影響，維持獨立任務
7. ~~**`GET/DELETE /api/v2/admin/contact`** + **`GET /api/v2/admin/contact/{id}`** + **`GET /api/v2/admin/contact/search/search-company`**~~ —— **已於第六/七階段完成**(GET 三支於 Batch 1，DELETE 於 Batch 2)
8. ~~**`admin/contact-class` 全部 4 支**~~ —— **已於第六/七階段完成**(GET show 於 Batch 1，POST/PUT/DELETE 於 Batch 2)
9. **`PUT /api/v2/admin/contact/{id}`** —— **正式決策維持 DEFERRED / NOT_REQUIRED_BY_CURRENT_UI**(§11.9)，不是「排在最後」的待辦，是主動決定不做；因為必須先等需求方針對 known-legacy-issues.md #1 做出決策,且前端呼叫本身是 0 call site 的死碼(§11.1 #11 重新確認)
10. ~~**`admin/contact-list` 2 支**~~ —— **已於第六階段完成**

**已無待實作的 admin API(除 #11 外)。跨端點的前置決策(需求方決定,非技術問題，僅列出仍未拍板的項目)**：
- known-legacy-issues #1（`PUT /admin/contact/{id}` 真正該更新什麼——**唯一仍卡住的決策項**）
- ~~known-legacy-issues #2（admin/* 是否要補上真正的 is_admin 檢查）~~ —— **已決策並實作**：一律 `authenticate → requireAdmin`
- known-legacy-issues #6（`seo`/`faq` 的 `del` 未過濾是否為疏漏——目前維持現況，未被要求修正）
- known-legacy-issues #10（`contact-class` 硬刪除 vs `del` 軟刪除語意是否統一——目前維持現況硬刪除，未被要求修正）
- ~~Mail/Queue 技術選型~~ —— **已於第四階段決定**：Mail 採 Nodemailer 同步寄信；Queue 刻意排除在本階段外，若未來需要非同步化(例如寄信對外部 SMTP 延遲敏感)，需另開任務評估 BullMQ+Redis 等方案

---

## 9. Production Cutover Criteria

**以下條件必須全部滿足，才可以考慮以 Node backend 取代 Laravel：**

| # | 條件 | 目前狀態 |
|---|---|---|
| 1 | frontend 使用中的 API 全部 DONE | ✅ **達成**——前端目前實際呼叫的每一支端點都已實作(`PUT admin/contact/{id}` 的呼叫端是 0 call site 的死碼，不計入「使用中」，見 §11.1 #11) |
| 2 | auth flow 完整(login/register/logout 皆可用) | ✅ **達成**——backend API DONE，frontend auth UX 已於 2026-08-27 跟上：login token persistence、axios 動態 Authorization header、logout UI、401 自動清 token + 導頁、`/admin/*` route guard 皆已實作（見 §10.14）。register 仍無前端 UI，但這是刻意保留的產品決策（見 §10.14），並非缺口——現有 UI 從未依賴 register。**admin frontend authentication UX 一併達成。** |
| 3 | admin authorization 確認 | ✅ **達成**——所有已實作的 admin 端點(10 支：6 支唯讀 + 4 支寫入)全部套用 `authenticate → requireAdmin`，401/403/200 三層皆有測試覆蓋；唯一未套用的是正式 DEFERRED、根本沒有實作的 `PUT admin/contact/{id}` |
| 4 | database schema compatible | ✅ 已完成(`backend/migrations/` 與 database-schema.md 一致，本階段也未修改 schema) |
| 5 | mail confirmed | ⚠️ 進行中：`POST /contact` 的同步 Mail 已 DONE,但原始模板內容/排版是重建品非逐字複製(已知缺口，見 §1.2)。**2026-08-27 重新評估**：模板差異已重新分類為 `DEFERRED_NON_BLOCKING`（不影響資料正確性，只影響內部收件人看到的排版），**不再視為 cutover blocker**，細節與唯一待確認例外（內部信箱是否有格式依賴的自動化規則）見 `specs/backend/staging-deployment-readiness.md` §10.3 |
| 6 | queue confirmed | ⚠️ 刻意 deferred(本階段任務範圍明確排除,`POST /contact` 用同步寄信)。**2026-08-27 重新評估**：從 observable behavior/data correctness/reliability/traffic scale 四個角度重新判斷，已重新分類為 `DEFERRED_NON_BLOCKING`——DB 寫入與寄信失敗完全解耦、資料正確性不受影響，唯一風險是 SMTP 緩慢時的回應延遲（低流量場景下影響有限），**不再視為 cutover blocker**，細節見 `staging-deployment-readiness.md` §10.2 |
| 7 | cache confirmed | ⚠️ FAQ 24hr cache 仍未實作(API 行為本身已 DONE)。**2026-08-27 重新評估**：無 cache 在資料新鮮度上其實優於 legacy 的 24hr 過時窗口，且此頁面流量規模不構成 DB 負載風險，已重新分類為 `DEFERRED_NON_BLOCKING`，**不再視為 cutover blocker**，細節見 `staging-deployment-readiness.md` §10.1 |
| 8 | CORS confirmed | ⚠️ **仍未達成，維持保留**——機制已就緒且已於 2026-08-27 完成完整的 code/config readiness 稽核（見 `specs/backend/production-env-readiness.md`，含正式 origin 清單建議、wildcard+credentials 檢查、www 重導向分析），但**尚未在 Zeabur 實際設定** `CORS_ALLOWED_ORIGINS`，也尚未經過 production 實測；readiness 稽核不等於 production verification，不得視為達成 |
| 9 | backend tests passed | ✅ 193/193 全數通過(本階段從 155 增加到 193),覆蓋率提升到 18/19 端點(16 完全 DONE + 2 帶已知缺口) |
| 10 | frontend build passed | ✅ `npm run build` 通過(與 API 是否可用無關,純建置檢查；本階段未修改 frontend) |
| 11 | staging integration test passed | ❌ 尚未進行(backend 功能仍不足,無法有意義地跑 staging 測試) |

**目前 11 項中 6 項達成、2 項進行中(schema/build/測試綠燈、frontend API 覆蓋率、admin 授權、auth flow 皆已達成；mail/CORS 有進展但帶明確保留)，其餘 3 項仍未達成(queue/cache/staging test)。⚠️ 6/11 達成**不代表 production cutover 已 ready**——`queue confirmed`、`cache confirmed`、`staging integration test passed` 三項完全沒有進展，這是本輪明確要求不能因為 frontend auth UX 完成就一併虛報的項目。核心剩餘阻礙：FAQ cache、Contact Queue、CORS 正式 origin、production 環境變數驗證、Mail 模板逐字複製、staging test。**

**2026-08-27 補充——Monorepo Staging Deployment Readiness**：`queue confirmed`/`cache confirmed`/`mail confirmed` 這三項的「未達成」狀態，已依 observable behavior / data correctness / reliability / traffic scale 四個角度重新評估並**重新分類**（不是重新實作，程式碼行為完全沒變），三項皆判定為 `DEFERRED_NON_BLOCKING`——即在目前功能 parity 已正確的前提下，這些是 cutover **之後**可以再處理的 hardening/優化項，不是擋住上線的真正 blocker，完整推理見 `specs/backend/staging-deployment-readiness.md` §10.1/§10.2/§10.3。**這不代表這三項變成 DONE**（FAQ cache、Contact Queue、逐字模板都還是沒有實作），只是判斷它們不應該再被算進「production 是否 ready」的阻斷清單。真正仍然阻斷 cutover 的是：CORS 正式 origin 尚未在 Zeabur 設定、staging integration test 完全沒有執行過（`staging-deployment-readiness.md` 已完成 readiness 分析與 E2E checklist 規劃，但**尚未有 staging 環境可供實際測試**）、以及一系列只能在 Zeabur 平台本身確認的項目（Zeabur MySQL SSL 需求、`PORT` 注入行為、frontend 自動偵測部署是否真的成功）。**上述皆為分析/規劃結果，不是 staging 或 production 已驗證，不得標記為 DONE。**

**2026-08-27 補充**：CORS 與 production 環境變數已完成完整的 code/config readiness 稽核，詳見 `specs/backend/production-env-readiness.md`（backend/frontend env matrix、CORS origin 清單、Zeabur service env checklist、deployment blockers、manual verification steps）。**這些都只是程式碼/設定面的稽核結果，不是 production 已驗證——CORS/mail/env 在此列表中的狀態不因此稽核而改變為達成。**

**2026-08-27 補充（同日，後續批次）——Frontend Env/Config Hardening**：上一段記錄的 frontend 部署阻斷項（`vite.define: {'process.env': process.env}` 沒有 allowlist、`NUXT_API_BASE_URL` 疑似必須 build-time 注入）**已修正**，改用 Nuxt 標準 `runtimeConfig.public` 機制（`NUXT_PUBLIC_API_BASE_URL`/`NUXT_PUBLIC_SITE_URL`/`NUXT_PUBLIC_GTM_ID`），並實測確認**只需 runtime（container 啟動時）注入即可，不需要 build-time 綁定**；`frontend/README.md` 與 `.env.example` 已同步更新為一致的變數名稱。詳細實作紀錄與 Zeabur 部署方式建議（優先採用 Nuxt 自動偵測，非自建 Dockerfile）見 `specs/backend/production-env-readiness.md` §11。`frontend/` 仍然沒有 Dockerfile，部署方式仍待有 Zeabur 存取權限的人實際拍板與部署驗證——**這件事本身沒有因為本批而變成 DONE**，只是阻斷等級從 🔴 降為 🟡（build-time 綁定的急迫性已解除）。CORS 正式 origin 設定、Zeabur production 實測、staging test 三項**完全未受本批影響**，維持原狀，不得視為達成。

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

**⚠️ 不算完整 production-ready 的原因（歷史記錄，寫於本節產出當下）**：backend 這三支 API 全部完成、全部測試通過，但**auth flow 作為一個整體體驗，仍未 production-ready**，因為 frontend 完全沒有跟進。以下是下一個獨立 frontend 任務需要達成的清單（本階段明確排除，未修改任何 frontend 檔案）：

- [x] login 成功後，JWT 存入 `localStorage`（目前已經有做，維持現況）
- [x] 重新整理頁面後仍能從 `localStorage` 取得 token 並視為已登入
- [x] 關閉並重新開啟瀏覽器後，只要 token 未過期，仍保持登入狀態
- [x] `axios`/`utils/http.ts` 改成**每次 request 動態讀取** `localStorage` 的 token,而不是在 instance 建立時只讀一次（見 §10.4 已記錄的既有限制）
- [x] 新增登出 UI(按鈕/選單項目),呼叫 `POST /auth/logout`，並清除 `localStorage` 的 token
- [x] API 回傳 `401` 時，自動清除失效的 `localStorage` token 並導回 `/auth`(目前只有 `alert('請先登入')`,不會清 token 或導頁)
- [x] `/admin/*` 加上 frontend route guard(目前頁面殼會直接渲染,不檢查 token)

**以上清單已於 2026-08-27 全數完成，實作結果見 §10.14。** 本節其餘文字（含以上核取方塊）保留原樣供追溯，不代表目前現況。

---

### 10.14 Frontend Auth UX 實作結果（2026-08-27）

> 本節記錄 §10.13 清單的實際實作。**本批只修改 `frontend/`，未修改任何 backend 檔案**——靜態分析過程中沒有發現需要回報的 contract mismatch（唯一已知的既有 mismatch，`updateContactInfo` 呼叫 `PUT admin/contact` 缺少 `{id}`，本來就是 0 call site 的死碼，維持不動，見 §11.1 #11／§4.3）。

**修改/新增檔案**：
- `frontend/store/useAuthStore.ts`（修改）—— `token` 改為由一個內部 `tokenVersion` ref 驅動的 `computed`（而非直接把 token 存成 `ref`）：`setToken()` 寫入/清除 `localStorage` 後遞增 `tokenVersion`，讓 `token` 重新求值、重新讀取 `localStorage`。維持 `computed`（而非 plain `ref`）是刻意的——Pinia setup store 只會把 `ref`/`reactive` 狀態序列化進 SSR payload 並在 client hydration 時寫回，`computed` 的回傳值不在序列化範圍內；如果 `token` 直接是一個 `ref`，server 端永遠讀不到 `localStorage`（只能是 `null`），client hydration 時就會用這個 `null` 覆蓋掉 client 自己剛從 `localStorage` 讀到的真實 token。
- `frontend/utils/http.ts`（修改）—— 移除在 axios instance 建立時只讀一次 token 的靜態 header；改用 `ajax.interceptors.request.use()`，每次 request 送出前才讀 `localStorage.getItem('token')`；沒有 token 時完全不帶 `Authorization` header(不會送出 `Bearer null`/`Bearer undefined`/`Bearer `)。`isResponseOK()` 的 401 分支改為呼叫 `handleAuthFailure()`：清除 `localStorage` token、導向 `/auth`；用一個模組層級的旗標避免同時發生的多個 401 重複跳出 `alert`；且明確排除「目前已經在 `/auth` 頁面」的情況（避免把登入頁本身的帳密錯誤 401 誤判成 session 過期，也避免 redirect loop）。
- `frontend/api/auth.ts`（修改）—— 修正 `register()` 沒有把 `data` 傳給 `$http` 的既有 bug(§10.13/§4.3 已記載的死碼 bug，call site 仍是 0，純粹修正呼叫本身)；`login()` 移除內部直接寫 `localStorage` 的動作(原本與呼叫端 `authStore.setToken()` 是兩個 write path，現在只保留一個)；新增 `logout()`，呼叫 `POST /auth/logout` 並在 `catch` 中吞掉任何錯誤(stateless JWT，backend 請求失敗與否都不能阻擋 client 端登出)。
- `frontend/pages/auth.vue`（修改）—— 登入成功流程不變(已經是呼叫 `authStore.setToken()`，不是自己寫 `localStorage`)，只把導頁方式從 `router.push()` 改成 `navigateTo()`，並移除不再使用的 `useRouter()`。
- `frontend/middleware/auth.global.ts`（新增）—— 全域 middleware，只在 `to.path` 以 `/admin` 開頭時生效；`process.server` 時直接放行(SSR 沒有 `localStorage`，交給 client 端重新檢查)；client 端沒有 token 時 `return navigateTo('/auth')`。**明確只做 token 是否存在的檢查，不 decode JWT、不判斷 `isAdmin`**——真正的 authorization 邊界仍在 backend 的 `authenticate → requireAdmin`。
- `frontend/components/admin/NavBarComponent.vue`（修改）—— 在 admin sidebar(所有 `layout: 'admin'` 頁面共用)新增「登出」按鈕，`try { await AuthApi.logout() } finally { authStore.setToken(null); await navigateTo('/auth') }`。

**Token storage architecture**：`localStorage` 是唯一持久化來源，寫入/清除只透過 `useAuthStore().setToken()` 這一個函式(登入時 `pages/auth.vue` 呼叫、登出時 `NavBarComponent.vue` 呼叫)。Pinia 的 `token` computed 是給元件用的 reactive interface，不是第二個 truth source。`utils/http.ts` 的 axios interceptor 刻意繞過 Pinia store,直接讀 `localStorage`——這樣不管呼叫堆疊上有沒有可靠的 Nuxt/Vue instance context,都能拿到當下最新的 token。

**axios Authorization 改法**：從「建立 instance 時的靜態 header」改成「`interceptors.request.use()` 內每次動態讀取、動態設定/刪除」，這是 §10.13 記載的既有 bug 的直接修正——原本的寫法只在 module 第一次載入時求值一次,登入後拿到的新 token 永遠不會反映到已建立的 header 上。

**SSR safety**：所有存取 `localStorage` 的地方都用既有的 `process.client`(與 `store/useAuthStore.ts`、`api/auth.ts` 既有慣例一致，未改用 `import.meta.client` 以維持風格一致)或 `process.server` 判斷式包住；`middleware/auth.global.ts` 對 `process.server` 直接 return，`utils/http.ts` 的 interceptor 與 `handleAuthFailure()` 都對 `process.client` 判斷式包住才存取 `localStorage`/`window`。已用 `npm run build`(SSR + client 雙 bundle)與 `npm run dev` 起本機伺服器實際 `curl http://localhost:3000/admin/contact`、`curl http://localhost:3000/auth` 驗證,SSR render 完全正常,dev server log 中沒有任何 `ReferenceError`/`localStorage is not defined`。

**Logout UI 位置與行為**：`components/admin/NavBarComponent.vue`(admin sidebar,`layouts/admin.vue` 掛載,所有 `definePageMeta({layout:'admin'})` 頁面共用)。行為：無論 `POST /auth/logout` 成功、失敗、或整個 network request 失敗,`finally` block 保證一定會 `setToken(null)` 清除 `localStorage` 並 `navigateTo('/auth')`——因為 backend 是 stateless JWT(§10.9/§10.11),真正的「登出」本來就是 client 端清掉 token,不是 server 端做了什麼。

**401 handling**：`isResponseOK()` 內的 401 分支從單純 `alert('請先登入')` 改成「清 `localStorage` token → (最多一次)`alert` → `navigateTo('/auth')`」。用模組層級的 `authFailureAlertShown` 旗標防止同時發生的多個 401(例如同一頁面平行送出多支 admin API 請求,token 剛好過期)重複跳出多個 `alert`；並且明確排除「目前已經在 `/auth`」的情況,避免登入頁本身帳密錯誤的 401 被誤判成 session 過期而彈出誤導性訊息或導致 redirect loop。

**Admin route guard**：`middleware/auth.global.ts`,只檢查 `localStorage` 是否有 token,**不 decode JWT、不做 `isAdmin` 判斷**——明確定位為 UX guard,不是 security boundary(真正邊界仍是 backend `authenticate → requireAdmin`,見 §10.13 原始需求文字)。未使用任何新 dependency。

**登入流程**：`pages/auth.vue` 登入成功後呼叫 `authStore.setToken(res.token)`(原本就是這樣做,不是本次新增),再 `navigateTo('/admin/contact')`；後續所有 admin API request 由 `utils/http.ts` 的 axios interceptor 在送出前自動從 `localStorage` 讀取剛寫入的新 token。**可測試性**：`utils/http.ts` 的 interceptor 與 `handleAuthFailure()` 都是可以獨立呼叫、不依賴元件生命週期的純函式/interceptor callback,原則上可被單元測試覆蓋；但 frontend 目前沒有正式 test framework(§10.13/本節任務範圍明確排除導入大型測試框架),因此本階段以 `npm run build` + `npm run dev` 起本機伺服器手動驗證 login → setToken → admin API request → Authorization header 帶新 token 的行為,未寫自動化測試。

**Register dead-code bug**：`AuthApi.register()` 沒有把 `data` 傳給 `$http` 的 bug 已修正(單行、風險低、契約明確)。**register 前端頁面本身依然刻意不存在**——backend `POST /auth/register` 已支援(見 §10.13),但沒有任何 UI 呼叫這個函式,這是本階段明確保留的產品決策,不是遺漏。

**Build / typecheck 結果**：
- `npm ci`：✅ 成功(1144 packages)
- `npm run build`：✅ 成功(SSR + client 雙 bundle 皆建置完成,`.output/server/index.mjs` 產出)
- `npx nuxi typecheck`：❌ **既有 baseline 缺口,非本次修改造成**——frontend `package.json` 從未把 `typescript` 列為 dependency,`npx vue-tsc` 因此連 `typescript/lib/tsc` 都 resolve 不到,直接在 vue-tsc 自己的 module resolution 階段就掛掉,與本次程式碼改動無關。依指示記錄此 baseline failure,不修改 TypeScript 設定。

**Frontend/backend contract compatibility**：`POST /auth/login`、`POST /auth/logout`、`POST /auth/register` 三支呼叫的 path/method/response shape 皆與 `specs/shared/api-contracts/openapi.yaml` 及 backend 現有實作一致,靜態比對未發現新的 contract mismatch,未修改任何 backend 檔案。

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

### 11.9 實作結果（Admin Batch 1，2026-08-26）

> §11.1–§11.8 是分析階段的紀錄，保留原樣供追溯；以下記錄 Batch 1 實際採用的決策與實作結果。

**已完成（DONE）**：#9 `GET admin/contact`、#10 `GET admin/contact/{id}`、#13 `GET admin/contact-list`、#14 `GET admin/contact-list/{id}`、#15 `GET admin/contact-class/{id}`、#19 `GET admin/contact/search/search-company`——共 6 支，全部套用 `authenticate → requireAdmin`，155 個測試全過（含每支端點的 401/403/200 三層授權測試）。詳細實作紀錄見 §1.4，逐端點的最終狀態已同步更新到 §2.1/§2.2。

**`contact_list` contract correction**：依產品決策正式採用，`openapi.yaml` 已同步修正（見 §1.4），不是「暫時繞過」而是文件本身的永久更正。

**`PUT /admin/contact/{id}`（#11）最終決策**：**DEFERRED / NOT_REQUIRED_BY_CURRENT_UI**，正式定案，不算「忘記實作」的 NOT_IMPLEMENTED，也未被排入 Batch 2/3 的任何排程。若未來業務需求變化，需要重新走一次需求確認流程（含前端編輯 UI 設計），而不是直接「補上」這支端點。

**尚未排入本批（留給 Batch 2/3）**：#12 `DELETE admin/contact`、#16 `POST admin/contact-class`、#17 `PUT admin/contact-class/{id}`、#18 `DELETE admin/contact-class`——依 §11.5 原定的 Batch 2/3 順序，下次可直接接續。

---

### 11.10 實作結果（Admin CUD Batch，2026-08-26）

> §11.1–§11.8 是分析階段的紀錄，保留原樣供追溯；以下記錄 §11.5 所述 Batch 2/3（Admin CUD Batch）實際採用的決策與實作結果，銜接 §11.9 的 Batch 1。

**已完成（DONE）**：#12 `DELETE admin/contact`、#16 `POST admin/contact-class`、#17 `PUT admin/contact-class/{id}`、#18 `DELETE admin/contact-class`——共 4 支，全部套用 `authenticate → requireAdmin`，新增 38 個測試（`admin-contact.test.ts` +13、`admin-contact-class.test.ts` +25）。詳細實作紀錄見 §1.5，逐端點的最終狀態已同步更新到 §2.1/§2.2。

**Delete transaction 行為**：`deleteByIds`（`contact` 與 `contact_class` 共用模式）用既有 `withTransaction` 包住「existence check + delete」，任一 id 不存在則整批不刪除、不送出 DELETE 查詢——這是刻意的可靠性改善，但 observable behavior 與 legacy 完全一致（陣列模式列出全部缺失 id、單值模式回傳該 id 的 404 訊息格式）。

**known-legacy-issues #9／#10 現況保留確認**：`DELETE admin/contact` 不 cascade 刪除 `contact_list`（測試已斷言沒有任何一次 query 碰到 `contact_list`）；`DELETE admin/contact-class` 是真正硬刪除，即使該表有 `del` 欄位也未改成軟刪除（測試已斷言沒有任何一次 query 是 `UPDATE ... SET del`）。兩者皆依 §11.4 的決策維持現況，未自行修正。

**`PUT admin/contact-class/{id}` 驗證欄位一致性確認**：延續 §11.1 #17 的結論（此支是唯一被規格明確排除「有疑點」的 update 端點），實作的 `UPDATE contact_class SET name = ?, no = ? WHERE id = ?` 不含 `del` 欄位，物理上不可能誤改，與驗證規則、UI 需求三方一致，無需走 REQUIRES_PRODUCT_DECISION。

**`PUT /admin/contact/{id}`（#11）**：本批未變動，維持 §11.9 記錄的 DEFERRED / NOT_REQUIRED_BY_CURRENT_UI 決策，未排入本批。

**Batch 2/3 完成後端點總覽**：§11.5 原定的 Batch 2（#16/#17）與 Batch 3 中的 #12/#18 均已完成；Batch 3 中的 #11 依決策維持 DEFERRED，不算未完成項目。19 支 Laravel API 中，18 支已 DONE（含 2 支帶已知非功能性缺口）、1 支正式 DEFERRED，無任何 NOT_IMPLEMENTED。

---

## 附錄：資料來源

- `specs/shared/api-contracts/api-specification.md`、`api-business-logic.md`、`openapi.yaml`、`auth-login.md`
- `specs/backend/migration-history/known-legacy-issues.md`、`database-schema.md`
- `backend/src/`（全部 routes/modules/middleware/infrastructure）
- `backend/tests/`（全部 unit/integration）
- `backend/docker-compose.yml`（確認無 Redis service）
- `frontend/api/`、`frontend/store/`、`frontend/pages/`（含 `pages/admin/contact/*.vue` 逐檔重新確認呼叫端）、`frontend/components/`、`frontend/layouts/`、`frontend/utils/http.ts`
- `specs/shared/api-contracts/openapi.yaml` 完整 9 個 admin path 定義（§11 專用）
