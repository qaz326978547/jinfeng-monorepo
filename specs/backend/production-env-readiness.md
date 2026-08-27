# Production CORS + Environment Readiness Audit

> 寫於 2026-08-27。**本文件僅為分析與規劃記錄**——本次產出未修改 Zeabur 上任何 production service、未讀取或輸出任何真實 secret 值（下列所有 `secret` 分類的變數都只列出**變數名稱與格式要求**，不含任何真實密碼/金鑰/連線字串）、未 commit、未 push。
>
> 目的：在正式把 Node backend 與既有 Nuxt frontend 切到 Zeabur production 之前，把「需要哪些環境變數」「CORS 該放行哪些 origin」「目前程式碼/設定層面準備好了什麼、還缺什麼」講清楚，讓實際上 Zeabur console 設定值的人（人類，不是這次分析）有一份可以直接對照的清單。

---

## 0. 資料來源

- Backend：`backend/.env.example`、`backend/src/config/env.ts`、`backend/src/config/cors.ts`、`backend/src/config/database.ts`、`backend/src/server.ts`、`backend/src/app.ts`、`backend/Dockerfile`、`backend/package.json`、`backend/src/infrastructure/mail/*`
- Frontend：`frontend/README.md`、`frontend/nuxt.config.ts`、`frontend/store/usePublicStore.ts`、`frontend/.env.example`、`frontend/middleware/redirect-www.global.ts`、`frontend/plugins/vue-gtm.client.ts`
- Shared：`specs/backend/laravel-to-node-parity.md`（§9、§4.9/附錄 CORS 段落）、`specs/shared/api-contracts/openapi.yaml`、根目錄 `README.md`（Deployment 段落）
- `backend/docker-compose.yml`、`specs/backend/migration-history/docker/`（舊 Laravel docker-compose，僅供歷史對照，非現行部署設定）

---

## 1. Backend Env Matrix

依 `backend/src/config/env.ts`（Zod schema，唯一的 runtime 真相來源）逐一核對。「Has default」欄位是 `env.ts` 裡的 Zod `.default(...)`；沒有 default 且非 optional 的變數，**未設定會讓應用程式在啟動階段直接 throw、拒絕啟動**（`loadEnv()` fail fast，不是靜默用空值運作）。

| 變數 | Required? | Has default | Secret / Public | 說明 |
|---|---|---|---|---|
| `NODE_ENV` | Optional | ✅ `development` | Public | Zeabur 上**必須明確設為 `production`**——`app.ts`/`middleware` 多處用它做 production-only 分支（見 §7） |
| `PORT` | Optional | ✅ `8080` | Public | 見 §8，Zeabur 動態指派的 port 由此變數接收 |
| `LOG_LEVEL` | Optional | ✅ `info` | Public | 純觀測用，非阻斷項 |
| `DB_HOST` | **Required** | ❌ 無 | Secret（視 Zeabur 網路拓樸而定，內網 host 通常不算高敏感但仍不應公開） | 未設定則啟動失敗 |
| `DB_PORT` | Optional | ✅ `3306` | Public | — |
| `DB_USER` | **Required** | ❌ 無 | Secret | 未設定則啟動失敗 |
| `DB_PASSWORD` | Optional（schema 層級）⚠️ | ✅ `''`(空字串) | **Secret** | ⚠️ **見下方獨立風險說明** |
| `DB_DATABASE` | **Required** | ❌ 無 | Secret（資料庫名稱，非高敏感但不應公開） | 未設定則啟動失敗 |
| `DB_CONNECTION_LIMIT` | Optional | ✅ `10` | Public | — |
| `JWT_SECRET` | **Required** | ❌ 無，且 `.min(16)` | **Secret（最高敏感）** | 未設定或短於 16 字元則啟動失敗 |
| `JWT_EXPIRES_IN` | Optional | ✅ `30d` | Public | **僅允許** `1d`/`7d`/`14d`/`30d`（enum，非任意字串），其他值一律啟動失敗 |
| `BCRYPT_SALT_ROUNDS` | Optional | ✅ `10` | Public | 範圍 4–20 |
| `CORS_ALLOWED_ORIGINS` | Optional（schema 層級）⚠️ | ✅ `''` | Public | ⚠️ **空字串 = 擋掉所有瀏覽器跨來源請求**，見 §3 |
| `MAIL_HOST` | Optional | ✅ `''` | Public（host 本身非機密） | 空值 = 「mail 未設定」，通知信靜默跳過（`mail-transport.ts` 回傳 `null`），**不是啟動失敗** |
| `MAIL_PORT` | Optional | ✅ `587` | Public | — |
| `MAIL_USERNAME` | Optional | ✅ `''` | Secret | — |
| `MAIL_PASSWORD` | Optional | ✅ `''` | **Secret** | — |
| `MAIL_ENCRYPTION` | Optional | ✅ `tls` | Public | enum：`tls`/`ssl`/`none` |
| `MAIL_FROM_ADDRESS` | Optional | ✅ `no-reply@example.com` | Public | Production 必須換成真實寄件地址，否則信件的 From 會是佔位值 |
| `MAIL_FROM_NAME` | Optional | ✅ `Jinfeng` | Public | — |
| `RECIPIENT_EMAIL` | Optional（schema 層級）⚠️ | ✅ `''` | Public（是收件地址，非密碼） | 空值 = 通知信靜默跳過(`mail.service.ts` log warning)，**不是啟動失敗**——但代表 `POST /contact` 完成後沒有人會收到通知 |

### 1.1 `DB_PASSWORD` / `CORS_ALLOWED_ORIGINS` / `RECIPIENT_EMAIL` 的「schema optional，但 production 必須視為 required」風險

這三個變數在 **Zod schema 層級**都允許空字串（不會讓應用程式啟動失敗），但空字串在 production 分別代表：

- `DB_PASSWORD=''`：如果 Zeabur MySQL 允許空密碼登入（通常不允許，但這完全取決於 Zeabur MySQL service 的實際設定，本分析範圍外無法確認），這是一個真實的安全風險；即使 MySQL 拒絕空密碼登入，後果也只是連線失敗、`GET /ready` 回傳不健康，不是靜默的安全問題——但仍必須在 Zeabur 上明確設定真實密碼，不能依賴 schema default。
- `CORS_ALLOWED_ORIGINS=''`：**不是失敗打開（fail-open），是失敗關閉（fail-closed）**——空值會擋掉所有瀏覽器跨來源請求（見 `src/config/cors.ts` 的比對邏輯：`allowedOrigins` 會是空陣列，任何有 `Origin` header 的請求都不會命中 `includes()`，直接進入 CORS 錯誤分支）。這對安全是好事，但代表**沒設定這個變數 = frontend 完全打不通 admin API**，是一個會直接讓功能「看起來壞掉」但不會讓 server 啟動失敗的陷阱，必須在 manual verification checklist 裡明確列出（見 §9）。
- `RECIPIENT_EMAIL=''`：同上，不會讓啟動失敗，但會讓 `POST /contact` 的通知信功能整支「安靜地」失效（只在 log 留一行 warning，使用者送出報名表單本身仍然 200 成功，只是沒人收到通知）。

**這三個變數在程式碼健壯性上刻意設計成「未設定不當機」，但在 production 判斷上必須視同 required——這正是本文件存在的目的：schema 層級的 optional 不等於「production 可以不設定」。**

---

## 2. Frontend Env Matrix

`frontend/` 沒有 Zod（或任何 runtime）schema 驗證環境變數，全部是散落在程式碼裡的 `process.env.X` / `import.meta.env.X` 直接存取，**沒有任何一個變數未設定時會讓應用程式 fail fast**——全部是「靜默使用 fallback 或靜默變成 `undefined`」。

| 變數 | 用途 | Required? | Has default | Secret / Public | 實際存取位置 |
|---|---|---|---|---|---|
| `NUXT_API_BASE_URL` | Backend API base URL | **Production 下事實上必須設定** | ✅ `production` 分支無 fallback；只有非 production 分支 fallback 到 `http://127.0.0.1:9001` | Public（是 URL，非機密） | `store/usePublicStore.ts:9`、`nuxt.config.ts:77`（Vite dev proxy target，只影響 `nuxt dev`） |
| `NUXT_PUBLIC_SITE_URL` | Canonical URL / SEO metadata | Optional | ✅ `https://laborservice5690.com` | Public | `nuxt.config.ts:35`（正確走 `runtimeConfig.public`） |
| `VITE_GTM_ID` | Google Tag Manager container ID | Optional（缺少時 GTM 不啟用，只印一行 `console.error`，不是崩潰） | ❌ 無 | Public（GTM container ID 本身非機密） | `plugins/vue-gtm.client.ts`（正確走 Vite 標準 `import.meta.env.VITE_*`） |
| `NODE_ENV` | 判斷 production/非 production 分支 | 由 Zeabur/建置流程注入，非手動變數 | — | Public | `nuxt.config.ts`、`usePublicStore.ts`、`middleware/redirect-www.global.ts`、`server/middleware/blockBadPaths.ts` |

### 2.1 ⚠️ 重大發現——`vite.define: {'process.env': process.env}`（`nuxt.config.ts:69-72`）

> **✅ 已於 2026-08-27 修正，見 §11。** 以下是原始分析當下（修正前）的記錄，保留原樣供追溯。

```ts
vite: {
    define: {
        'process.env': process.env
    },
    ...
}
```

這一行的效果是：**建置當下（`npm run build` / `nuxt build` 執行的那一刻）machine 上的整個 `process.env` 物件，會被 Vite 原樣字串化、內嵌進最終送到瀏覽器的 client bundle**，取代原始碼裡所有 `process.env` 字樣。這不是 Nuxt/Vite 的預設行為（Vite 預設只會處理 `import.meta.env.VITE_*` 這種明確前綴的變數，並且是逐一 allowlist 注入，不會整包塞入），是這個專案自己額外加的設定。

**兩個必須在正式上線前處理／至少明確意識到的後果**：

1. **這是 build-time 綁定，不是 runtime 綁定**：`NUXT_API_BASE_URL`（以及理論上當下環境裡的任何其他變數）的值，是在 **Docker image 建置 / `nuxt build` 執行的那一刻**被永久烤進 client-side JS 檔案裡的靜態字串，之後不管容器啟動時 Zeabur 注入什麼 runtime 環境變數都不會再生效（因為 client bundle 早就是編譯好的靜態檔案）。這代表：**Zeabur 上的 `NUXT_API_BASE_URL` 必須在「建置階段」就可以被讀到，不能只是 runtime container env**。如果 Zeabur 的 Nuxt 自動偵測建置流程不會把 service 的環境變數注入到 build 步驟（而只在 container 啟動時注入），client 端會拿到 `undefined`，`apiBaseUrl.value` 會變成字面字串 `"undefined/api/v2"`，**每一個透過 `utils/http.ts`（`$http`/`clientFetch`，包含登入、admin API 全部）發出的 client-side 請求都會失敗**——SSR 首次渲染因為 Node process 有真實的 `process.env`，通常不受影響，但這是一個「首屏看起來正常、一互動就全部壞掉」的陷阱，必須在 §9 manual verification 明確列出實測項目。
2. **潛在的機密外洩面**：`'process.env': process.env` 沒有任何 allowlist——它會把**建置當下這台機器 process.env 裡存在的所有變數**都序列化進公開發布的 JS 檔案，不限於這個專案自己定義的三個變數。目前檢視這個 repo 的程式碼，沒有證據顯示現在有任何額外的機密變數會出現在 frontend 建置環境裡；但這個寫法本身架構上是脆弱的——如果未來 CI/Zeabur 建置環境因為任何原因（monorepo 共用 env、CI secret 注入方式改變等）多帶了一個不該給瀏覽器看到的變數，它會在沒有任何警告的情況下直接外洩到公開 bundle。**這不是「目前已經外洩了什麼」的判斷（本分析未取得、也不會取得真實建置環境變數），而是「這個模式本身沒有安全邊界」的架構風險，建議列為上線前應該修正的項目**（例如改用 Nuxt 官方的 `runtimeConfig.public` 明確 allowlist 機制，`NUXT_PUBLIC_SITE_URL` 已經是這樣做的正確示範）。

### 2.2 README 與實際程式碼的變數名稱不一致（已有既存註記，非本次新發現）

> **✅ 已於 2026-08-27 修正，見 §11。** 以下是原始分析當下（修正前）的記錄，保留原樣供追溯。

`frontend/README.md` 記載的變數名稱與程式碼實際讀取的名稱**不一致**（`frontend/.env.example` 開頭註解已經自己記錄了這件事）：

| README 記載 | 程式碼實際讀取 |
|---|---|
| `NUXT_PUBLIC_API_BASE_URL` | `NUXT_API_BASE_URL` |
| `NUXT_PUBLIC_GTM_ID` | `VITE_GTM_ID` |
| `NUXT_PUBLIC_CDN_URL` | （不存在——CDN URL 是硬編碼字串，見 §2.3） |

在 Zeabur console 設定環境變數時，**必須以程式碼（`nuxt.config.ts`/`usePublicStore.ts`/`vue-gtm.client.ts`）為準，不能照抄 README**，否則會設定了一個程式碼根本不會讀的變數名稱，效果等於沒設定。

### 2.3 找到的 hardcoded production value

`https://d1vjl2px6hqzku.cloudfront.net/...`（CDN 圖片網址）直接硬編碼在四個檔案裡（`composables/useLaborSiteConfig.ts`、`pages/faq.vue`、`pages/labor-info.vue`、`pages/about.vue`），沒有透過任何環境變數（`README.md` 提到的 `NUXT_PUBLIC_CDN_URL` 從未真正接上）。**功能上目前沒有問題**（CDN 網址本身是公開靜態資源，非機密，也沒有 per-環境需要切換的需求），純粹記錄為「找到的 hardcoded production value」，是否要改成可設定的環境變數是產品/架構決策，不在本次分析範圍內建議動作。

`nuxt.config.ts` 裡的 `site.url: 'https://laborservice5690.com'` 與 `app.head` 的 `title`/`google-site-verification` 也都是硬編碼（不是機密，是 SEO/meta 設定，不影響部署，僅供記錄）。

---

## 3. CORS 應放行的 Origin

### 3.1 結論：正式環境只需要一個 origin

```
CORS_ALLOWED_ORIGINS=https://laborservice5690.com
```

**2026-08-27 補充**：取得舊 Laravel production env 清單後，發現 `APP_URL=https://jinfengv2.zeabur.app`，與上面這個候選值不同網域。**`APP_URL` 不能用來決定這個值**——CORS 判斷的是瀏覽器實際 request 的 `Origin` header，不是 Laravel 內部設定，正式驗證方式與這個落差本身的處理見 §13.3。此候選值維持 `PRODUCTION_MANUAL_VERIFY`，不因本次發現而改變。

### 3.2 逐項確認

- **`https://laborservice5690.com`（apex，非 www）**：✅ **需要**——這是 `nuxt.config.ts` 裡 `site.url`/`NUXT_PUBLIC_SITE_URL` 記載的正式網域，也是 `middleware/redirect-www.global.ts` 重導向的**目標**（見下一項）。
- **`https://www.laborservice5690.com`**：⚠️ **一般情況下不需要，但可視為 defense-in-depth 選項**——`frontend/middleware/redirect-www.global.ts` 在 `NODE_ENV=production` 時，對任何 `www.` 開頭或非 HTTPS 的請求，會在 **SSR 階段（`import.meta.server`）**用 301 重導向到 apex 網域，發生在瀏覽器執行任何 client-side JS 之前。也就是說，使用者只要打開 `www.laborservice5690.com`，瀏覽器會先被導到 `https://laborservice5690.com`，之後所有的 XHR/fetch（包含 `utils/http.ts` 發出的 admin API 請求）的 `Origin` header 理論上只會是 apex 網域。**加入 `www.` 版本不會造成安全問題，但目前程式碼行為下應該是多餘的**——是否加入是可以自行決定的保守選項，不是本文件判斷的阻斷項。
- **Zeabur preview/staging domain**：❌ **本次分析找不到任何已知的 staging/preview 網域**——repo 內沒有任何文件記載 Zeabur 自動產生的 preview URL（例如 `*.zeabur.app`），`frontend/README.md`、根目錄 `README.md`、`specs/` 都沒有提及。**這是一個需要人類確認的空缺，不是本文件能推導出答案的項目**——如果 Zeabur 的部署流程確實會產生 preview URL 且需要對其測試 admin 功能，需要另外把該 URL 加入 `CORS_ALLOWED_ORIGINS`(用逗號分隔，`src/config/cors.ts` 已支援)；如果 preview 環境不需要測試 admin 功能，則不需要。

### 3.3 `credentials: true` 與 frontend axios 相容性

✅ **相容，且是必要的**——`src/config/cors.ts` 設定 `credentials: true`；`frontend/utils/http.ts` 的 axios instance 也設定了 `withCredentials: true`。兩邊一致。

### 3.4 Wildcard + credentials 檢查

✅ **確認沒有這個問題**——`src/config/cors.ts` 從未使用 `origin: '*'`；`origin` 是一個 function，逐一比對 `CORS_ALLOWED_ORIGINS` 解析出的明確清單（`.split(',').map(trim).filter(Boolean)`），沒有命中就直接 `callback(new Error(...))` 拒絝。這個實作方式本身就不可能出現「wildcard + credentials」這個瀏覽器會直接拒絕的組合（瀏覽器規範本身也禁止 `Access-Control-Allow-Origin: *` 搭配 `Access-Control-Allow-Credentials: true`，但這裡是程式碼設計上就避開了，不是依賴瀏覽器擋)。

---

## 4. Zeabur Service Env Checklist

### 4.1 Backend Service（Root Directory = `backend`）

必須在 Zeabur console 設定（真實值不在本文件內）：

- [ ] `NODE_ENV=production`
- [ ] `DB_HOST`、`DB_PORT`（若非 3306）、`DB_USER`、`DB_PASSWORD`、`DB_DATABASE`（連到 Zeabur MySQL service，非本機 docker-compose 的 `jinfeng_local`）
- [ ] `JWT_SECRET`（正式、隨機、至少 16 字元，且與任何開發/測試用值不同）
- [ ] `JWT_EXPIRES_IN=30d`（或視需要選 `1d`/`7d`/`14d`；enum 只接受這 4 個值）
- [ ] `BCRYPT_SALT_ROUNDS`（可省略，預設 10 即可，除非有特別理由調整）
- [ ] `CORS_ALLOWED_ORIGINS=https://laborservice5690.com`（見 §3）
- [ ] `MAIL_HOST`/`MAIL_PORT`/`MAIL_USERNAME`/`MAIL_PASSWORD`/`MAIL_ENCRYPTION`/`MAIL_FROM_ADDRESS`/`MAIL_FROM_NAME`（若要讓 `POST /contact` 通知信真正寄出；不設定不會讓服務壞掉，只會靜默不寄信）
- [ ] `RECIPIENT_EMAIL`（同上，不設定 = 通知信靜默跳過）
- [ ] `PORT`：**通常不需要手動設定**——Zeabur 通常會自動注入，`env.ts` 也有 `8080` fallback；只有在 Zeabur 的實際行為與這個假設不符時才需要人工介入，見 §8

不需要設定（此專案架構下不存在對應變數，見 §5/§6）：`DATABASE_URL`、任何 `REDIS_*`、任何 `QUEUE_*`。

### 4.2 Frontend Service（Root Directory = `frontend`）

> **✅ 已於 2026-08-27 更新，見 §11。** 以下 checklist 已同步新的變數名稱與 runtime-only 綁定結論；原始版本（要求 build-time 注入）保留在 git 歷史供追溯。

- [ ] `NUXT_PUBLIC_API_BASE_URL=https://api.laborservice5690.com`（**只需在 container 啟動時可讀到即可，不再要求 build-time 注入**，見 §11.2 的實測結論；`NODE_ENV=production` 也只需同樣的 runtime 層級即可，兩者都是任何 PaaS 都支援的基本能力）
- [ ] `NODE_ENV=production`
- [ ] `NUXT_PUBLIC_SITE_URL=https://laborservice5690.com`（可省略，程式碼已有相同值的 fallback）
- [ ] `NUXT_PUBLIC_GTM_ID`（若要啟用 GTM；不設定只會讓 GTM 不啟用，不影響其他功能）
- [ ] **部署方式建議採用 Zeabur Nuxt 自動偵測**（見 §11.3），但仍需要有 Zeabur 存取權限的人實際嘗試部署一次以確認自動偵測行為與這份 checklist 相符——這件事本身尚未執行。

---

## 5. Variables to Remove

**沒有找到**任何現行、實際生效的設定檔（`backend/.env.example`、`backend/src/config/env.ts`、`frontend/.env.example`、`frontend/nuxt.config.ts`）裡殘留舊 Laravel 命名的環境變數（例如 `APP_KEY`、`APP_ENV`、`APP_DEBUG`、`DB_CONNECTION`、`SESSION_DRIVER`、`CACHE_DRIVER`、`MAIL_MAILER`、`QUEUE_CONNECTION`）。

`specs/backend/migration-history/docker/docker-compose.yml` 與同目錄 `.env.example` 裡確實還留著 `REDIS_HOST=redis` 字樣，但那是**舊 Laravel 系統的歷史參考文件**（`migration-history/` 目錄本身就是保留給「移轉前系統長什麼樣子」的歷史紀錄），**不是現行 `backend/docker-compose.yml` 的一部分**（現行版本已確認只有 `api`+`mysql` 兩個 service，見 §附錄與 `specs/backend/laravel-to-node-parity.md` 既有記載「確認無 Redis service」）。不需要任何動作。

---

## 6. Variables to Add

- 無需新增任何**程式碼已經在讀但 `.env.example` 沒列出**的變數——`backend/.env.example`、`frontend/.env.example` 與程式碼實際讀取的變數已核對一致（frontend 的落差是「README 寫錯名稱」，不是「code 讀了 `.env.example` 沒列出的變數」，見 §2.2）。
- 沒有發現目前架構需要、但完全不存在的變數（例如本次分析特別確認過 `REDIS_*`、`QUEUE_*` 全線不需要，見 §5）。

---

## 7. `NODE_ENV` 確認

✅ 兩邊程式碼都正確處理 `NODE_ENV`，且**都要求正式環境明確設為 `production`**（不能只是「不是 development」就當作正式環境）：

- Backend：`env.ts` 用 `z.enum(['development','test','production']).default('development')`——Zeabur 若忘記設定，會**靜默 fallback 成 `development`**，不會啟動失敗。這雖然不影響大部分業務邏輯（沒有 `if (NODE_ENV==='development')` 的功能分支），但會讓 log level 等行為偏離預期。**必須在 Zeabur 明確設定，不能依賴 default。** ⚠️ **2026-08-27 新發現**：`scripts/migrate.ts` 也依賴 `NODE_ENV`——`NODE_ENV=production` 時會**拒絕**執行 migration，除非額外帶 `--allow-production` 旗標（保護機制，避免不小心對正式 DB 跑 migration）。這代表 production 首次部署／未來的 schema migration，都必須記得帶這個旗標，否則會誤以為 migration 失敗，細節與同樣適用於 staging 的說明見 `specs/backend/staging-deployment-readiness.md` §1.2。
- Frontend：**2026-08-27 已更正**——`usePublicStore.ts` 的 `apiBaseUrl` 已不再依賴 `NODE_ENV` 分支（見 `staging-deployment-readiness.md`/上一批 Frontend Runtime Config Hardening 的紀錄），改用 `runtimeConfig.public.apiBaseUrl`，由 `NUXT_PUBLIC_API_BASE_URL` 直接覆蓋，與 `NODE_ENV` 無關。`middleware/redirect-www.global.ts`、`server/middleware/blockBadPaths.ts` 這兩處**仍然**依賴 `NODE_ENV==='production'`/`!=='production'` 的分支判斷（本批未變動），忘記設定 `NODE_ENV=production` 會讓 www 重導向與 bad-path 阻擋整組失效——這兩個仍是需要在 Zeabur 明確設定 `NODE_ENV=production` 的理由，但已經不再牽涉 API base URL。

---

## 8. `PORT` Handling

- Backend `env.ts`：`PORT` 有 `.default(8080)`，`server.ts` 用 `app.listen(env.PORT, '0.0.0.0', ...)`，`Dockerfile` 也 `EXPOSE 8080`。
- `backend/README.md` 的「Zeabur 相容性」章節明確記載「監聽 `process.env.PORT`、`0.0.0.0`」，代表這個專案的既有假設是 **Zeabur 會透過 `PORT` 環境變數動態指派埠號，應用程式必須讀取它而不是寫死**——目前程式碼確實這樣做了。
- **需要人工確認的一點**：Zeabur 對於「有 Dockerfile 且 `EXPOSE 8080`」的 service，是否一定會注入 `PORT` 環境變數、還是直接沿用 image 宣告的 `EXPOSE` 埠號——這是 Zeabur 平台行為，本分析無法從 repo 內容確認，列入 §9 manual verification。
- **2026-08-27 補充**：舊 Laravel production service 用的是 `PORT=${WEB_PORT}` 這種 Zeabur 變數 interpolation 寫法（見 §13.1 env mapping）。**這只是舊系統的既有線索，不代表 Node service 一定需要同樣設定**——決策方式與驗證步驟見 §13.2，維持 `STAGING_REQUIRED`，第一輪 staging 部署刻意不手動設定 `PORT`，用觀察 runtime env/啟動 log/`/health` 的方式決定是否需要。

---

## 9. Manual Verification Steps（無法從程式碼靜態確認，必須實際操作 Zeabur 才能驗證）

以下每一項都需要**有 Zeabur production 存取權限的人**實際操作，本次分析無法代為執行或驗證：

1. **Backend 資料庫連線**：在 Zeabur 設定 `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_DATABASE` 後，確認 `GET /ready` 回傳健康（查 DB 連線），並確認 Zeabur MySQL 是否要求 TLS/SSL 連線——**目前 `src/config/database.ts` 的 `buildPoolOptions()` 沒有設定任何 `ssl` 選項**，如果 Zeabur MySQL 強制要求 SSL，現有程式碼會連線失敗，需要另外評估是否要加上 `ssl` 設定（本次分析未變更程式碼，只記錄這個需要確認的落差）。
2. **`PORT` 實際行為**：確認 Zeabur 是否真的會注入 `PORT` 環境變數蓋過 `Dockerfile` 的 `EXPOSE 8080`（見 §8）。
3. **`CORS_ALLOWED_ORIGINS` 生效驗證**：從 `https://laborservice5690.com` 實際登入 `/auth`、操作至少一支 admin API（例如 `GET /admin/contact`），確認瀏覽器 DevTools Network 分頁沒有 CORS 錯誤。
4. **Frontend build-time env 綁定驗證（§2.1 的核心風險）**：部署後開啟瀏覽器 DevTools，確認 client-side 發出的 admin API 請求（例如登入）打的是正確的 backend 網域，**不是** `undefined/api/v2/...`。如果打錯，代表 Zeabur 的 Nuxt 建置流程沒有把 `NUXT_API_BASE_URL`/`NODE_ENV` 帶入 build 階段，需要另外解決（本次分析範圍外，需要另一個獨立任務調整建置流程或改用 `runtimeConfig`）。
5. **Frontend 部署方式拍板**：確認 Zeabur Nuxt 自動偵測 vs. 自建 `frontend/Dockerfile`（見 §8 blocker #1），這會直接影響上一項「build-time env 如何注入」的具體做法。
6. **Mail 實際寄送**：設定 `MAIL_*`/`RECIPIENT_EMAIL` 後，實際觸發一次 `POST /contact`，確認真的收到通知信（本次分析只能確認「有設定就會嘗試寄」的程式碼邏輯，無法驗證真實 SMTP 憑證是否有效）。
7. **`JWT_SECRET` 正式值**：確認 Zeabur 上設定的是全新產生的正式密鑰，不是本機開發/測試用的值，且與任何其他環境不共用。
8. **Zeabru preview/staging domain 是否存在**：若存在且需要測試 admin 功能，把該 domain 加入 `CORS_ALLOWED_ORIGINS`（見 §3.2）。
9. **（2026-08-27 新增）DB Host：private/internal vs public cluster**：確認 Zeabur 是否為同 project 的 MySQL 提供 project-internal host，並依 §13.4 的前提條件清單在 staging 環境（非 production）逐項驗證後，才能決定 production 要用哪一種連線方式。
10. **（2026-08-27 新增）`PORT` 決策的具體驗證步驟**：見 §13.2——staging 部署第一輪不手動設定 `PORT`，改為觀察 Zeabur runtime env、應用程式啟動 log、`/health` 三者確認是否需要。

---

## 10. Deployment Blockers（依嚴重度排序，狀態已依 §11 更新）

| # | 阻斷項 | 嚴重度 | 說明 |
|---|---|---|---|
| 1 | Frontend 部署方式尚未**正式決定**（Zeabur Nuxt 自動偵測 vs. 自建 Dockerfile） | 🟡 中（原🔴高，見 §11.3） | 根目錄 `README.md` 仍記載「留待後續獨立任務決定」——本批（§11）已完成程式碼面比較分析並給出**建議**（採自動偵測），但**尚未有人實際拍板／實際部署驗證**，維持待確認狀態 |
| 2 | ~~`NUXT_API_BASE_URL` 必須在 frontend 建置階段可讀到~~ | ✅ **已解決**（§11.1/§11.2） | 本批已改用 Nuxt 標準 `runtimeConfig.public` 機制，`NUXT_PUBLIC_API_BASE_URL` 改為可在**容器啟動時（runtime）**注入，不再要求 build-time 綁定；已用 production build 實測確認（`/auth`、`/admin/contact` 在不重新建置的情況下正確套用新的 runtime 環境變數），細節見 §11.2 |
| 3 | ~~`vite.define: {'process.env': process.env}` 沒有 allowlist~~ | ✅ **已解決**（§11.1） | 已完全移除，改用明確的 `runtimeConfig.public` allowlist（僅 `apiBaseUrl`/`siteUrl`/`gtmId` 三個 key） |
| 4 | `CORS_ALLOWED_ORIGINS` 正式值尚未設定 | 🟡 中 | **本批未變動**——機制完全就緒（§3.3/§3.4 皆通過檢查），純粹是「還沒有人在 Zeabur 填上這個值」，一旦填上 `https://laborservice5690.com` 即完成。**這不算 production 已驗證**，見 §11.4 |
| 5 | Zeabur MySQL 是否要求 SSL 連線尚未確認（§9 第 1 項） | 🟡 中 | 本批未變動，backend 範圍，本次分析僅限 frontend |
| 6 | ~~`frontend/README.md` 記載的變數名稱與程式碼不符~~ | ✅ **已解決**（§11.1） | README 已同步更新，三個變數名稱與程式碼完全一致 |

**#1/#4/#5 仍需要有 production 存取權限的人接手驗證或拍板，非本次分析可代為完成。#2/#3/#6 是純 code/config 層面的修正，已透過實際 build + 本機 production-mode server 測試驗證，但同樣不等於 Zeabur production 已驗證，見 §11.4。**

---

## 11. Frontend Env/Config Hardening — 實作結果（2026-08-27，後續批次）

> 本節記錄針對 §2.1/§10 阻斷項 #1/#2/#3/#6 的實際修正。**本批只修改 `frontend/` 與本文件／`laravel-to-node-parity.md`，未修改任何 backend 檔案、未修改 Zeabur production、未讀取或輸出任何真實 secret。**

### 11.1 修正內容

- `frontend/nuxt.config.ts`：新增明確的 `runtimeConfig.public = {apiBaseUrl, siteUrl, gtmId}`（皆有安全的本機開發預設值，正式環境由 `NUXT_PUBLIC_API_BASE_URL`/`NUXT_PUBLIC_SITE_URL`/`NUXT_PUBLIC_GTM_ID` 覆蓋——Nuxt 標準 `NUXT_PUBLIC_<KEY>` override 慣例，非本專案自訂邏輯）。**完全移除** `vite.define: {'process.env': process.env}` 與已死的 `vite.server.proxy['/api']`（後者本來就沒有任何呼叫方依賴，且讀取的是本批同時淘汰的 `NUXT_API_BASE_URL` 舊名稱）。
- `frontend/store/usePublicStore.ts`：`apiBaseUrl` 改為 `computed(() => \`${useRuntimeConfig().public.apiBaseUrl}/api/v2\`)`。本機開發 fallback 從舊的 `http://127.0.0.1:9001`（**已確認是過時的殘留值**——舊 Laravel 後端才用 9001，現在的 Node 後端 `backend/docker-compose.yml`/`backend/.env.example` 皆為 `8080`）修正為 `http://127.0.0.1:8080`，與 backend 實際本機 port 對齊。
- `frontend/utils/http.ts`：`baseURL` 不再是 axios instance 建立時的靜態值，改到與 Authorization header 同一個 request interceptor 內、每次 request 才讀取 `apiBaseUrl.value`——這同時是為了「不在 module top-level 呼叫只能在 composable context 使用的 `useRuntimeConfig()`」（`computed` 的 getter 是 lazy 的，直到 interceptor 真正執行時才會第一次觸發 `useRuntimeConfig()`，此時一定在真實 request 的呼叫堆疊內，情境安全）。
- `frontend/plugins/vue-gtm.client.ts`：`import.meta.env.VITE_GTM_ID` 改成 `useRuntimeConfig().public.gtmId`（`defineNuxtPlugin` callback 本身就是合法的 composable context）。
- `frontend/.env.example`：只保留 `NUXT_PUBLIC_API_BASE_URL`/`NUXT_PUBLIC_SITE_URL`/`NUXT_PUBLIC_GTM_ID` 三個變數，使用安全佔位值（本機位址，非正式網域/密鑰）。
- `frontend/README.md`：環境變數章節改為指向 `.env.example`（唯一真相來源），移除已不存在的 `NUXT_PUBLIC_CDN_URL` 條目並加註「CDN 網址是寫死字串，沒有對應環境變數」。

搜尋確認（`grep`）：`NUXT_API_BASE_URL`、`VITE_GTM_ID`、`vite.define`/`process.env` 整包注入模式，在 `frontend/` 全部原始碼中**已無殘留**（`nuxt.config.ts` 內僅剩解釋「已移除」的註解文字本身包含這些字串，非實際生效程式碼）；`process.env.NODE_ENV` 的既有用法（`middleware/redirect-www.global.ts`、`server/middleware/blockBadPaths.ts`）維持不動——這是 Vite 內建、與本次移除的自訂 `define` 無關的標準行為，本批刻意不動。

### 11.2 ⚠️ 對 §2.1/§10 阻斷項 #2 的重要更正——build-time binding 疑慮已解除

`production-env-readiness.md` 初版（本文件 §2.1）曾判斷 `NUXT_API_BASE_URL` 必須在**建置階段**可讀到，否則 client-side 請求全部失敗，並列為 🔴 高風險阻斷項。**改用 `runtimeConfig.public` 後，這個疑慮已用實測排除**：

- 用一份**完全沒有設定 `NUXT_PUBLIC_API_BASE_URL` 的 production build**（`npm run build`，`.output/server/index.mjs`）先產生一份「凍結」了預設值的 build。
- 接著**不重新建置**，只在啟動 `node .output/server/index.mjs` 這個既有指令時，額外帶入 `NUXT_PUBLIC_API_BASE_URL=https://runtime-only-test.example.com`（純粹是啟動當下的 container env，模擬 Zeabur 只在 runtime 注入變數、build 階段完全沒帶入的情境）。
- 結果：`/auth`、`/admin/contact`（這兩個真正會呼叫 backend API 的頁面）**正確反映了這個 runtime-only 的新值**，證明 Nuxt 的 `runtimeConfig.public` 機制在這個專案的 Nitro `node-server` preset 下，**確實支援純 runtime 注入，不需要 rebuild**。
- 唯一的例外是首頁 `/`（`routeRules` 設定了 `isr: 259200`，3 天增量快取）——ISR 快取頁面在快取有效期間會回傳建置當下（或上次重新產生快取當下）凍結的值，這是 ISR 快取本身的預期行為，**與 runtimeConfig 機制無關**，且首頁本來就不呼叫任何 backend API，不受影響。

**結論**：Zeabur 的 Nuxt 自動偵測（或未來的 Dockerfile）只要能在**容器啟動時**把 `NUXT_PUBLIC_API_BASE_URL` 等變數注入為一般環境變數即可，**不需要**額外確保它們在 `npm run build` 執行的當下就存在——這大幅降低了 §10 阻斷項 #1（部署方式未決定）的急迫性，因為不論最終選哪種部署方式，只要能設定「container 啟動時的環境變數」這個所有 PaaS 都支援的最基本能力即可，不需要額外的「build-time secret 注入」機制。

### 11.3 Deployment Strategy 分析與建議：A（Zeabur Nuxt 自動偵測）優先於 B（自建 Dockerfile）

依 `package.json`（`build`: `nuxt build`）與本批實測的 build output（`.output/server/index.mjs`，Nitro `node-server` preset，`.output/public` 靜態資源）：

- ✅ `npm ci` → ✅ `npm run build` → ✅ `node .output/server/index.mjs` 這條標準 Nuxt 3 SSR 產出鏈完整可用，本批已反覆用乾淨環境實測確認（多次 `rm -rf .output .nuxt` 全新建置 + 啟動 + 多輪請求，皆穩定回應 200，見 §11.2 的驗證方法）。
- ✅ `NUXT_PUBLIC_*` 系列環境變數已確認支援純 runtime 注入（§11.2），符合 Zeabur Nuxt 自動偵測「偵測 `nuxt.config.ts`/`package.json`、`npm ci`+建置、以 `NUXT_`/`NUXT_PUBLIC_` 慣例注入變數」的標準模式。
- ⚠️ 唯一的風險點：`package.json` 的 `sharp`（`^0.32.6`，圖片處理原生模組，`@nuxt/content` 相關依賴）——原生二進位模組在不同建置環境間偶有平台相容性問題。這是**否走 Dockerfile 都會遇到的風險**（Dockerfile 一樣需要在 `node:22-alpine` 或類似 base image 上正確安裝 `sharp` 的原生 binary），不是自動偵測特有的缺點，因此**不構成偏好 Dockerfile 的理由**。

**建議：優先採用 Zeabur Nuxt 自動偵測（方案 A），不要為了容器化而新增 `frontend/Dockerfile`**，除非實際在 Zeabur 上嘗試自動偵測後發現它無法正確處理這個專案的 build/start 指令或 `sharp` 原生模組安裝（本次分析僅能在本機驗證建置產物本身正確，**無法**驗證 Zeabur 平台本身的自動偵測行為，這件事本身就是 §9 manual verification 清單的一部分，需要有 Zeabur 存取權限的人實際嘗試部署後才能確認）。若自動偵測不可靠，再視實測結果補一支 Dockerfile。

### 11.4 ⚠️ 本批仍未驗證、不得視為 DONE 的項目

- **CORS production origin 仍未在 Zeabur 實際設定**——本批完全沒有觸碰這件事，狀態與 §3/§9 相同，維持 ⚠️ 未達成。
- **Zeabur production 本身未經任何驗證**——本批的所有測試（build、production-mode 本機 server、runtime env override）都在**本機**執行，**沒有一項是對 Zeabur 實際環境的驗證**。
- **staging 環境未經任何測試**——本批未涉及。
- 以上三項在 `laravel-to-node-parity.md` 的同步更新中，**明確不標記為 DONE**，見該文件的對應章節。

---

## 12. Staging Deployment Readiness（2026-08-27，另開文件）

**staging 環境的部署 readiness 分析（backend/frontend Zeabur config、staging 專屬 env matrix、staging CORS、staging DB 規劃、mail safety、seed 策略、E2E checklist、rollback plan、production blockers 重新分類）已獨立成專屬文件：`specs/backend/staging-deployment-readiness.md`。** 本文件（production-env-readiness.md）維持只涵蓋 **production** 的分析，兩份文件的建議值不同，不要混用（例如：production 的 `CORS_ALLOWED_ORIGINS` 是 `https://laborservice5690.com`，staging 是完全不同的 `https://<frontend-staging-domain>`；DB/JWT_SECRET/mail 亦然，兩邊必須互相獨立）。

---

## 13. Legacy Laravel Production Env Mapping（2026-08-27）

> 本節記錄「舊 Laravel Zeabur production 環境變數清單」與 Node backend 所需變數的對照分析。**本節只做分析與規劃，未修改 production service，未輸出任何真實 secret 值**——下表只列變數名稱與「沿用/改名/新產生/移除/待確認」的判斷，不含任何實際密碼、金鑰、連線字串。
>
> **核心原則（本節據此重新檢視先前部分結論）**：舊 Laravel service 的既有設定值，只能當作「這個系統過去長什麼樣子」的線索，**不能直接當成新 Node service 應該怎麼設定的事實**——PORT、CORS 兩項先前的判斷方向即依此原則重新修正，見 §13.2/§13.3。

### 13.1 逐項 Mapping 總表

| 舊 Laravel 變數 | 分類 | Node 對應 | 說明 |
|---|---|---|---|
| `DB_HOST` | 沿用（值待 §13.4 決策） | `DB_HOST` | 見 §13.4——**不預先假設**要沿用公開 cluster host |
| `DB_PORT` | 沿用 | `DB_PORT` | 隨 §13.4 的 host 選擇一併決定 |
| `DB_USERNAME` | **改名** | `DB_USER` | key 名稱不同，值相同；漏改會讓 `loadEnv()` 因缺少必填的 `DB_USER` 直接啟動失敗 |
| `DB_PASSWORD` | 沿用（但見 §13.7 rotation） | `DB_PASSWORD` | |
| `DB_DATABASE` | 沿用 | `DB_DATABASE` | |
| `MAIL_HOST` | 沿用 | `MAIL_HOST` | |
| `MAIL_PORT` | 沿用 | `MAIL_PORT` | |
| `MAIL_USERNAME` | 沿用（但見 §13.7 rotation） | `MAIL_USERNAME` | |
| `MAIL_PASSWORD` | 沿用（但見 §13.7 rotation） | `MAIL_PASSWORD` | |
| `MAIL_ENCRYPTION` | 沿用 | `MAIL_ENCRYPTION` | 值落在 Node enum(`tls`/`ssl`/`none`)內，合法 |
| `MAIL_FROM_NAME` | 沿用 | `MAIL_FROM_NAME` | |
| `RECIPIENT_EMAIL` | 沿用 | `RECIPIENT_EMAIL` | |
| `PORT=${WEB_PORT}` | **不預先沿用**，見 §13.2 | `PORT` | 舊 service 這樣設定，**不代表新 service 一定需要**——維持 `STAGING_REQUIRED`，用實測決定 |
| `APP_URL` | 僅供參考，**不用於決策** | 無直接對應 | 見 §13.3——不能拿它決定 `CORS_ALLOWED_ORIGINS` |
| （清單中無對應） | **全新，需產生** | `JWT_SECRET` | 不可沿用 `APP_KEY`（用途完全不同：Laravel 加解密 vs Node JWT 簽章），必須另外產生全新隨機值，且需納入 §13.7 rotation checklist（**首次產生也算一種 rotation**，因為這是全新機密，沒有「舊版本」可對照） |
| （清單中無對應） | **全新，需決定** | `CORS_ALLOWED_ORIGINS` | 見 §13.3 |
| （清單中無對應） | **全新，需決定** | `MAIL_FROM_ADDRESS` | 見 §13.5 |
| （清單中無對應） | 新（有 default，可選） | `NODE_ENV`/`JWT_EXPIRES_IN`/`BCRYPT_SALT_ROUNDS`/`LOG_LEVEL` | 建議明確設定而非依賴 default，但不阻斷 |
| `PASSWORD` | **不搬到 Node，不刪除舊 service** | 無對應 | 見 §13.6 |
| `APP_DEBUG`/`APP_ENV`/`APP_KEY`/`APP_NAME`/`BROADCAST_DRIVER`/`CACHE_DRIVER`/`DB_CONNECTION`/`LOG_CHANNEL`/`MAIL_DRIVER`/`MIX_PUSHER_*`/`PUSHER_*`/`QUEUE_CONNECTION`/`REDIS_*`/`SESSION_DRIVER`/`SESSION_LIFETIME` | **不搬到 Node**，**不刪除舊 Laravel service** | 無對應 | 見 §13.6 完整清單與理由 |
| `JENFENG_BACK_*`/`JINFENG_FRONT_*`（6 個 Zeabur 內部 service 參照） | 與此次遷移無關 | 無對應 | 疑似同一 Zeabur 帳號下其他專案的 service 參照（命名如 `LORIER`/`THELES`/`MOTY`），不動它，不搬到新 backend |
| `MYSQL_HOST=service-...` | 待確認，見 §13.4 | 可能是 `DB_HOST` 的內網替代值 | Zeabur 內部 service 參照格式，可能是同一個 MySQL 的 private network 位址 |

### 13.2 PORT 決策：**維持 `STAGING_REQUIRED`，不因舊 Laravel 設定而改變**

**修正先前分析方向**：舊 Laravel service 用 `PORT=${WEB_PORT}` 這個 Zeabur 變數 interpolation 語法，**這只證明「舊系統當時是這樣設定的」，不能證明「Node service 也需要同樣設定」**——兩個 service 是否共用同一種 PORT 注入機制，取決於 Zeabur 平台本身對「有 Dockerfile 的 service」的處理方式，而 Node backend 用 Dockerfile 部署、Laravel 未必是同一種部署形態，不能一概而論。

Node backend 本身已經完整支援標準的動態 PORT 機制，不需要額外設定就能運作：
- `src/config/env.ts`：`PORT` 讀自 `process.env.PORT`，`.default(8080)`
- `src/server.ts`：`app.listen(env.PORT, '0.0.0.0', ...)`
- `Dockerfile`：`EXPOSE 8080`

**Staging 實際驗證方式（第一輪不手動設定 `PORT`）**：
1. 部署 backend staging service 時，**先不要**手動加 `PORT=${WEB_PORT}` 或任何 `PORT` 值。
2. 觀察三件事：
   - Zeabur console 的 service runtime env（Zeabur 是否有自動注入 `PORT`，值是多少）
   - Application 啟動 log 裡的 `Server listening on 0.0.0.0:${env.PORT} (...)`（`src/server.ts` 已有這行 log，可以直接看到程式實際綁定的 port）
   - `curl https://<backend-staging-domain>/health` 是否正常回應
3. **只有在 `/health` 打不通、且確認是 port 綁定/路由不對造成**，才加上 `PORT=${WEB_PORT}`（或其他 Zeabur 要求的值）重新測一次。

**不得把舊 Laravel service 的設定當成新 service 的既定事實。**

### 13.3 CORS 決策：**候選值不變，但驗證方式必須基於瀏覽器實際 Origin，不是 `APP_URL`**

**修正先前分析方向**：`APP_URL=https://jinfengv2.zeabur.app` 只能記錄成「舊系統設定裡的一條線索」（`stale/legacy configuration clue`），**不能用它來決定 `CORS_ALLOWED_ORIGINS`**——CORS 檢查的是瀏覽器實際發出請求時的 `Origin` header，跟 Laravel 自己設定的 `APP_URL`（Laravel 內部用於產生連結、非 CORS 用途）是兩件事，即使兩者當初設計上「應該」一致，也不能假設現在仍然一致。

**目前的 production 候選值維持不變**：
```
CORS_ALLOWED_ORIGINS=https://laborservice5690.com
```
（依據：`frontend/nuxt.config.ts`/`frontend/README.md` 目前記載的正式網域）

**但正式狀態維持 `PRODUCTION_MANUAL_VERIFY`**，不因為本節分析而改變成已驗證。正式驗證方式：

1. 開啟瀏覽器實際訪問目前的 production frontend。
2. DevTools → Network，觸發任一支會打 backend API 的請求（例如登入）。
3. 檢查該 request 的 **Request Headers** 裡的 `Origin` 欄位實際值。
4. 若 `Origin` 確實是 `https://laborservice5690.com`，則上述 `CORS_ALLOWED_ORIGINS` 候選值成立；若不是（例如瀏覽器實際打開的是 `jinfengv2.zeabur.app` 或其他網域），`CORS_ALLOWED_ORIGINS` 必須改成瀏覽器實際回報的那個值，不是任何文件裡記錄的「應該是」的值。

`APP_URL=https://jinfengv2.zeabur.app` 與 `laborservice5690.com` 之間的落差，只登記為待確認的既有線索，見 §14 production cutover 未解決項目。

### 13.4 Database Host 決策：Public Cluster Host vs. Zeabur Project-Internal Host

**修正先前分析方向**：不預先認定 production 的 `DB_HOST` 必須沿用舊 Laravel 用的公開 cluster host（`hkg1.clusters.zeabur.com`）。

**新增待確認項**：Zeabur 是否為同一 project 內的服務提供 **project-internal/private network host**（舊 env 清單裡的 `MYSQL_HOST=service-667908be1ec5614c11f64c2f` 疑似就是這種內部參照格式，與公開的 `hkg1.clusters.zeabur.com:31671` 是兩個不同的連線方式）。

| 選項 | 說明 |
|---|---|
| A. Private/internal MySQL host | 若 Node backend service 與這個 MySQL 部署在同一個 Zeabur project，內網連線通常更快（不經過公網）、也更安全（不暴露在公開端點）。**優先推薦**，但有前提條件（見下）。 |
| B. Public cluster host（`hkg1.clusters.zeabur.com:31671`） | 舊 Laravel 一直以來使用的方式，已知可行（本次分析已用這個位址成功連線並執行唯讀 schema 驗證）。 |

**採用 A 的前提條件（必須在 staging 全部驗證通過才能考慮用於 production）**：
- [ ] 用 private host 值實測連線成功
- [ ] 確認是否需要額外的 SSL/TLS 設定（`buildPoolOptions()` 目前完全沒有 `ssl` 選項，這本身也是既有的待確認項）
- [ ] `npm run db:migrate -- --allow-production` 對 private host 執行成功
- [ ] `npm run db:verify` 對 private host 執行成功、schema 結果與用 public host 驗證的結果一致
- [ ] 確認 private host 在 Zeabur service 重啟/重新部署後位址是否穩定（不會變動），若會變動則不適合硬編碼進環境變數

**在以上全部驗證通過前，`DB_HOST` 的 production 決策維持 `STAGING_REQUIRED`（且明確排除 production 資源）**——staging 階段本來就該用獨立的 staging MySQL 測試連線方式，不會用這組 production 憑證去測 A/B（測 A/B 選項應該用 staging 自己的 MySQL 是否也提供 private host 的方式驗證機制本身可行，不是拿 production DB 來回切換連線方式做實驗）。

### 13.5 `MAIL_FROM_ADDRESS` 建議

舊 Laravel env 清單裡沒有這個變數。目前 production mail 是 Gmail SMTP（`MAIL_HOST=smtp.gmail.com`）。

**建議預設值**：
```
MAIL_FROM_ADDRESS = <與 MAIL_USERNAME 相同的 Gmail 地址>
```
理由：Gmail SMTP 對於「寄件人地址跟登入帳號不一致」這件事通常會被拒絕或強制覆寫（Gmail 的 SMTP relay 基本上只允許用已驗證的帳號地址當寄件人，除非另外設定 alias），用 `MAIL_USERNAME` 的值當 `MAIL_FROM_ADDRESS` 是最不容易出錯的預設選擇。

**標記為 `PRODUCTION_MANUAL_VERIFY`**——本節只給預設建議，不代表這是唯一正確答案或已經確認過；正式設定前建議實際寄一封測試信確認寄件人顯示正確、沒有被 Gmail 擋下或改寫。

### 13.6 `PASSWORD` 變數：兩邊都不動

- **新 Node backend service**：不搬——Node 原始碼裡沒有任何地方讀取名為 `PASSWORD` 的環境變數，加了也不會被使用。
- **舊 Laravel production service**：**不刪除**，直到 production cutover 完成且已經明確確認這個變數的實際用途為止（見 §14 待確認清單）——在還不知道它是給誰用的情況下貿然刪除，有可能弄壞某個依賴它的其他機制。

### 13.7 Legacy 變數不搬清單（重申，不修改舊 Laravel service 本身）

以下變數**不會出現在新 Node backend service 的環境變數設定裡**：

```
APP_DEBUG
APP_ENV
APP_KEY
APP_NAME
APP_URL
BROADCAST_DRIVER
CACHE_DRIVER
DB_CONNECTION
LOG_CHANNEL
MAIL_DRIVER
MIX_PUSHER_APP_CLUSTER
MIX_PUSHER_APP_KEY
PUSHER_APP_CLUSTER
PUSHER_APP_ID
PUSHER_APP_KEY
PUSHER_APP_SECRET
QUEUE_CONNECTION
REDIS_HOST
REDIS_PASSWORD
REDIS_PORT
SESSION_DRIVER
SESSION_LIFETIME
```

**這份清單只影響「新 Node service 要不要設定這些變數」（不要），完全不代表要去舊 Laravel production service 上刪除或修改任何東西**——舊 service 在 cutover 完成、確認新 service 完全接手流量之前，應該維持原樣繼續運作。本次分析全程未觸碰舊 Laravel service 的任何設定。

### 13.8 Security Rotation Checklist（正式 cutover 前必須完成，本節只列項目，不執行）

以下三項**必須**在正式 cutover checklist 裡明確列出，且**不得**在任何文件（含本文件）中記錄實際 rotate 後的新值：

- [ ] **Rotate production DB credential**（`DB_PASSWORD`）——目前這組密碼已經在對話中以明文分享/使用過，即使只在這次分析用於唯讀查詢，仍建議 cutover 前更換
- [ ] **Rotate SMTP credential**（`MAIL_PASSWORD`，Gmail App Password）
- [ ] **Generate fresh `JWT_SECRET`**——這不是「rotate」既有值（因為 Node 這邊從來沒有過 `JWT_SECRET`），而是**首次產生一把全新、只給 Node 用、任何人（含這次對話紀錄）都沒看過的隨機值**，用 `openssl rand -hex 32` 之類的方式在 Zeabur console 直接產生/貼上，不要先在本機草稿、對話、或任何檔案裡打過一次再貼過去

### 13.9 Production Node Env Template（僅 key/placeholder，無真實值）

```
NODE_ENV=production
PORT=<見 §13.2，第一輪先不設，視 staging 實測結果決定是否需要>

DB_HOST=<見 §13.4，待 A/B 決策>
DB_PORT=<隨 DB_HOST 決策>
DB_USER=<沿用舊 DB_USERNAME 的值，rotate 後更新，見 §13.8>
DB_PASSWORD=<rotate 後的新值，見 §13.8>
DB_DATABASE=<沿用舊 DB_DATABASE 的值>
DB_CONNECTION_LIMIT=10

JWT_SECRET=<全新產生，見 §13.8，不可為空、不可沿用 APP_KEY>
JWT_EXPIRES_IN=30d
BCRYPT_SALT_ROUNDS=10

CORS_ALLOWED_ORIGINS=<見 §13.3，待瀏覽器 Origin 實測確認>

MAIL_HOST=<沿用舊值>
MAIL_PORT=<沿用舊值>
MAIL_USERNAME=<沿用舊值>
MAIL_PASSWORD=<rotate 後的新值，見 §13.8>
MAIL_ENCRYPTION=<沿用舊值>
MAIL_FROM_ADDRESS=<見 §13.5 建議，PRODUCTION_MANUAL_VERIFY>
MAIL_FROM_NAME=<沿用舊值>
RECIPIENT_EMAIL=<沿用舊值>
```

此模板**不含任何真實值**，僅供 cutover 執行時對照填寫。
