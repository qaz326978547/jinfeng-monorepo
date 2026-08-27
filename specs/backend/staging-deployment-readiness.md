# Monorepo Staging Deployment Readiness

> 寫於 2026-08-27。**本文件僅為分析與規劃記錄**——本次產出未修改 Zeabur 上任何 service（production 或 staging）、未修改任何 DNS、未讀取或輸出任何真實 secret、未 commit、未 push。目標 repo/branch：`qaz326978547/jinfeng-monorepo` / `integration/monorepo`，兩個獨立 Zeabur service（`frontend` Root Directory = `frontend`、`backend` Root Directory = `backend`），不合併成單一 container。
>
> 本文件與既有兩份文件的關係：`specs/backend/production-env-readiness.md` 是 **production** 專屬的 CORS/env 稽核；本文件是 **staging** 專屬的部署 readiness，兩者的建議值不同（staging 用假的/隔離的資源，production 用真實資源），不要混用。`specs/backend/laravel-to-node-parity.md` §9 的 production cutover checklist 已依本文件 §10 的分類重新整理。

---

## 1. Backend Zeabur Config（Staging）

### 1.1 逐項確認結果

| # | 檢查項 | 結論 |
|---|---|---|
| 1 | Zeabur 用 `backend/Dockerfile` 是否可直接 build | ✅ 可以——標準 multi-stage Dockerfile，`docker build backend` 不需要任何額外參數 |
| 2 | production target | ✅ Dockerfile 最後一個 stage 就是 `production`（`base → deps → build → production-deps → development → production`），Docker 預設行為（無 `--target` 參數時）就是 build 最後一個 stage，`development` stage 雖然定義在 `production` 之前但不會被誤用 |
| 3 | start command | ✅ `CMD ["node", "dist/server.js"]`（`production` stage），純執行編譯後的 JS，不跑 `npm run dev`/`tsx` |
| 4 | `PORT` 是否正確使用 Zeabur runtime PORT | ✅ `src/config/env.ts`：`PORT: z.coerce.number().int().positive().default(8080)`，從 `process.env.PORT` 讀取；`src/server.ts`：`app.listen(env.PORT, '0.0.0.0', ...)`——完全遵循 Zeabur 動態指派 port 的慣例，不需要額外設定（除非 Zeabur 沒有注入 `PORT`，那樣會 fallback 到 8080，這點應列入 §9 manual verification） |
| 5 | bind address 是否為 `0.0.0.0` | ✅ 已確認（見上），不是 `127.0.0.1`/`localhost`（後者在容器內會導致外部連不進來） |
| 6 | health endpoint | ✅ `GET /health`（unversioned，不查 DB，`Dockerfile HEALTHCHECK` 用的就是這支，透過 `dist/healthcheck.js` 打 `127.0.0.1:$PORT/health`） |
| 7 | ready endpoint | ✅ `GET /ready`（unversioned，`pingPool()` 查 DB 連線，DB 不通回 503） |
| 8 | build 是否需要任何額外 command | ✅ 不需要——`docker build` 本身就會在 `build` stage 內執行 `npm run build`（`tsc -p tsconfig.build.json`），Zeabur 端不需要另外設定 build command |
| 9 | migration 不得在 container 啟動時自動 destructive 執行 | ✅ 已確認——`Dockerfile` 的 `production` stage `CMD` **只執行** `node dist/server.js`，完全不跑 migration；`backend/README.md` 也明確記載「Production `CMD` 只執行 `node dist/server.js`，不跑 migration」 |
| 10 | schema migration 應該如何在 staging 執行 | 見 §1.2 |

### 1.2 Staging Migration 執行方式

`scripts/migrate.ts` 是**唯一**的 schema migration 手段（`npm run db:migrate`），純 additive（依 `migrations/00N_*.sql` 檔名排序、逐一執行、用 `node_schema_migrations` 追蹤表記錄已套用項目，**完全沒有 rollback/reset 指令**，這個腳本本身就不存在「reset」這個能力）。

⚠️ **關鍵細節**：`migrate.ts` 有這段保護——

```ts
if (env.NODE_ENV === 'production' && !allowProduction) {
  console.error('[migrate] Refusing to run migrations with NODE_ENV=production. ...');
  process.exitCode = 1;
  return;
}
```

**建議 staging backend service 的 `NODE_ENV` 設為 `production`**（讓 staging 的日誌格式/`trust proxy`等行為盡量貼近正式環境，這是 staging 存在的意義），但這代表**對 staging DB 執行 migration 時，必須明確加上 `--allow-production` 旗標**：

```bash
npm run db:migrate -- --allow-production
```

**這是刻意的保護機制，不是要繞過的障礙**——執行前務必再三確認當下的 `DB_HOST`/`DB_DATABASE` 指向的是 staging MySQL，不是正式 DB（見 §4）。建議實際操作方式：透過 Zeabur 的一次性 command/shell 執行（Zeabur 支援對已部署的 service 開一個一次性指令），或本機用 staging 的 `DB_*` 環境變數跑 `npm run db:migrate -- --allow-production`（連線對象是 staging MySQL，不是本機 docker-compose 的 MySQL）。

### 1.3 Backend Staging Env Checklist（不含真實值）

| 變數 | Staging 建議值（僅示意，非真實值） | 備註 |
|---|---|---|
| `NODE_ENV` | `production` | 見 §1.2 |
| `PORT` | 不設定（Zeabur 自動注入） | |
| `LOG_LEVEL` | `info` | |
| `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_DATABASE` | 指向**獨立的 staging MySQL**（見 §4） | **不得**指向 production MySQL |
| `DB_CONNECTION_LIMIT` | `10`（預設即可） | |
| `JWT_SECRET` | staging 專屬、全新產生、**與 production 不同** | 兩邊共用會讓 staging 簽出的 token 在 production 也有效，反之亦然，是真實的安全問題 |
| `JWT_EXPIRES_IN` | `30d`（或測試方便可用 `1d`） | enum 只接受 `1d`/`7d`/`14d`/`30d` |
| `BCRYPT_SALT_ROUNDS` | `10` | |
| `CORS_ALLOWED_ORIGINS` | `https://<frontend-staging-domain>` | 見 §3，**不得**含 production 網域或 `*` |
| `MAIL_HOST` 等 `MAIL_*`/`RECIPIENT_EMAIL` | 見 §5 的建議方案 | **不得**填正式 `RECIPIENT_EMAIL` |

---

## 2. Frontend Zeabur Config（Staging）

### 2.1 沿用先前分析：優先採用 Zeabur Nuxt 自動偵測

延續 `specs/backend/production-env-readiness.md` §11.3 的建議（production 與 staging 應該用同一種部署方式，不要兩邊不一致）：**staging frontend 也用 Zeabur Nuxt 自動偵測，不建立 Dockerfile**。

### 2.2 `package.json` scripts 是否足夠

| Zeabur 需要的步驟 | 對應 script | 結論 |
|---|---|---|
| `npm ci` | （Zeabur 內建行為，不需要 script） | ✅ |
| `npm run build` | `"build": "nuxt build"` | ✅ 已存在，實測產出 `.output/server/index.mjs` + `.output/public` |
| `node .output/server/index.mjs` | （Zeabur 讀取 Nitro `node-server` preset 的標準 output 路徑，不需要額外 `start` script） | ✅ 這是 Nitro `node-server` preset 的標準產出路徑，Zeabur 的 Nuxt 自動偵測本來就是針對這個路徑設計的 |

`package.json` **沒有**顯式的 `"start"` script（只有 `build`/`dev`/`generate`/`preview`）。**這不是缺口**——Zeabur 的 Nuxt 自動偵測不是透過 `npm start` 啟動，而是直接執行建置產物 `node .output/server/index.mjs`（這是 Nuxt/Nitro 官方文件記載的標準做法，`package.json` 不需要為此新增 script）。若未來要改用某些也支援 `npm start` 慣例的平台，才需要補一個 `"start": "node .output/server/index.mjs"` script；本次分析範圍內不需要。

### 2.3 `NUXT_PUBLIC_API_BASE_URL` runtime 注入確認

已在前一批（Frontend Runtime Config Hardening）用**本機** production build 實測確認：不重新建置、只在啟動 `node .output/server/index.mjs` 時帶入不同的 `NUXT_PUBLIC_API_BASE_URL`，`/auth`、`/admin/contact` 頁面正確反映新值（見 `production-env-readiness.md` §11.2）。**這個結論同樣適用於 staging**——staging frontend service 只需要在 Zeabur 的環境變數欄位設定：

```
NUXT_PUBLIC_API_BASE_URL=https://<backend-staging-domain>
```

不需要在建置指令帶入，不需要 build-time secret 注入機制。**`<backend-staging-domain>` 是 Zeabur 建立 backend staging service 後才會產生的實際網址（或未來設定的自訂網域），本文件不猜測/不 hardcode 這個值。**

### 2.4 Frontend Staging Env Checklist

| 變數 | Staging 建議值 |
|---|---|
| `NUXT_PUBLIC_API_BASE_URL` | `https://<backend-staging-domain>` |
| `NUXT_PUBLIC_SITE_URL` | `https://<frontend-staging-domain>`（**不要**留成 production 網域，否則 canonical/OG tag 會指向正式網站，讓 staging 頁面看起來像是要取代正式頁面被索引） |
| `NUXT_PUBLIC_GTM_ID` | 建議留空（staging 流量不應該混進正式 GTM 容器的統計數字） |

---

## 3. Staging CORS

| 環境 | `CORS_ALLOWED_ORIGINS` |
|---|---|
| Production（不變） | `https://laborservice5690.com` |
| Staging | `https://<frontend-staging-domain>` |

- **不得**加入 `*`（`src/config/cors.ts` 本身的實作方式也不支援 wildcard + `credentials:true` 這個瀏覽器會拒絕的組合，見 `production-env-readiness.md` §3.4，staging 沿用同一份程式碼，結論相同）。
- **不得**把 staging domain 加進 production 的 `CORS_ALLOWED_ORIGINS`，反之亦然——兩個 service 各自的環境變數互不影響，只要在 Zeabur console 分開設定即可，不需要額外機制。
- 若 Zeabur 為 staging service 額外產生 preview URL（例如每次 deploy 一個新的 `*.zeabur.app` 子網域），且需要對該 preview URL 測試 admin 功能，才需要把該網址也加進 staging 的 `CORS_ALLOWED_ORIGINS`（逗號分隔，程式碼已支援多個 origin）——**這件事需要人工確認 Zeabur 是否真的會產生這種 URL，本文件不假設答案**。

---

## 4. Staging Database

### 4.1 結論：建立獨立 Zeabur MySQL service，不使用 production DB

第一輪 staging integration test **不得**對 production DB 執行任何操作（讀或寫皆然，避免不小心的 UPDATE/DELETE，也避免把測試流量的 side effect——例如寄出的通知信、寫入的假報名資料——混進正式資料）。

### 4.2 需要確認的變數（結構，非真實值）

```
DB_HOST=<staging-mysql-host>
DB_PORT=3306
DB_USER=<staging-only-user>
DB_PASSWORD=<staging-only-password，與 production 不同>
DB_DATABASE=<staging-database-name，建議名稱包含 staging 字樣以利辨識，例如 jinfeng_staging>
```

### 4.3 初始化流程

```bash
# 1. schema migration（見 §1.2 的 --allow-production 說明）
npm run db:migrate -- --allow-production

# 2. 驗證 schema 與 database-schema.json 快照一致（純 SELECT，安全）
npm run db:verify
```

### 4.4 明確禁止事項（重申使用者要求）

- ❌ `DROP` production DB
- ❌ `TRUNCATE` production 任何表
- ❌ migrate reset（**這個指令根本不存在**——`migrate.ts` 只有 additive apply，沒有 rollback/reset 能力，架構上就不可能誤觸發）
- ❌ 任何對 production 的 destructive operation

`scripts/verify-schema.ts` 本身是唯讀（只對 `information_schema` 下 `SELECT`），文件註解也明確寫「safe to run against production」——這支腳本即使不小心指到 production 也不會造成傷害，但 `db:migrate` 會，所以 §4.2 的 `DB_*` 變數在執行 migrate 前務必再三確認。

---

## 5. Staging Mail Safety

`POST /contact` 目前是**同步**寄信（見 `contact.service.ts`：DB 寫入 commit 後才 `await mailService.sendContactNotification()`，寄信失敗**永不**讓這支 API 失敗，只記 log）。

### 5.1 三個方案評估

| 方案 | 說明 | 風險 | 設定成本 |
|---|---|---|---|
| A. 專門測試收件人 | staging 的 `RECIPIENT_EMAIL` 指向一個測試信箱 | 中——需要真實 SMTP 憑證，且人工在 Zeabur console 設定時有「複製貼上到錯的 service」誤把正式收件人帶進 staging（或反過來）的風險 | 中 |
| B. staging 關閉 mail | `MAIL_HOST` 留空 | **無**——`mail-transport.ts` 對空 `MAIL_HOST` 回傳 `null`，`mail.service.ts` 偵測到 `!transporter` 直接 log warning 並跳過，`POST /contact` 依然回 201 成功 | **零**（不用設定任何 MAIL_* 變數） |
| C. SMTP sandbox（如 Mailtrap/Mailhog） | 真的寄，但寄到一個不會外流的沙盒收件匣 | 低——需要另外申請/佈署沙盒服務帳號 | 中高 |

### 5.2 建議：**方案 B（第一輪 staging 直接關閉 mail）**

理由：
- **零設定、零風險**——不需要準備任何額外的 SMTP 資源，也就不存在「不小心用了正式收件人」這個問題。
- **「mail 未設定時優雅跳過」本身就是一條需要驗證的程式碼路徑**——關閉 mail 不是「跳過測試」，而是直接驗證了這個分支（`POST /contact` 在沒有 mail 的情況下，DB 寫入、response shape、log warning 是否都正確），這是 legacy Laravel 沒有的行為，值得在 staging 明確跑過一次。
- `POST /contact` 的**核心正確性**（DB transaction、`contact`/`contact_list` 寫入、response shape）完全不依賴 mail 是否有寄出，方案 B 不會讓任何 E2E 測項失去意義。

**後續建議（非本輪必要）**：等 staging 的其他部分都驗證穩定後，可以再切換成**方案 C（SMTP sandbox）**，專門驗證一次「mail 樣板實際寄出、內容正確」這件事——這比方案 A 更安全，因為即使設定錯誤，最壞情況也只是寄進沙盒，不會外流。**不建議直接跳到方案 A**，除非有明確理由需要用真實 SMTP 服務商測試（例如懷疑某個 SMTP 服務商本身有相容性問題）。

---

## 6. Seed / Test Data Strategy

### 6.1 現況：四張表完全沒有寫入 API

盤點下方六類測試資料時發現一個重要的既有限制——**`seo`、`faq`、`contact_quest` 三張表目前完全沒有任何 `POST`/`PUT`/`DELETE` API**（`src/modules/{seo,faq,contact-quest}/*.routes.ts` 都只有 `router.get('/', ...)`），這是 Node 遷移目前的既有範圍（原始 Laravel 應該有對應的後台 CRUD，但尚未排入這次遷移的任何 batch，`laravel-to-node-parity.md` 目前也沒有把這幾支列為待實作項目——**這件事本身值得在 §10 額外記一筆，但不屬於本次 staging readiness 的範圍去擴大**）。這代表這三張表**唯一**的資料建立方式是直接對資料庫下 SQL，不是本次要新增/實作的功能。

| 測試資料 | 建立方式 | 現況 |
|---|---|---|
| admin user | `POST /api/v2/auth/register`，`is_admin:true` | ✅ 有 API，見 `QA測試.md` §4.1 |
| normal user | `POST /api/v2/auth/register`（不帶 `is_admin`） | ✅ 有 API，見 `QA測試.md` §4.2 |
| contact_class | `POST /api/v2/admin/contact-class`（需先有 admin token） | ✅ 有 API |
| contact_quest | ❌ **沒有寫入 API** | 只能直接 SQL INSERT |
| seo | ❌ **沒有寫入 API** | 只能直接 SQL INSERT |
| faq | ❌ **沒有寫入 API** | 只能直接 SQL INSERT |

### 6.2 最小 synthetic seed 規劃（規劃，本批不實作）

建議新增 `backend/seeds/staging-seed.sql`（**與 `migrations/` 分開存放**，不透過 `node_schema_migrations` 追蹤——這不是 schema migration，是測試資料，避免未來誤把測試資料的 INSERT 當成正式 schema 演進歷史的一部分）。內容規劃（欄位對照 §附錄的 schema，全部使用明顯是測試用的字串，不使用任何真實個資）：

```sql
-- backend/seeds/staging-seed.sql（規劃草稿，本批未建立此檔案）
-- 僅供 staging 使用，內容皆為 synthetic 測試資料，不含任何真實 PII。

INSERT INTO contact_quest (name, no, del, created_at, updated_at)
VALUES ('[STAGING] 測試問題選項', 1, 0, NOW(), NOW());

INSERT INTO seo (class_id, relate_id, tag, name, title, description, url, type, keyword, pic, pic_alt, del, created_at, updated_at)
VALUES (0, 1, 'test', '[STAGING] 測試 SEO 資料', '[STAGING] 測試標題',
        '[STAGING] 測試描述文字', '/staging-test', 'article', '測試,staging',
        '', '', 0, NOW(), NOW());

INSERT INTO faq (class_id, name, date, info, created_at, updated_at)
VALUES (0, '[STAGING] 測試 FAQ 標題', NOW(), '[STAGING] 測試 FAQ 內容', NOW(), NOW());
```

執行方式規劃：`docker compose exec mysql mysql -u jinfeng -p jinfeng_local < seeds/staging-seed.sql`（本機）或透過 Zeabur MySQL 的連線資訊用相同方式對 staging DB 執行——**同樣適用 §4.4 的「不得對 production 執行」原則**，seed 腳本檔名/內容都用 `[STAGING]` 前綴標註，降低誤跑到錯誤環境時的辨識成本。

**不建議**幫 `seo`/`faq`/`contact_quest` 補寫 admin CRUD API 來解決這個問題——那是一個獨立、範圍遠大於「staging 測試資料」的後端功能任務，不屬於本次 readiness 分析。

---

## 7. Staging E2E Checklist

以下延續 `QA測試.md` 的手動測試清單，改為指向 staging 網域（`https://<frontend-staging-domain>` / `https://<backend-staging-domain>`）而非 `localhost`。**本清單只是「應該測什麼」，本次分析未實際對 staging 執行（尚未有 staging 環境）。**

### Public
- [ ] `GET /seo`
- [ ] `GET /faq`
- [ ] `GET /contact-class`
- [ ] `GET /contact-quest`
- [ ] `POST /contact`（確認方案 B 下：201 成功、DB 有寫入、log 出現 mail 跳過警告）

### Auth
- [ ] login（admin 帳號，見 §6）
- [ ] JWT 寫入 `localStorage`
- [ ] refresh page 保持登入
- [ ] 關閉分頁重開瀏覽器保持登入（token 未過期前提下）
- [ ] logout（清 token、導回 `/auth`）
- [ ] 401 session expiry（手動改壞 `localStorage` 的 token，觸發清 token + 導頁 + 單次 alert）

### Admin
- [ ] admin 帳號登入成功
- [ ] normal user 帳號打 `/admin/*` → 403
- [ ] `GET /admin/contact` 列表
- [ ] `GET /admin/contact/{id}` 含 `contact_list`
- [ ] `GET /admin/contact/search/search-company`
- [ ] `POST /admin/contact-class` 新增
- [ ] `PUT /admin/contact-class/{id}` 更新
- [ ] `DELETE /admin/contact`
- [ ] `DELETE /admin/contact-class`

### Frontend
- [ ] 首頁 SSR（`curl`/View Source 確認非空殼）
- [ ] `/auth` 頁面可正常載入
- [ ] `/admin/contact` 未登入時 route guard 導回 `/auth`
- [ ] `window.__NUXT__.config.public.apiBaseUrl` 指向 staging backend domain，不是 `localhost` 也不是正式網域
- [ ] `NUXT_PUBLIC_GTM_ID` 留空時，頁面仍正常啟動、無 JS 錯誤（`plugins/vue-gtm.client.ts` 的 `if (!gtmId) { console.error(...); return; }` 分支不應該讓整個 app 崩潰，只是不啟用 GTM）

---

## 8. Rollback Plan

| 情境 | 處理方式 |
|---|---|
| Staging 部署後發現嚴重問題（不是 production，風險低） | 直接在 Zeabur console 重新部署上一個 commit，或暫停 staging service；因為完全隔離的 DB/CORS/mail，staging 出問題**不會**影響 production |
| Staging DB schema migration 後發現寫錯 | `migrate.ts` 沒有 rollback 指令——這代表 staging DB 若跑壞了，最簡單可靠的復原方式是**整個 staging MySQL service 砍掉重建**（反正是 synthetic 測試資料，沒有保留價值），重新 `db:migrate -- --allow-production` + 依 §6 重新 seed，而不是嘗試手動撰寫回滾 SQL |
| Staging 環境變數設錯（例如 CORS 指到 production 網域） | 直接在 Zeabur console 修正該 service 的環境變數並重新部署（環境變數變更需要 recreate container 才會生效，純程式碼修改不需要） |
| 需要完全撤除 staging | 刪除 Zeabur 上的 staging service（frontend/backend 各自刪除）與其專屬 MySQL service；**這步驟本身屬於「修改 Zeabur service」，需要另外明確指示才能執行，本次分析不代為操作** |

**沒有 production rollback plan 的必要**——本批完全不觸碰 production，rollback 只需要考慮 staging 自己。

---

## 9. Backend / Frontend 驗證結果

### 9.1 Backend

```bash
npm ci            ✅
npm run typecheck ✅ 0 錯誤
npm run lint      ✅ 0 錯誤
npm test          ✅ 193/193 通過
npm run build     ✅ 通過
npm run openapi:validate  ✅ OK (15 paths)
```

（與前幾批記錄一致，本批未修改任何 backend 程式碼，純檢查性質重跑一次確認 HEAD 仍然綠燈。）

### 9.2 Frontend

```bash
npm ci            ✅
npm run build     ✅ 通過（`.output/server/index.mjs` 產出）
```

依指示，本批**不處理** frontend typecheck baseline（`typescript` 未列入依賴的既有缺口，見 `production-env-readiness.md`），維持記錄現況、不修 tooling。

---

## 10. Production Blockers 重新分類

沿用四個分類：

- **CODE_READY**：程式碼/設定本身已完成，不需要再改程式碼；剩下的只是「有人去 Zeabur/DB 上按下設定」這個動作。
- **STAGING_REQUIRED**：需要先在 staging 環境**實際跑過一次**才能確認（本文件 §7 的 E2E checklist 就是這類）。
- **PRODUCTION_MANUAL_VERIFY**：只能在 production 環境本身確認（例如「Zeabur MySQL 是否要求 SSL」這種平台特性、或「真實 SMTP 憑證是否有效」），staging 測不出來的必須留到 production 上線前的最後檢查。
- **DEFERRED_NON_BLOCKING**：不影響核心功能正確性/可靠性，可以在 cutover **之後**再處理的優化項，不應該擋住上線。

| 項目 | 分類 | 理由 |
|---|---|---|
| 19 支 API 功能實作（18/19 DONE + 1 DEFERRED） | CODE_READY | 已完成，見 `laravel-to-node-parity.md` |
| Auth flow（login/register/logout + frontend UX） | CODE_READY | 已完成兩個 frontend batch |
| Admin authorization（`authenticate → requireAdmin`） | CODE_READY | 已完成，401/403/200 三層測試覆蓋 |
| Database schema compatible | CODE_READY | 已完成 |
| Backend tests / build / openapi:validate | CODE_READY | 193/193，見 §9.1 |
| Frontend build | CODE_READY | 見 §9.2 |
| CORS 機制（allowlist、credentials、無 wildcard） | CODE_READY | 程式碼面已驗證，見 `production-env-readiness.md` §3 |
| CORS 正式 origin 實際設定並測試 | STAGING_REQUIRED → 之後 PRODUCTION_MANUAL_VERIFY | 先在 staging 用 `https://<frontend-staging-domain>` 跑一次通過，上線前再對 production origin 做最後確認 |
| Frontend 部署方式（Zeabur 自動偵測） | STAGING_REQUIRED | 本文件只給出程式碼面的可行性分析（§2），**是否真的能在 Zeabur 上跑起來，必須先在 staging 實際部署一次驗證** |
| Zeabur MySQL 是否要求 SSL 連線 | PRODUCTION_MANUAL_VERIFY（staging 若也用 Zeabur MySQL，可提前在 staging 發現） | 現有程式碼未設定 `ssl` 選項，`buildPoolOptions()` 沒有 TLS 相關設定；如果 staging 跟 production 用同一種 Zeabur MySQL 方案，這個問題在 staging 階段就能提前暴露，不用等到 production |
| 真實 `JWT_SECRET`/`RECIPIENT_EMAIL`/`MAIL_*` 憑證 | PRODUCTION_MANUAL_VERIFY | 只有 production 環境的真實值需要驗證，staging 用自己的假值（見 §1.3/§5） |
| Staging integration test 本身 | STAGING_REQUIRED | 定義上就是這個分類——見 §7 |
| **FAQ 24hr cache** | **DEFERRED_NON_BLOCKING**（重新評估，見 §10.1） | 不是 cutover blocker |
| **Contact Queue 化** | **DEFERRED_NON_BLOCKING**（重新評估，見 §10.2） | 不是 cutover blocker |
| **Mail 模板逐字複製** | **DEFERRED_NON_BLOCKING**（重新評估，見 §10.3） | 不是 cutover blocker |
| `seo`/`faq`/`contact_quest` 缺少寫入 API（§6.1 新發現） | DEFERRED_NON_BLOCKING | 目前唯讀公開資料本身沒有錯誤；「後台無法透過 UI/API 編輯」是既有維運限制，不影響前台/API 對外行為的正確性，且不在本次遷移排定範圍內 |

### 10.1 FAQ Cache 重新評估

- **Observable behavior**：對前端呼叫者完全一致——有無 cache 只影響回應速度，不影響資料內容/格式。
- **Data correctness**：**沒有 cache 反而更正確**——legacy 的 24hr cache 在資料更新後最多有 24 小時的過時窗口；Node 版本每次都查最新資料，不存在這個 staleness 問題。
- **Reliability**：`faq` 是小表、單純 `SELECT`，沒有 join、沒有鎖競爭；在目前這個網站的規模下（地區性勞資顧問公司的資訊頁面）不構成資料庫負載風險。
- **Traffic scale**：非高流量公開頁面，沒有證據顯示會出現需要 cache 才扛得住的讀取量。
- **結論**：**DEFERRED_NON_BLOCKING**——cache 是效能優化，不是正確性需求，可以上線後視實際流量數據再決定是否要做。

### 10.2 Contact Queue 重新評估

- **Observable behavior**：目前 `POST /contact` 是同步寄信（`await` 在回應之前）——如果 SMTP 很慢或掛掉，使用者的請求會等比較久，**這是唯一真實的行為差異**（legacy 若有 queue，回應永遠很快）。DB 寫入本身不受影響，也不會因為 mail 失敗而失敗或回滾。
- **Data correctness**：**完全不受影響**——`contact.service.ts` 的順序是「DB 寫入 commit → 才嘗試寄信」，且寄信失敗被 `ContactMailService` 完整吞掉（永不 throw），不會讓已完成的報名資料消失或變得不一致。
- **Reliability**：核心風險是「SMTP 掛住時 HTTP 請求也跟著掛住」，最壞情況下可能撞到反向代理層的逾時（該連線逾時可能讓使用者瀏覽器顯示失敗，但資料其實已經寫入成功）——**這是一個值得留意但影響有限的 UX 邊界情況，不是資料遺失或系統性錯誤**。
- **Traffic scale**：這是一個特定地區勞資顧問公司的報名表單，不是高流量電商結帳流程，預期请求量是每天個位數到十位數等級，不是需要非同步佇列才能撐住的規模。
- **結論**：**DEFERRED_NON_BLOCKING**——建議上線前可以考慮的低成本強化（非必要）：幫 nodemailer transport 加上明確的 `connectionTimeout`/`socketTimeout`（例如 5–10 秒），把「SMTP 掛住」的最壞情況從「掛到 proxy 逾時」限縮成「幾秒內確定失敗、正常回應使用者」——這是一行設定的成本，不是重建 Queue 架構，若要做建議另開小任務，不影響本次 cutover 判斷。
- 明確排除「因為 legacy 有 Queue 所以一定要有 Queue」這種機械式判斷——本評估的結論是：資料正確性與核心可靠性都不依賴 Queue，Queue 化是效能/UX optimization，非 cutover 必要條件。

### 10.3 Mail 模板逐字複製重新評估

- **Observable behavior**：影響的是**內部收件人**（`RECIPIENT_EMAIL`，公司內部負責處理報名的人），不是外部客戶——客戶端（前端網頁）完全感受不到這個模板長怎樣。目前模板已包含所有已知欄位（company/class/num/tel 等），只是排版/用字不是逐字複製 legacy Blade 樣板。
- **Data correctness**：不影響——底層資料完全正確，只是呈現格式。
- **Reliability**：不影響。
- **Traffic scale**：N/A。
- **結論**：**DEFERRED_NON_BLOCKING**——這是內部通知信的排版/品牌一致性問題，屬於上線後可以逐步打磨的項目。**唯一需要人工確認的例外**：若內部人員的信箱有依賴特定格式的自動化規則（例如 Outlook 規則、巨集解析特定欄位位置），需要跟業務方確認目前的模板是否仍相容——本次分析沒有證據顯示存在這類自動化，但也無法排除，這點列為 §附錄的待確認項目，不影響 DEFERRED_NON_BLOCKING 的分類本身。

---

## 附錄：待確認事項總表（人工，跨 STAGING_REQUIRED/PRODUCTION_MANUAL_VERIFY）

1. Zeabur Nuxt 自動偵測實際部署 staging frontend 是否成功（§2、§7）
2. Zeabur MySQL 是否要求 SSL（§1.3、§10）
3. Zeabur 是否會注入 `PORT` 環境變數蓋過 Dockerfile `EXPOSE 8080` 預設（§1.1 第 4 項）
4. Zeabur staging service 是否會產生額外 preview URL，若有是否需要加進 CORS allowlist（§3）
5. 內部收件人是否有依賴特定 mail 格式的自動化規則（§10.3）
6. `seo`/`faq`/`contact_quest` 缺少後台寫入 API 是否需要排入未來的獨立任務（§6.1，本次僅記錄，不建議本次動作）
