# Zeabur Staging Deployment Runbook

> 寫於 2026-08-27。**本文件是可執行的部署步驟手冊**，把 `specs/backend/staging-deployment-readiness.md` 的分析結論轉成「照順序做」的操作清單。**本次產出只是文件本身**——未實際操作 Zeabur、未建立/修改任何 Zeabur service、未修改 production service、未修改 production DNS、未使用 production DB、未輸出任何真實 secret、未 commit、未 push。
>
> 執行者：需要 Zeabur console 存取權限的人（本次分析無法代為操作，只能提供步驟）。
> 前置閱讀：`specs/backend/staging-deployment-readiness.md`（分析與理由）、`specs/backend/production-env-readiness.md`（production 對照組，兩者建議值不可混用）。

---

## 0. 目標架構總覽

```
Repository: qaz326978547/jinfeng-monorepo
Branch:     integration/monorepo

┌─────────────────────┐     ┌─────────────────────┐     ┌──────────────────────┐
│ Zeabur MySQL         │◄────│ Backend staging      │◄────│ Frontend staging     │
│ (staging 專用)        │     │ Root Dir: backend    │     │ Root Dir: frontend   │
│ 獨立於 production      │     │ Dockerfile deploy    │     │ Nuxt 自動偵測         │
└─────────────────────┘     └─────────────────────┘     └──────────────────────┘
```

三個 service 互相獨立，**不與 production 共用任何資源**（DB、CORS allowlist、JWT_SECRET、GTM 容器皆各自獨立）。

---

## 1. 建立 Backend Staging Service

### 1.1 Zeabur Service 設定

| 欄位 | 值 |
|---|---|
| Repository | `qaz326978547/jinfeng-monorepo` |
| Branch | `integration/monorepo` |
| Root Directory | `backend` |
| 部署方式 | Dockerfile（`backend/Dockerfile`，Zeabur 偵測到 Dockerfile 會直接用，不需要額外指定 build command） |
| Build target | 不需要手動指定——Dockerfile 最後一個 stage 是 `production`，Docker 預設行為（無 `--target`）就是 build 最後一個 stage |

### 1.2 Port 行為

- `Dockerfile` 內 `EXPOSE 8080`；`src/config/env.ts` 的 `PORT` 從 `process.env.PORT` 讀取，`.default(8080)`；`src/server.ts` 用 `app.listen(env.PORT, '0.0.0.0', ...)`。
- **預期**：Zeabur 會自動注入 `PORT` 環境變數，backend 會監聽該 port，`0.0.0.0` bind 已正確處理，Zeabur 的反向代理可以正常轉發。
- ⚠️ **手動確認項**（本文件無法從程式碼確認）：Zeabur 是否真的會注入 `PORT`，或是直接沿用 image 的 `EXPOSE 8080`——部署後第一件事就是確認 service 實際監聽的 port 與 Zeabur 對外路由的 port 一致（見 §8 E2E 第一步）。
- ⚠️ **2026-08-27 明確排除的錯誤做法**：取得舊 Laravel production env 清單後，發現舊 service 用 `PORT=${WEB_PORT}`。**這不代表 Node staging/production service 也要照抄這個設定**——舊 service 的既有設定只是線索，不是新 service 的事實。**第一輪部署 backend staging 時，`PORT` 環境變數留白，不手動設定任何值**，改用以下方式觀察：
  1. Zeabur console 的 service runtime env（看 Zeabur 有沒有自動注入 `PORT`、值是多少）
  2. 應用程式啟動 log 裡的 `Server listening on 0.0.0.0:${env.PORT} (...)`（`src/server.ts` 已有這行 log）
  3. `curl https://<backend-staging-domain>/health` 是否正常
  只有在確認 `/health` 打不通、且原因是 port 綁定/路由不對，才嘗試加上 `PORT=${WEB_PORT}` 或其他值重新測一次。詳細理由見 `production-env-readiness.md` §13.2。

### 1.3 Health / Ready Endpoint

| Endpoint | 用途 | 是否查 DB |
|---|---|---|
| `GET /health` | Liveness（Zeabur/Docker HEALTHCHECK 用） | 否 |
| `GET /ready` | Readiness（本 runbook 用來確認部署完成、DB 連線正常） | 是 |

若 Zeabur console 有「Health Check Path」欄位，設定為 `/health`（**不要**設成 `/ready`——`/ready` 查 DB，資料庫還沒接上前會一直不健康，可能讓 Zeabur 誤判部署失敗並重啟迴圈）。

### 1.4 Staging Backend Env Checklist（不填真實值，部署前逐項在 Zeabur console 設定）

```
NODE_ENV=production
# PORT — 第一輪不設定，見 §1.2 的觀察步驟，只有證明必要才加上

DB_HOST=<staging-mysql-host>          # 見 §3，指向 staging MySQL，不是 production
DB_PORT=3306
DB_USER=<staging-only-user>
DB_PASSWORD=<staging-only-password>   # 與 production 不同
DB_DATABASE=<staging-database-name>   # 建議含 staging 字樣，例如 jinfeng_staging
DB_CONNECTION_LIMIT=10

JWT_SECRET=<staging 專屬、全新產生、與 production 不同>
JWT_EXPIRES_IN=30d
BCRYPT_SALT_ROUNDS=10

CORS_ALLOWED_ORIGINS=https://<frontend-staging-domain>   # 見 §6，部署 frontend 後才知道實際網址

# Mail — 第一輪留空，見 §5
MAIL_HOST=
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=no-reply@example.com
MAIL_FROM_NAME=Jinfeng
RECIPIENT_EMAIL=
```

**注意執行順序上的雞生蛋問題**：`CORS_ALLOWED_ORIGINS` 需要 frontend staging 的網址，但 frontend staging 部署時又需要 backend staging 的網址（`NUXT_PUBLIC_API_BASE_URL`）。建議：先各自用預設/暫時值部署一次拿到兩邊的網址，再回頭把 `CORS_ALLOWED_ORIGINS` 和 `NUXT_PUBLIC_API_BASE_URL` 補上正確值並重新部署一次（Zeabur 環境變數變更通常會觸發重新部署或至少需要 restart，兩者皆非破壞性操作）。

---

## 2. 建立 Frontend Staging Service

### 2.1 Zeabur Service 設定

| 欄位 | 值 |
|---|---|
| Repository | `qaz326978547/jinfeng-monorepo` |
| Branch | `integration/monorepo` |
| Root Directory | `frontend` |
| 部署方式 | **Zeabur Nuxt 自動偵測**（不建立 Dockerfile，理由見 `production-env-readiness.md` §11.3——已用本機 production build 反覆驗證 `npm ci`→`npm run build`→`node .output/server/index.mjs` 這條鏈路穩定可用） |

### 2.2 Build / Start 鏈

```
npm ci
npm run build              # nuxt build → .output/server/index.mjs + .output/public
node .output/server/index.mjs
```

`package.json` 沒有 `"start"` script**不是問題**——Zeabur 的 Nuxt 自動偵測本來就是直接執行 Nitro `node-server` preset 的標準產出路徑，不透過 `npm start`。

### 2.3 Staging Frontend Env Checklist

```
NUXT_PUBLIC_API_BASE_URL=https://<backend-staging-domain>   # 指向 §1 部署完成後拿到的 backend staging 網址
NUXT_PUBLIC_SITE_URL=https://<frontend-staging-domain>      # 指向這個 service 自己的網址，不要留成 production 網域
NUXT_PUBLIC_GTM_ID=                                          # 建議留空，staging 流量不應混進正式 GTM 統計
```

已在前一批（Frontend Runtime Config Hardening）用本機 production build 實測確認：**這三個變數只需要在 container 啟動時（runtime）可讀到即可，不需要在 `npm run build` 執行的當下就存在**——代表 Zeabur 只要能把它們當一般環境變數注入到執行中的 container，就不需要額外的 build-time secret 注入機制。

---

## 3. 建立獨立 Staging MySQL

### 3.1 原則

**不使用 production DB**——建議在 Zeabur 建立一個獨立的 MySQL service（或托管於 Zeabur 的 MySQL plugin/template），只給 backend staging service 存取。

### 3.2 DB Env Wiring

Backend staging service 的 `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_DATABASE` 指向這個新建立的 staging MySQL（見 §1.4）。**建議 `DB_DATABASE` 命名包含 `staging` 字樣**（例如 `jinfeng_staging`），降低日後對錯資料庫下指令的機率。

⚠️ **舊 Laravel env 是 `DB_USERNAME`，Node 是 `DB_USER`**——兩者 key 名稱不同，若參考舊環境變數清單設定 staging，務必用 `DB_USER`，否則 `loadEnv()` 會因為缺少必填的 `DB_USER` 直接啟動失敗。

### 3.2.1 （新增）Private/Internal Host vs. Public Cluster Host 驗證

`specs/backend/production-env-readiness.md` §13.4 記錄了一個新的待確認項：Zeabur 是否為同 project 的 MySQL 提供 **project-internal/private network host**（與對外的 public cluster host 是兩種不同的連線方式）。**這個驗證應該用 staging 自己的 MySQL 做，不要用 production 資料庫做 A/B 實驗。**

若 staging MySQL 與 backend staging service 部署在同一個 Zeabur project，建議在這裡順便驗證：

- [ ] 用 private/internal host 值實測連線成功
- [ ] 確認是否需要額外的 SSL/TLS 設定（現有 `buildPoolOptions()` 沒有 `ssl` 選項）
- [ ] `npm run db:migrate -- --allow-production` 對 private host 執行成功
- [ ] `npm run db:verify` 對 private host 執行成功
- [ ] 確認 private host 位址在 service 重啟/重新部署後是否穩定不變

若以上在 staging 全部驗證通過，才能把「production 也改用 private host」納入正式 cutover 的選項；否則 production 維持用已知可行的 public cluster host 連線方式。

### 3.3 Migration

```bash
npm run db:migrate -- --allow-production
```

⚠️ **執行前必須確認**：當下連線用的 `DB_HOST`/`DB_DATABASE` 確實是 staging MySQL，不是 production——`scripts/migrate.ts` 在 `NODE_ENV=production` 時預設拒絕執行（保護機制），本文件建議 staging 也設 `NODE_ENV=production`（讓行為貼近正式環境），所以這裡**必須**帶 `--allow-production` 才能執行；這個旗標本身**不會**區分 staging/production，純粹靠執行者自己核對連線目標，因此這一步是整份 runbook 裡風險最高的手動步驟，執行前建議再印一次目前生效的 `DB_HOST`/`DB_DATABASE` 做視覺確認。

實際執行方式（擇一）：
- Zeabur 若支援對已部署 service 開一次性 shell/command，直接在該 service 的 context 下跑上面的指令（此時容器內的環境變數自然就是 staging 的）。
- 本機用 staging 的 `DB_*` 值覆寫環境變數後在本機執行（`DB_HOST` 需能從本機連到 Zeabur 的 staging MySQL，可能需要 Zeabur 開放的對外連線資訊）。

### 3.4 Verify

```bash
npm run db:verify
```

純 `SELECT` 對 `information_schema`，不會修改任何資料，可放心執行。預期輸出 `[verify-schema] OK: schema matches reference snapshot`。

### 3.5 明確禁止

- ❌ 對 production DB 執行任何操作
- ❌ `DROP`/`TRUNCATE`
- ❌ migrate reset（**這個指令不存在**，`migrate.ts` 只有 additive apply，沒有 rollback 能力）

---

## 4. Seed（規劃，本批不實作）

### 4.1 建議新增檔案

`backend/seeds/staging-seed.sql`（**本批不建立此檔案**，只規劃內容與流程；與 `migrations/` 分開存放，不透過 `node_schema_migrations` 追蹤，因為這是測試資料不是 schema 演進歷史）。

### 4.2 資料建立方式對照

| 測試資料 | 建立方式 |
|---|---|
| admin user | `POST /api/v2/auth/register`（帶 `is_admin:true`）——**不需要**寫進 seed SQL，用 API 呼叫即可 |
| normal user | `POST /api/v2/auth/register`（不帶 `is_admin`）——同上，用 API |
| contact_class | `POST /api/v2/admin/contact-class`（需先有 admin token）——同上，用 API |
| seo | ❌ 沒有寫入 API，**只能**用 `staging-seed.sql` 直接 INSERT |
| faq | ❌ 沒有寫入 API，**只能**用 `staging-seed.sql` 直接 INSERT |
| contact_quest | ❌ 沒有寫入 API，**只能**用 `staging-seed.sql` 直接 INSERT |

### 4.3 Seed 檔草稿內容（規劃）

```sql
-- backend/seeds/staging-seed.sql（規劃草稿，本批未建立此檔案）
-- 僅供 staging 使用，全部欄位皆為 synthetic 測試資料，不含任何真實 PII，
-- 使用 [STAGING] 前綴標註，降低誤跑到錯誤環境時的辨識成本。

INSERT INTO contact_quest (name, no, del, created_at, updated_at)
VALUES ('[STAGING] 測試問題選項', 1, 0, NOW(), NOW());

INSERT INTO seo (class_id, relate_id, tag, name, title, description, url, type, keyword, pic, pic_alt, del, created_at, updated_at)
VALUES (0, 1, 'test', '[STAGING] 測試 SEO 資料', '[STAGING] 測試標題',
        '[STAGING] 測試描述文字', '/staging-test', 'article', '測試,staging',
        '', '', 0, NOW(), NOW());

INSERT INTO faq (class_id, name, date, info, created_at, updated_at)
VALUES (0, '[STAGING] 測試 FAQ 標題', NOW(), '[STAGING] 測試 FAQ 內容', NOW(), NOW());
```

### 4.4 Seed 執行順序建議

1. 先跑 §3.3/§3.4 的 migrate + verify，確認 schema 就緒
2. 執行 `staging-seed.sql`（對 staging DB，方式同 §3.3 的「本機/一次性 command」二選一）
3. 用 §1.4 的 admin 帳號透過 API 建立 admin user、normal user、`contact_class`（見 §4.2）
4. 全部完成後才進入 §8 E2E checklist

---

## 5. Mail（第一輪關閉）

- `MAIL_HOST` 留空（見 §1.4 env checklist）——`mail-transport.ts` 對空值回傳 `null`，`mail.service.ts` 偵測到後直接 log warning 並跳過寄信，`POST /contact` 依然回 `201` 成功。
- **驗證 mail-disabled path 本身就是一項測試項**（見 §8 E2E `POST /contact`）：確認 API 回應正常、DB 有寫入、（若能看到 log）出現 `CONTACT_MAIL_NOT_CONFIGURED` 警告。
- **不使用正式 `RECIPIENT_EMAIL`**——這個變數在第一輪 staging 直接留空，不填任何值，避免不小心寄到正式收件人。

---

## 6. CORS

| 環境 | `CORS_ALLOWED_ORIGINS` |
|---|---|
| Backend staging | `https://<frontend-staging-domain>` |
| Backend production（不變，僅供對照，本次不動） | `https://laborservice5690.com` |

- **不混用**：staging 的值只填 staging frontend 網址，production 的值維持原樣不動。
- **不用 `*`**：`src/config/cors.ts` 的實作本身也不支援 wildcard + `credentials:true`。
- 兩個 service 在 Zeabur console 各自獨立設定環境變數，物理上不會互相影響。
- ⚠️ **2026-08-27 補充**：production 候選值的正式驗證方式是**檢查瀏覽器實際發出的 request 的 `Origin` header**，不是看舊 Laravel 的 `APP_URL` 或任何文件記載的「應該是」的網址（舊 Laravel `APP_URL=https://jinfengv2.zeabur.app` 與目前記載的 `laborservice5690.com` 不同，只能當線索，不能拿來決定值——詳見 `production-env-readiness.md` §13.3）。Staging 驗證同理，§8.5 的 CORS 檢查也是看瀏覽器實際行為，不是看設定檔「應該」是什麼。

---

## 7. Deployment 順序

```
1. Zeabur MySQL（staging 專屬）建立並確認可連線
        ↓
2. Backend staging service 建立、部署（先用暫時的 CORS_ALLOWED_ORIGINS 空值或佔位值皆可，之後補）
        ↓
3. npm run db:migrate -- --allow-production（對 staging DB）
        ↓
4. npm run db:verify（確認 schema 正確）
        ↓
5. Seed（§4：contact_quest/seo/faq 用 SQL；admin/normal user/contact_class 用 API）
        ↓
6. curl backend staging 的 /health、/ready，確認 200
        ↓
7. Frontend staging service 建立、部署
   （NUXT_PUBLIC_API_BASE_URL 指向步驟 2 拿到的 backend staging 網址）
        ↓
8. 回頭把 backend staging 的 CORS_ALLOWED_ORIGINS 補上步驟 7 拿到的 frontend staging 網址，重新部署 backend
        ↓
9. E2E（§8）
```

第 8 步「回頭補 CORS」是因為 §1.4 提到的雞生蛋問題——兩個 service 互相需要對方部署完成後才知道的網址，這是**唯一**需要走兩輪的環節，其餘步驟都是單向依賴。

---

## 8. E2E 實際 Checklist（curl / 瀏覽器）

以下把 `<backend>` 替換成 backend staging 實際網址、`<frontend>` 替換成 frontend staging 實際網址。

### 8.1 Backend 健康檢查（部署後第一步）

```bash
curl https://<backend>/health   # 期望 200 {"status":"ok",...}
curl https://<backend>/ready    # 期望 200 {"status":"ready"}（DB 連線正常）
```

### 8.2 Public（curl）

```bash
curl https://<backend>/api/v2/seo
curl https://<backend>/api/v2/faq
curl https://<backend>/api/v2/contact-class
curl https://<backend>/api/v2/contact-quest?page=1
curl -X POST https://<backend>/api/v2/contact \
  -H "Content-Type: application/json" \
  -d '{"class":"測試課程","quest":"測試提問","company":"測試公司","tel":"0912345678","num":"2","contactList":[{"name":"王小明","email":"test@example.com","cel":"0912345678"}]}'
# 期望 201，且（mail 關閉的前提下）不因為寄信失敗而回錯
```

### 8.3 Auth（curl + 瀏覽器）

```bash
# login
curl -X POST https://<backend>/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<staging admin email>","password":"<staging admin password>"}'
# 期望 200 {"token":"..."}
```

- [ ] （瀏覽器）`https://<frontend>/auth` 登入成功，Local Storage 出現 `token`
- [ ] （瀏覽器）reload 頁面後仍維持登入狀態
- [ ] （瀏覽器）點登出，`token` 被清除、導回 `/auth`
- [ ] （curl）帶剛拿到的 token 打 `POST /api/v2/auth/logout` → 200；同一顆 token 再打一次 admin API 仍然成功（stateless 設計，非 bug）
- [ ] （瀏覽器）手動把 Local Storage 的 `token` 改亂 → 操作任一 admin 按鈕觸發 401 → 自動清 token + 導回 `/auth`，只跳一次 alert

### 8.4 Admin（curl + 瀏覽器）

```bash
# normal user → 403
curl -H "Authorization: Bearer <normal-user-token>" https://<backend>/api/v2/admin/contact
# 期望 403

# admin contact list
curl -H "Authorization: Bearer <admin-token>" https://<backend>/api/v2/admin/contact?page=1
# 期望 200

# contact detail（帶巢狀 contact_list）
curl -H "Authorization: Bearer <admin-token>" https://<backend>/api/v2/admin/contact/<id>

# search
curl -H "Authorization: Bearer <admin-token>" "https://<backend>/api/v2/admin/contact/search/search-company?company=測試"

# contact-class create
curl -X POST https://<backend>/api/v2/admin/contact-class \
  -H "Authorization: Bearer <admin-token>" -H "Content-Type: application/json" \
  -d '{"name":"[STAGING] 測試分類","no":1}'
# 期望 201

# contact-class update
curl -X PUT https://<backend>/api/v2/admin/contact-class/<id> \
  -H "Authorization: Bearer <admin-token>" -H "Content-Type: application/json" \
  -d '{"name":"[STAGING] 改過的名稱","no":2}'
# 期望 200

# contact-class delete
curl -X DELETE https://<backend>/api/v2/admin/contact-class \
  -H "Authorization: Bearer <admin-token>" -H "Content-Type: application/json" \
  -d '{"ids":[<id>]}'
# 期望 200，硬刪除

# contact delete
curl -X DELETE https://<backend>/api/v2/admin/contact \
  -H "Authorization: Bearer <admin-token>" -H "Content-Type: application/json" \
  -d '{"ids":[<id>]}'
# 期望 200
```

- [ ] （瀏覽器）`https://<frontend>/admin/contact` 未登入時自動導回 `/auth`（route guard）
- [ ] （瀏覽器）admin 登入後 UI 顯示的報名/課程分類資料與 curl 結果一致

### 8.5 Frontend / runtimeConfig

```bash
curl -s https://<frontend>/ | grep -o "apiBaseUrl:\"[^\"]*\""
# 期望輸出 apiBaseUrl:"https://<backend>"，不是 localhost、不是 undefined、不是 production 網域
```

- [ ] 首頁 SSR 正常（View Source 看得到內容，不是空殼）
- [ ] Network 分頁確認前端打 API 沒有 CORS 錯誤
- [ ] `NUXT_PUBLIC_GTM_ID` 留空的情況下頁面正常啟動，Console 只有 GTM 未設定的 `console.error`，沒有讓整個 app 崩潰

---

## 9. Failure / Rollback

| 失敗情境 | 判斷方式 | Rollback / 處理 |
|---|---|---|
| Backend deploy failure | Zeabur build/deploy log 顯示錯誤，或 `/health` 一直打不通 | 檢查 build log（多半是 env checklist §1.4 漏填必填變數，例如 `JWT_SECRET`/`DB_*` 導致 `loadEnv()` 直接 throw）；修正環境變數後重新部署即可，**不影響 production**（完全獨立 service） |
| Frontend deploy failure | Zeabur build log 錯誤，或部署後首頁打不開 | 檢查是否為 `sharp` 原生模組安裝失敗（見 `production-env-readiness.md` §11.3 的已知風險點）；若自動偵測持續失敗，才考慮補一支 `frontend/Dockerfile`（本 runbook 範圍外的後續動作） |
| Migration failure | `npm run db:migrate -- --allow-production` 報錯 | 先確認連線目標是 staging DB 沒有連錯；`migrate.ts` 是 additive+冪等（用 `node_schema_migrations` 追蹤已套用項目），重新執行一次通常可以從中斷點繼續；若懷疑 schema 已經跑壞，直接砍掉重建 staging MySQL service（synthetic 資料沒有保留價值）優於手動修 SQL |
| CORS failure | 瀏覽器 Console 出現 `has been blocked by CORS policy` | 確認 backend staging 的 `CORS_ALLOWED_ORIGINS` 是否真的等於 frontend staging 的**完整** origin（含 `https://`，不含結尾斜線），且環境變數變更後有重新部署/restart 讓容器套用新值 |
| env missing | `/health`/`/ready` 打不通，或 Zeabur log 出現 `Invalid environment configuration` | 對照 §1.4 checklist 逐項確認；`env.ts` 的 Zod schema 會在缺少 `DB_HOST`/`DB_USER`/`DB_DATABASE`/`JWT_SECRET` 任一項時直接讓應用程式啟動失敗並印出明確錯誤訊息（`loadEnv()` 的 `safeParse` 失敗訊息會列出哪個欄位有問題） |
| DB connection failure | `/ready` 回 503 | 確認 staging MySQL service 本身是否健康、`DB_HOST`/`DB_PORT` 是否正確、是否需要 SSL（`production-env-readiness.md` 已記載這是待確認項，staging 若也用 Zeabur MySQL 可能會在這裡提前暴露） |

**沒有 production rollback 的必要**——本 runbook 全程不觸碰 production，任何 staging 端的失敗都只需要處理 staging 自己（最壞情況：砍掉 staging 的三個 service 重建，因為所有資料都是 synthetic）。

---

## 10. Go / No-Go Checklist

**只有以下全部通過，才可以考慮進入 production cutover 的討論**（cutover 本身仍需要另一輪明確的人工決策與獨立任務，本 runbook 只負責讓 staging 全綠）：

- [ ] backend staging deploy OK（§1，`/health` 200）
- [ ] frontend staging deploy OK（§2，首頁可開啟）
- [ ] db migrate/verify OK（§3.3/§3.4，兩者皆無錯誤）
- [ ] `/health` OK
- [ ] `/ready` OK（DB 連線確認）
- [ ] public E2E OK（§8.2 五項全過）
- [ ] auth E2E OK（§8.3 全部子項全過，含 401/session expiry）
- [ ] admin E2E OK（§8.4 全部子項全過，含 normal user 403）
- [ ] CORS OK（§8.5，無 CORS 錯誤）
- [ ] runtimeConfig OK（§8.5，`apiBaseUrl` 指向正確的 staging backend 網址）
- [ ] mail-disabled path OK（§8.2 的 `POST /contact` 在 `MAIL_HOST` 留空下依然 201 成功）
- [ ] no production resources used（全程確認 `DB_HOST`/`CORS_ALLOWED_ORIGINS`/`JWT_SECRET`/`RECIPIENT_EMAIL` 沒有任何一項意外指向 production）

**任一項未過，都視為 No-Go**——不應該以「大部分項目都過了」為由跳過剩餘項目直接討論 production cutover。

---

## 11. Legacy Laravel Env Mapping 與 Security Rotation（2026-08-27，新增）

### 11.1 舊 Laravel Production Env 對照

已取得舊 Laravel Zeabur production 環境變數清單，逐項 mapping、PORT/CORS/DB host 決策修正、production env template（僅 key/placeholder，不含真實值），全部記錄在 **`specs/backend/production-env-readiness.md` §13**——本 runbook 只在相關章節（§1.2/§3.2/§6）加上指向該節的補充說明，不重複整份 mapping 表，避免兩份文件內容分岔。

### 11.2 Security Rotation Checklist（正式 cutover 前必須完成，加入 §10 Go/No-Go 前的準備工作）

以下三項屬於 production cutover 前的準備工作，**不是** staging 本身的 Go/No-Go 項目（staging 用的是全新、staging 專屬的憑證，不受這裡影響），但必須在正式 cutover 前完成，**且不得**在任何文件（含本文件）記錄實際 rotate 後的新值：

- [ ] Rotate production DB credential（`DB_PASSWORD`）
- [ ] Rotate SMTP credential（`MAIL_PASSWORD`）
- [ ] Generate fresh `JWT_SECRET`（Node 這邊從未有過這把金鑰，是首次產生，不是 rotate 既有值）

詳細理由見 `production-env-readiness.md` §13.7/§13.8。
