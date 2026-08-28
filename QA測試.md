# QA 測試指南

> 目的：在本機用 Docker 起 backend、Nuxt dev server 起 frontend，兩者互連後可以完整跑一次 admin 後台流程。所有指令皆針對 **本機測試環境**，不涉及 Zeabur production。
>
> 相關文件：`specs/backend/laravel-to-node-parity.md`（每支 API 的實作/legacy 行為細節）、`specs/backend/production-env-readiness.md`（production 環境變數與 CORS 分析）、`backend/README.md`、`frontend/README.md`。

---

## 1. 前置需求

- Docker Desktop（或相容的 Docker engine）已啟動
- Node.js ≥ 22（`backend/package.json` 的 `engines.node` 要求）
- 兩個本機 port 沒被佔用：`8080`（backend）、`3000`（frontend）、`3306`（MySQL，若本機已有其他 MySQL 服務會衝突）

---

## 2. 啟動 Backend（Docker）

### 2.1 允許前端跨來源請求（CORS，本地測試專用，第一次設定即可）

`backend/docker-compose.yml` 目前把 `CORS_ALLOWED_ORIGINS` 寫死成空字串（`environment.CORS_ALLOWED_ORIGINS: ''`）——這是刻意的安全預設值（見 `src/config/cors.ts`：空值 = 擋掉所有跨來源請求），但代表**不改的話，本機 frontend（`http://localhost:3000`）打本機 backend（`http://localhost:8080`）的 admin API 全部會被 CORS 擋下**。

不要直接改 `backend/docker-compose.yml`（那是版控檔案）。在 `backend/` 目錄下新增一個**不要 commit** 的 `docker-compose.override.yml`：

```yaml
# backend/docker-compose.override.yml — 本機測試專用，不要 git add / commit
services:
  api:
    environment:
      CORS_ALLOWED_ORIGINS: http://localhost:3000
```

Docker Compose 會自動合併 `docker-compose.yml` + `docker-compose.override.yml`（不需要額外參數），之後所有指令一樣打 `docker compose ...` 即可。

### 2.2 啟動容器

```bash
cd backend
docker compose up -d
```

第一次啟動會建置 image（`Dockerfile` 的 `development` stage，內含 `tsx watch`，改 `backend/src/**` 會自動重啟）並等 MySQL healthcheck 通過才啟動 `api` 服務。

```bash
docker compose logs -f api   # 觀察開機 log，Ctrl+C 離開不會停止容器
```

看到 `Server listening on 0.0.0.0:8080 (development)` 代表啟動成功。

### 2.3 初始化資料庫 schema

首次啟動、或想重置資料庫時執行（`migrations/001~005` 只建 schema，**沒有任何 seed data**，所有表格啟動時都是空的）：

```bash
docker compose exec api npm run db:migrate
```

確認結果：

```bash
docker compose exec api npm run db:verify
```

### 2.4 本機資料庫（MySQL）連線資訊

非機密、本來就寫在 `backend/docker-compose.yml` 裡的本機開發預設值，可用任何 DB GUI（TablePlus/DBeaver/…）或 `mysql` CLI 直接連：

| 項目 | 值 |
|---|---|
| Host | `localhost` |
| Port | `3306` |
| User | `jinfeng` |
| Password | `local_dev_only` |
| Database | `jinfeng_local` |
| Root password（如需 root 權限） | `local_dev_only` |

```bash
mysql -h 127.0.0.1 -P 3306 -u jinfeng -plocal_dev_only jinfeng_local
# 或直接進容器：
docker compose exec mysql mysql -u jinfeng -plocal_dev_only jinfeng_local
```

`backend/.env` 已對齊這組設定（`DB_HOST=localhost`），所以在本機直接跑 `npm run dev`（不透過 docker-compose 的 `api` 容器）也連得到。**正式環境資料庫連線資訊在 `backend/.env.production`（同樣被 gitignore 排除，不會進版控）**，僅供刻意手動執行唯讀 `db:verify` 使用，切勿拿來跑 `db:migrate`。

### 2.5 確認 Backend 正常運作

```bash
curl http://localhost:8080/health   # 應回 200，liveness，不查 DB
curl http://localhost:8080/ready    # 應回 200，readiness，會查 DB 連線
```

---

## 3. 啟動 Frontend 並連接本地 Backend

### 3.1 設定環境變數

```bash
cd frontend
cp .env.example .env
```

`.env.example` 的預設值已經就是本機測試需要的值（`NUXT_PUBLIC_API_BASE_URL=http://localhost:8080`），通常不用改。

### 3.2 啟動

```bash
npm ci   # 第一次或 package.json 有變動時執行
npm run dev
```

開啟 http://localhost:3000

### 3.3 確認前端正確連上本地 API

瀏覽器開 DevTools → Network，操作任一個會打 API 的頁面（例如 `/faq`），確認 request 打到 `http://localhost:8080/api/v2/...`，不是 `undefined/api/v2/...` 或正式網域。

---

## 4. 建立測試帳號

前端目前**沒有註冊頁面**（`AuthApi.register` 是死碼，刻意不做 UI，見 `specs/backend/laravel-to-node-parity.md` §10.13），要建立測試帳號必須直接呼叫 backend API。

### 目前本機資料庫已建立的帳號

以下帳號已透過 §4.1 的方式建立在本機 `jinfeng_local` 資料庫（`mysql_data` volume 會持續保留，除非執行 `docker compose down -v`，見 §7）：

| Email | 密碼 | is_admin | 用途 |
|---|---|---|---|
| `qaz326978547@gmail.com` | `qaz19981127` | ✅ 是 | 主要 QA 管理員測試帳號，已驗證可登入並成功呼叫 `/api/v2/admin/*`（含新增的 `admin/faq`） |
| `bean@test.com` | （未知，非本次建立） | ✅ 是 | 先前本機測試留下的既有帳號 |

若要重新建立（例如換一台機器、或執行過 `docker compose down -v` 清空資料庫），照下面 §4.1 的指令，把 email/password 換成上表的值即可。

### 4.1 建立管理員帳號（測試 admin 後台必備）

```bash
curl -X POST http://localhost:8080/api/v2/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "QA Admin",
    "email": "qa-admin@example.com",
    "password": "password123",
    "password_confirmation": "password123",
    "is_admin": true
  }'
```

預期：`201 {"message":"註冊成功"}`。`is_admin: true` 由 backend 直接寫入 `users.is_admin`（不是前端才決定的，見 `backend/src/modules/auth/auth.schemas.ts`/`auth.service.ts`），這是目前**唯一**建立 admin 帳號的方式。

### 4.2 建立一般（非 admin）帳號（測試 403 用）

同上，`is_admin` 欄位整個省略即可（DB `DEFAULT 0`）：

```bash
curl -X POST http://localhost:8080/api/v2/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "QA Normal User",
    "email": "qa-user@example.com",
    "password": "password123",
    "password_confirmation": "password123"
  }'
```

---

## 5. 手動測試清單

以下每一項都是可以在本機獨立驗證的行為，建議照順序跑一次。標「(UI)」的項目在瀏覽器 `http://localhost:3000` 操作；標「(API)」的項目用 curl/Postman 直接打 `http://localhost:8080`。

### 5.1 Public API（不需登入，(API)）

- [ ] `GET /api/v2/seo` → 200，空陣列（未 seed 資料）
- [ ] `GET /api/v2/faq` → 200，空陣列
- [ ] `GET /api/v2/contact-class` → 200，空陣列
- [ ] `GET /api/v2/contact-quest?page=1` → 200，Laravel 分頁 envelope（`data:[]`, `total:0` 等）
- [ ] `POST /api/v2/contact`（報名表單，見下方範例）→ 201，資料寫入 `contact`/`contact_list`，且（若 `MAIL_HOST` 未設定）log 出現一行「mail 跳過」警告、API 本身仍回成功

  ```bash
  curl -X POST http://localhost:8080/api/v2/contact \
    -H "Content-Type: application/json" \
    -d '{
      "class": "測試課程",
      "quest": "測試提問",
      "company": "測試公司",
      "tel": "0912345678",
      "num": "2",
      "contactList": [
        {"name": "王小明", "email": "test@example.com", "cel": "0912345678"}
      ]
    }'
  ```

### 5.2 Auth Flow（API）

- [ ] `POST /api/v2/auth/login`（用 §4.1 建立的帳號）→ 200，回傳 `{token}`
- [ ] 用**錯誤密碼**登入 → 401
- [ ] 用**不存在的 email** 登入 → 401
- [ ] 帶著剛拿到的 token 呼叫 `POST /api/v2/auth/logout`（`Authorization: Bearer <token>`）→ 200
- [ ] logout 後，**同一顆 token** 再打一次需要授權的 admin API → **仍然可以成功**（這是刻意的 stateless 設計，不是 bug，見 §10.9）
- [ ] 不帶 `Authorization` header 打任何 `/admin/*` → 401
- [ ] 帶**非 admin** 帳號的 token 打任何 `/admin/*` → 403

### 5.3 Admin — Contact（API，需 admin token）

- [ ] `GET /api/v2/admin/contact?page=1` → 200，看得到 §5.1 建立的報名資料
- [ ] `GET /api/v2/admin/contact/{id}` → 200，含巢狀 `contact_list`
- [ ] `GET /api/v2/admin/contact/search/search-company?company=測試` → 200，找得到剛剛的資料
- [ ] `DELETE /api/v2/admin/contact`（body `{"ids":[<id>]}`）→ 200，資料被刪除；再 GET 該 id → 404
- [ ] `DELETE /api/v2/admin/contact` 帶一個不存在的 id → 404，訊息列出不存在的 id，且**不會**刪除其他有效 id（batch 原子性）

### 5.4 Admin — Contact Class（API，需 admin token）

- [ ] `POST /api/v2/admin/contact-class`（body `{"name":"測試分類","no":1}`）→ 201
- [ ] `GET /api/v2/admin/contact-class/{id}` → 200
- [ ] `PUT /api/v2/admin/contact-class/{id}`（body `{"name":"改過的名稱","no":2}`）→ 200，欄位確實更新
- [ ] `DELETE /api/v2/admin/contact-class`（body `{"ids":[<id>]}`）→ 200，**真正硬刪除**（不是軟刪除，之後查不到）

### 5.5 Admin — Contact List（API，需 admin token，前端目前無使用）

- [ ] `GET /api/v2/admin/contact-list` → 200
- [ ] `GET /api/v2/admin/contact-list/{id}` → 200 或 404

### 5.5b Admin — FAQ（新功能，非 Laravel legacy parity，API + UI）

- [ ] (API) `GET /api/v2/admin/faq` 未帶 token → 401；帶非 admin token → 403；帶 admin token → 200 `{"data":[...]}`
- [ ] (API) `POST /api/v2/admin/faq`（body `{"name":"測試問題","info":"測試回答","no":1}`）→ 201，回傳新增的資料
- [ ] (API) 缺 `name`/`info`/`no` 任一欄位 → 400
- [ ] (API) `PUT /api/v2/admin/faq/{id}`（body 同上，換內容）→ 200，欄位確實更新；帶不存在的 id → 404
- [ ] (API) `DELETE /api/v2/admin/faq`（body `{"ids":[<id>]}`）→ 200，**真正硬刪除**（不是軟刪除，之後查不到）
- [ ] (API) 新增/修改/刪除後立即 `GET /api/v2/faq`（public，不需 token）→ 立即看到變化（目前無 cache，見 `specs/backend/laravel-to-node-parity.md` §5b）
- [ ] (UI) 用 §4.1 的 admin 帳號登入後，訪問 `/admin/contact/contact_quest` → 看到 FAQ 列表（畫面標題「FAQ 管理」）
- [ ] (UI) 點「新增 FAQ」→ 填問題/回答/排序 → 送出 → 回到列表能看到新資料
- [ ] (UI) 點某筆的編輯按鈕 → 表單預填現有值 → 修改後儲存 → 列表反映新內容
- [ ] (UI) 直接在列表修改「排序」欄位（inline input）→ 自動送出 PUT，列表依新排序重排
- [ ] (UI) 點刪除 → 跳出確認對話框，取消不會刪除；確認後該筆從列表消失
- [ ] (UI) 前台 `/faq` 頁面（`FaqComponent.vue`）→ 確認剛剛在後台的異動同步顯示

### 5.6 Frontend Auth UX（UI，瀏覽器操作 http://localhost:3000）

- [ ] 直接訪問 `/admin/contact`（未登入）→ 自動導回 `/auth`（route guard）
- [ ] 在 `/auth` 用 §4.1 的 admin 帳號登入 → 導向 `/admin/contact`，畫面看得到報名資料列表
- [ ] **重新整理頁面** → 仍維持登入狀態（不會被踢回 `/auth`）
- [ ] 開瀏覽器 DevTools → Application → Local Storage，確認有 `token` 這個 key
- [ ] 點左側「登出」按鈕 → 導回 `/auth`，且 Local Storage 的 `token` 被清除
- [ ] 登出後直接訪問 `/admin/contact` → 再次被導回 `/auth`
- [ ] 在後台操作「刪除報名資料」「新增課程分類」「編輯課程分類」「刪除課程分類」→ 對照 §5.3/§5.4 的 API 結果，UI 顯示一致
- [ ] （模擬 token 過期）手動把 Local Storage 的 `token` 改成一個亂數字串，再操作任一個會打 admin API 的按鈕 → 畫面清掉 token 並導回 `/auth`，且**只彈出一次** alert（不會每個 API 都彈一次）

### 5.7 CORS / Env Config（確認本次修正生效）

- [ ] 瀏覽器打開 `/` 首頁，DevTools → 檢視原始碼或 `window.__NUXT__.config.public`，確認 `apiBaseUrl` 是 `http://localhost:8080`，不是寫死的正式網域
- [ ] Network 分頁確認沒有任何 CORS 錯誤（紅字 `has been blocked by CORS policy`）——如果出現，檢查 §2.1 的 `docker-compose.override.yml` 是否有套用（`docker compose config` 可以印出合併後的完整設定確認）

---

## 6. 常見問題排解

| 現象 | 可能原因 / 排解 |
|---|---|
| Frontend 打 API 出現 CORS 錯誤 | `backend/docker-compose.override.yml` 沒建立或內容錯誤；改完要 `docker compose up -d` 讓容器套用新環境變數（環境變數改變需要重建容器，不會像程式碼改動一樣自動 reload） |
| `docker compose up -d` 卡在等 mysql healthy | 第一次建 volume 需要一點時間初始化 MySQL，等 30 秒~1 分鐘；若一直失敗，`docker compose logs mysql` 看詳細錯誤 |
| `db:migrate` 連不上資料庫 | 確認是用 `docker compose exec api npm run db:migrate`（容器內部，`DB_HOST=mysql`），不是在本機直接跑（本機跑需要額外設定 `DB_HOST=127.0.0.1`） |
| 登入後 admin API 一直 401 | 確認 `Authorization: Bearer <token>` 有正確帶上；也可能是 token 已過期（本機 `docker-compose.yml` 設 `JWT_EXPIRES_IN: 1d`） |
| Frontend `apiBaseUrl` 顯示不是 `http://localhost:8080` | 確認 `frontend/.env` 存在且 `NUXT_PUBLIC_API_BASE_URL=http://localhost:8080`；改 `.env` 後要重啟 `npm run dev`（第一次啟動後讀取一次） |
| `POST /contact` 沒收到通知信 | 本機沒設定 `MAIL_HOST`，這是刻意的（見 `backend/.env.example` 註解）——API/DB 寫入仍會成功，只是不寄信，log 會有一行警告 |
| Port 已被佔用（8080/3000/3306） | `lsof -ti:8080 \| xargs kill -9`（依實際 port 替換），或修改 `docker-compose.override.yml`/`.env` 換一個本機 port |

---

## 7. 清理環境

```bash
cd backend
docker compose down       # 停止容器，保留資料庫資料（下次啟動資料還在）
docker compose down -v    # 連同資料庫資料一起清掉，之後要重新 db:migrate
```
