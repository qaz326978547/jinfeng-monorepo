# Node.js 實作清單（node-api-implementation-checklist.md）

> 每個 API 一個 checklist 項目，只描述新專案需要完成的東西，不再對照 Laravel controller。
> `Implementation status` 請在開始開發後自行更新為 `Not Started` / `In Progress` / `Done`。

## 1. `getSeoList`

- **Method / Path**：`GET /api/v2/seo`
- **Zod params schema**：無
- **Zod query schema**：無
- **Zod body schema**：無
- **Response schema**：`z.array(SeoSchema)`
- **Controller**：`seo.controller.ts#list`
- **Service**：`SeoService.list()`
- **Repository**：`SeoRepository.findAll()`
- **Database tables**：`seo`
- **Authentication required**：否
- **Authorization required**：否
- **Integration test**：查詢回傳 `seo` 全表資料，欄位齊全
- **Contract test**：response 符合 `openapi.yaml` 的 `Seo` schema
- **Implementation status**：Not Started

## 2. `getContactClassList`

- **Method / Path**：`GET /api/v2/contact-class`
- **Zod query schema**：無
- **Zod body schema**：無
- **Response schema**：`z.array(ContactClassSchema)`
- **Controller**：`contactClass.controller.ts#list`
- **Service**：`ContactClassService.list()`
- **Repository**：`ContactClassRepository.findAllActive()`（`del = 0`，`ORDER BY no DESC`）
- **Database tables**：`contact_class`
- **Authentication required**：否
- **Authorization required**：否
- **Integration test**：已刪除（`del=1`）的資料不應出現在結果中
- **Contract test**：response 符合 `ContactClass` schema
- **Implementation status**：Not Started

## 3. `getContactQuestList`

- **Method / Path**：`GET /api/v2/contact-quest`
- **Zod query schema**：`z.object({ page: z.coerce.number().int().positive().optional() })`
- **Response schema**：`PaginatedSchema(ContactQuestSchema)`
- **Controller**：`contactQuest.controller.ts#list`
- **Service**：`ContactQuestService.list(page)`
- **Repository**：`ContactQuestRepository.findAllActivePaginated()`
- **Database tables**：`contact_quest`
- **Authentication required**：否
- **Authorization required**：否
- **Integration test**：分頁 envelope 欄位齊全（`current_page`/`data`/`total`/...）
- **Contract test**：response 符合共用 `PaginatedResponse` schema
- **Implementation status**：Not Started

## 4. `createContact`

- **Method / Path**：`POST /api/v2/contact`
- **Zod body schema**：`ContactCreateSchema`（見 `openapi.yaml` 的 `ContactCreateRequest`）
- **Response schema**：`{ message: z.string(), data: ContactSchema }`
- **Controller**：`contact.controller.ts#create`
- **Service**：`ContactService.create(input)`（**建議加上 DB transaction 包住 contact + contact_list 寫入**）
- **Repository**：`ContactRepository.create()`, `ContactListRepository.createMany()`
- **Database tables**：`contact`, `contact_list`
- **Authentication required**：否
- **Authorization required**：否
- **Integration test**：`contactList` 陣列中缺少 `email` 的項目不應被寫入；Email 通知確實觸發
- **Contract test**：400 錯誤格式符合 `ValidationError` schema
- **Implementation status**：Not Started

## 5. `getFaqList`

- **Method / Path**：`GET /api/v2/faq`
- **Response schema**：`z.array(FaqSchema)`
- **Controller**：`faq.controller.ts#list`
- **Service**：`FaqService.list()`（含快取，建議用 Redis 取代 in-process memory 以支援多實例部署）
- **Repository**：`FaqRepository.findAllProjected()`（只選 `id, name, info, no`）
- **Database tables**：`faq`
- **Authentication required**：否
- **Authorization required**：否
- **Integration test**：快取 TTL 24 小時行為正確
- **Contract test**：response 符合 `Faq` schema（只有 4 個欄位）
- **Implementation status**：Not Started

## 6. `authLogin`

- **Method / Path**：`POST /api/v2/auth/login`
- **Zod body schema**：`LoginSchema`
- **Response schema**：`{ token: z.string() }`
- **Controller**：`auth.controller.ts#login`
- **Service**：`AuthService.login(email, password)`
- **Repository**：`UserRepository.findByEmail()`
- **Database tables**：`users`
- **Authentication required**：否
- **Authorization required**：否
- **Auth 狀態**：`AUTH_REIMPLEMENTATION_REQUIRED` — 帳密驗證邏輯（查 email + bcrypt 比對）需保留，
  token 簽發機制由新專案自行設計並實作
- **Integration test**：既有使用者（`users.password` 為 Laravel bcrypt 雜湊）可用原密碼成功登入
- **Contract test**：401 錯誤格式符合 `ErrorMessage` schema
- **Implementation status**：Not Started

## 7. `authRegister`

- **Method / Path**：`POST /api/v2/auth/register`
- **Zod body schema**：`RegisterSchema`
- **Response schema**：`{ message: z.string() }`
- **Controller**：`auth.controller.ts#register`
- **Service**：`AuthService.register(input)`
- **Repository**：`UserRepository.create()`
- **Database tables**：`users`
- **Authentication required**：否
- **Authorization required**：否
- **Integration test**：重複 email 應回傳驗證錯誤
- **Contract test**：400 錯誤格式符合 `ValidationError` schema
- **Implementation status**：Not Started

## 8. `authLogout`

- **Method / Path**：`POST /api/v2/auth/logout`
- **Response schema**：`{ message: z.string() }`
- **Controller**：`auth.controller.ts#logout`
- **Service**：`AuthService.logout(token)`
- **Repository**：視新專案 token 儲存策略而定（可能不需要 repository，若採用 stateless JWT）
- **Database tables**：視新專案設計（可能不需要任何表，或需要一張 token 黑名單表）
- **Authentication required**：是
- **Authorization required**：否
- **Auth 狀態**：`AUTH_REIMPLEMENTATION_REQUIRED`
- **Integration test**：未帶 token 呼叫應回 401（而非舊系統的 500）
- **Contract test**：response 符合 `{ message }` schema
- **Implementation status**：Not Started

## 9. `adminListContact`

- **Method / Path**：`GET /api/v2/admin/contact`
- **Zod query schema**：`z.object({ page: z.coerce.number().int().positive().optional() })`
- **Response schema**：`PaginatedSchema(ContactSchema)`
- **Controller**：`admin/contact.controller.ts#list`
- **Service**：`ContactService.list(page)`
- **Repository**：`ContactRepository.findAllPaginated()`（`ORDER BY created_at DESC`）
- **Database tables**：`contact`
- **Authentication required**：是
- **Authorization required**：任何已登入使用者（無角色檢查，見 known-legacy-issues.md）
- **Integration test**：未登入應回 401
- **Contract test**：response 符合 `PaginatedResponse` + `Contact` schema
- **Implementation status**：Not Started

## 10. `adminGetContact`

- **Method / Path**：`GET /api/v2/admin/contact/:id`
- **Zod params schema**：`z.object({ id: z.coerce.number().int() })`
- **Response schema**：`ContactSchema`（含 `contactList` 陣列）
- **Controller**：`admin/contact.controller.ts#get`
- **Service**：`ContactService.getWithContactList(id)`
- **Repository**：`ContactRepository.findById()`, `ContactListRepository.findByContactId()`
- **Database tables**：`contact`, `contact_list`
- **Authentication required**：是
- **Authorization required**：任何已登入使用者
- **Integration test**：不存在的 id 應回 404
- **Contract test**：response 符合 `Contact` schema
- **Implementation status**：Not Started

## 11. `adminUpdateContact`

- **Method / Path**：`PUT /api/v2/admin/contact/:id`
- **Zod body schema**：**KNOWN_LEGACY_ISSUE — 待專案負責人確認正確欄位後才能定義**
- **Response schema**：`{ message: z.string(), data: ContactSchema }`
- **Controller**：`admin/contact.controller.ts#update`
- **Service**：`ContactService.update(id, input)`
- **Repository**：`ContactRepository.update()`
- **Database tables**：`contact`
- **Authentication required**：是
- **Authorization required**：任何已登入使用者
- **Integration test**：**暫緩** — 待業務邏輯確認
- **Contract test**：**暫緩**
- **Implementation status**：Blocked（需要 known-legacy-issues.md 中列出的決策）

## 12. `adminDeleteContact`

- **Method / Path**：`DELETE /api/v2/admin/contact`
- **Zod body schema**：`DeleteByIdsSchema`（`z.union([z.number(), z.array(z.number())])`）
- **Response schema**：`{ message: z.string() }`
- **Controller**：`admin/contact.controller.ts#remove`
- **Service**：`ContactService.remove(ids)`
- **Repository**：`ContactRepository.deleteByIds()`
- **Database tables**：`contact`
- **Authentication required**：是
- **Authorization required**：任何已登入使用者
- **Integration test**：確認不會級聯刪除 `contact_list`（保留現況孤兒資料行為）
- **Contract test**：404 訊息格式符合現況
- **Implementation status**：Not Started

## 13. `adminListContactList`

- **Method / Path**：`GET /api/v2/admin/contact-list`
- **Response schema**：`{ data: z.array(ContactListSchema) }`
- **Controller**：`admin/contactList.controller.ts#list`
- **Service**：`ContactListService.list()`
- **Repository**：`ContactListRepository.findAll()`
- **Database tables**：`contact_list`
- **Authentication required**：是
- **Authorization required**：任何已登入使用者
- **Integration test**：回傳筆數與資料庫一致（無分頁）
- **Contract test**：response 符合 schema
- **Implementation status**：Not Started

## 14. `adminGetContactList`

- **Method / Path**：`GET /api/v2/admin/contact-list/:id`
- **Zod params schema**：`z.object({ id: z.coerce.number().int() })`
- **Response schema**：`ContactListSchema`
- **Controller**：`admin/contactList.controller.ts#get`
- **Service**：`ContactListService.get(id)`
- **Repository**：`ContactListRepository.findById()`
- **Database tables**：`contact_list`
- **Authentication required**：是
- **Authorization required**：任何已登入使用者
- **Integration test**：不存在的 id 應回 404
- **Contract test**：response 符合 schema
- **Implementation status**：Not Started

## 15. `adminGetContactClass`

- **Method / Path**：`GET /api/v2/admin/contact-class/:id`
- **Zod params schema**：`z.object({ id: z.coerce.number().int() })`
- **Response schema**：`ContactClassSchema`
- **Controller**：`admin/contactClass.controller.ts#get`
- **Service**：`ContactClassService.get(id)`
- **Repository**：`ContactClassRepository.findActiveById()`
- **Database tables**：`contact_class`
- **Authentication required**：是
- **Authorization required**：任何已登入使用者
- **Integration test**：`del=1` 的資料應視為不存在（404）
- **Contract test**：response 符合 schema
- **Implementation status**：Not Started

## 16. `adminCreateContactClass`

- **Method / Path**：`POST /api/v2/admin/contact-class`
- **Zod body schema**：`ContactClassCreateSchema`
- **Response schema**：`{ message: z.string(), data: ContactClassSchema }`
- **Controller**：`admin/contactClass.controller.ts#create`
- **Service**：`ContactClassService.create(input)`
- **Repository**：`ContactClassRepository.create()`
- **Database tables**：`contact_class`
- **Authentication required**：是
- **Authorization required**：任何已登入使用者
- **Integration test**：`no` 非整數時回傳驗證錯誤
- **Contract test**：response 符合 schema
- **Implementation status**：Not Started

## 17. `adminUpdateContactClass`

- **Method / Path**：`PUT /api/v2/admin/contact-class/:id`
- **Zod body schema**：`ContactClassCreateSchema`
- **Response schema**：`{ message: z.string(), data: ContactClassSchema }`
- **Controller**：`admin/contactClass.controller.ts#update`
- **Service**：`ContactClassService.update(id, input)`
- **Repository**：`ContactClassRepository.updateActiveById()`
- **Database tables**：`contact_class`
- **Authentication required**：是
- **Authorization required**：任何已登入使用者
- **Integration test**：不存在或已刪除的 id 應回 404
- **Contract test**：response 符合 schema
- **Implementation status**：Not Started

## 18. `adminDeleteContactClass`

- **Method / Path**：`DELETE /api/v2/admin/contact-class`
- **Zod body schema**：`DeleteByIdsSchema`
- **Response schema**：`{ message: z.string() }`
- **Controller**：`admin/contactClass.controller.ts#remove`
- **Service**：`ContactClassService.remove(ids)`
- **Repository**：`ContactClassRepository.deleteByIds()`（硬刪除，非設定 `del=1`）
- **Database tables**：`contact_class`
- **Authentication required**：是
- **Authorization required**：任何已登入使用者
- **Integration test**：確認是硬刪除（資料列真的消失，非 `del=1`）
- **Contract test**：404 訊息格式符合現況
- **Implementation status**：Not Started

## 19. `adminSearchContactByCompany`

- **Method / Path**：`GET /api/v2/admin/contact/search/search-company`
- **Zod query schema**：`z.object({ company: z.string().optional(), page: z.coerce.number().int().positive().optional() })`
- **Response schema**：`PaginatedSchema(ContactSchema)`
- **Controller**：`admin/contact.controller.ts#searchByCompany`
- **Service**：`ContactService.searchByCompany(company, page)`
- **Repository**：`ContactRepository.searchByCompanyPaginated()`（參數化 `LIKE`）
- **Database tables**：`contact`
- **Authentication required**：是
- **Authorization required**：任何已登入使用者
- **Integration test**：`company` 含 `%`/`_` 時行為與現況一致（不特別轉義）
- **Contract test**：response 符合 `PaginatedResponse` + `Contact` schema
- **Implementation status**：Not Started
