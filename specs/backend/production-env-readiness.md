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

- Backend：`env.ts` 用 `z.enum(['development','test','production']).default('development')`——Zeabur 若忘記設定，會**靜默 fallback 成 `development`**，不會啟動失敗。這雖然不影響大部分業務邏輯（沒有 `if (NODE_ENV==='development')` 的功能分支），但會讓 log level 等行為偏離預期。**必須在 Zeabur 明確設定，不能依賴 default。**
- Frontend：`usePublicStore.ts`、`middleware/redirect-www.global.ts`、`server/middleware/blockBadPaths.ts` 都有 `NODE_ENV==='production'`/`!== 'production'` 的分支判斷，**忘記設定會讓 API base URL 回退到 `http://127.0.0.1:9001`（開發用的本機位址）、www 重導向與 bad-path 阻擋整組失效**——這比 backend 的情況嚴重得多，是真正的功能性阻斷項，不只是觀測面的差異。

---

## 8. `PORT` Handling

- Backend `env.ts`：`PORT` 有 `.default(8080)`，`server.ts` 用 `app.listen(env.PORT, '0.0.0.0', ...)`，`Dockerfile` 也 `EXPOSE 8080`。
- `backend/README.md` 的「Zeabur 相容性」章節明確記載「監聽 `process.env.PORT`、`0.0.0.0`」，代表這個專案的既有假設是 **Zeabur 會透過 `PORT` 環境變數動態指派埠號，應用程式必須讀取它而不是寫死**——目前程式碼確實這樣做了。
- **需要人工確認的一點**：Zeabur 對於「有 Dockerfile 且 `EXPOSE 8080`」的 service，是否一定會注入 `PORT` 環境變數、還是直接沿用 image 宣告的 `EXPOSE` 埠號——這是 Zeabur 平台行為，本分析無法從 repo 內容確認，列入 §9 manual verification。

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
