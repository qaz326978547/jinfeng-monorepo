# 變更摘要：MySQL TLS、連線池、報名防重複、限流、寄信逾時

> 日期：2026-10-24
> 讀者：審查這次程式變更的工程師，以及負責遷移的同仁
> 狀態：**只改了本機程式和文件，還沒 commit。** 沒有操作 Zeabur 正式庫，也沒有切換 DNS。
> 背景：決定採用 DigitalOcean 方案 A、backend 1 個 instance（[DO-MySQL規格評估.md](DO-MySQL規格評估.md)）

## 1. 摘要

| # | 需求 | 做法 | 驗證 |
|---|---|---|---|
| 1 | MySQL TLS，驗證 CA 和主機身分 | `DB_SSL`／`DB_SSL_CA` 兩個環境變數；固定 `rejectUnauthorized: true` 和 `verifyIdentity: true`，**沒有開關可以關掉**；TLS 開啟時 `DB_HOST` 不能是 IP | 真的 MySQL 8.4（強制 TLS）：正確的 CA 能連上（TLSv1.3）；CA 錯誤、主機名稱不符、自簽憑證、沒開 TLS 都會被拒絕 |
| 2 | 連線池 | 上限維持 10；開啟 keepAlive；閒置超過 5 分鐘就回收；排隊上限 50；**取得連線 10 秒逾時**（mysql2 沒有內建，另外實作）；連不上資料庫時回 503 | 單元測試；確認 mysql2 3.23.1 的原始碼確實支援這些參數 |
| 3 | 重複送出 | 前端：送出期間按鈕 disabled；後端：`Idempotency-Key` 加上新的 `contact_idempotency_keys` 表（migration 008），靠主鍵鎖處理同時送出 | 真的 MySQL：10 個同時送出、帶同一把 key 的請求 → **只建立 1 筆**，其餘 9 個回同一筆；換新 key 可以正常再報名一次 |
| 4 | 限流、人數上限 | `POST /contact` 每個 IP 每 10 分鐘 10 次；`contactList` 最多 10 筆（跟前端選單一致）；同步更新 API 規格 | 第 11 次請求回 429；11 位聯絡人回 400 |
| 5 | 寄信逾時、通知失敗時的回應 | SMTP 連線 10 秒、伺服器回應 10 秒、傳輸中斷 20 秒；回應多了 `notification`（`sent`／`failed`／`skipped`）；**只要回 201 就代表報名成功** | SMTP 連不上時，10.03 秒回 201，`notification: "failed"`，資料已經寫入 |
| 6 | 測試和檢查 | — | backend：typecheck、eslint、**354 個測試**、build、openapi 驗證都通過；frontend：`nuxt build` 通過 |

## 2. 設計說明

### 2-1. TLS（[env.ts](../../backend/src/config/env.ts)、[database.ts](../../backend/src/config/database.ts)）

- **為什麼要明確開 `verifyIdentity`。** mysql2 3.23.1 預設 `verifyIdentity=false`。這樣只會檢查「憑證是不是這把 CA 簽的」，不會檢查「憑證是不是發給這台主機的」，所以一定要明確打開。
- **為什麼 TLS 開啟時不能用 IP。** `DB_HOST` 是 IP 時，mysql2 不會送出 servername，主機名稱的比對實際上不會發生。所以 env 驗證會直接拒絕，避免以為有驗證、其實沒有。
- **`DB_SSL_CA` 可以寫成一行。** 字面上的 `\n` 會自動轉成換行，方便貼進 App Platform 的環境變數欄位。
- **預設是關閉的。** 這樣本機的 Docker MySQL、舊的 Zeabur 資料庫都不受影響（見 §4）。
- **migrate 和 verify 也套用同一套 TLS 設定。** `db:migrate`、`db:verify` 原本自己建立連線、沒有帶 TLS，在 DO 上會直接連不上，這次一起修正。

### 2-2. 連線池（[database.ts](../../backend/src/config/database.ts)、[client.ts](../../backend/src/infrastructure/database/client.ts)）

| 參數 | 值 | mysql2 3.23.1 支援嗎 |
|---|---|---|
| `connectionLimit` | 10（`DB_CONNECTION_LIMIT`） | ✅ |
| `enableKeepAlive`／`keepAliveInitialDelay` | true／30 秒 | ✅（原本 keepAlive 預設就開，但延遲沒設，等於用作業系統預設的 2 小時） |
| `maxIdle`／`idleTimeout` | 3／5 分鐘 | ✅。`maxIdle` 小於上限時，mysql2 才會啟動清理閒置連線的機制；閒置超過 5 分鐘的連線都會被關掉 |
| `queueLimit` | 50 | ✅。超過會回 `Queue limit reached.` |
| `connectTimeout` | 10 秒 | ✅ |
| 取得連線逾時 | 10 秒 | ❌ **mysql2 沒有這個參數**。另外用 `applyAcquireTimeout()` 包住 core pool 的 `getConnection`，`pool.query` 和交易都會經過這裡 |

**連不上資料庫時：** 取得連線逾時或排隊滿了，錯誤處理器會回 **503 `DB_POOL_SATURATED`**，而不是 500。這種情況下請求根本沒送到資料庫，可以安全重送。

**已知限制：** 已經逾時的請求，在 mysql2 的排隊佇列裡還是占一個位置，要等到有連線空出來，才會把連線直接歸還。在連線長時間卡住的極端情況下，排隊上限 50 會比較早被用完。

### 2-3. 防重複送出（[contact.repository.ts](../../backend/src/modules/contact/contact.repository.ts)、[008](../../backend/migrations/008_create_contact_idempotency_keys_table.sql)）

**後端流程：**
1. 交易的**第一步**先寫入 `contact_idempotency_keys(idempotency_key PK, request_hash, contact_id)`。
2. 同一把 key 的第二個請求會卡在主鍵鎖上，等第一個交易 commit 之後收到 `ER_DUP_ENTRY`，然後讀出第一筆報名回傳：201、`replayed: true`、header `Idempotent-Replayed: true`，**不寫資料、不寄信**。
3. 如果第一個交易 rollback 了，第二個請求就自己正常建立。
4. `request_hash` 是驗證後 body 的 SHA-256（跟欄位順序無關）。同一把 key 但內容不同，回 **409**；原報名已被後台刪除，也回 409。

**前端流程：**
- 每一份「不同內容」產生一把新的 UUID。只有同一份內容重送（連點、逾時後再按）才沿用同一把，所以**合法的再次報名不會被擋**。
- 網路錯誤或 5xx 時保留 key，因為資料可能其實已經寫入；4xx（429 除外）就換新 key。
- 送出期間按鈕 disabled，成功後一直維持 disabled 到跳轉頁面為止。

**沒帶 header 的請求**（舊版前端、其他呼叫端），行為跟以前完全一樣。

**資料表不存在時**（`ER_NO_SUCH_TABLE`，例如 Zeabur 沒有跑過 008），會略過防重複、照常寫入報名，並記一筆 `CONTACT_IDEMPOTENCY_UNAVAILABLE` 的 warn log。這是刻意的設計，原因見 §4。

### 2-4. 限流和人數上限

- **限流：** 每個 IP 每 10 分鐘 10 次，比諮詢表單的 5 次寬鬆。原因是同一間公司的多位同事可能共用同一個 IP，而且同一筆的重送也會算進次數。這是存在記憶體裡的計數，每個 instance 各算各的，目前只有 1 個 instance 所以沒問題。
- **`contactList` 上限 10：** 依據是前端「報名人數」選單本來就是 1～10，歷史資料最多是 7 位。

### 2-5. 寄信（[mail-transport.ts](../../backend/src/infrastructure/mail/mail-transport.ts)、[contact.controller.ts](../../backend/src/modules/contact/contact.controller.ts)）

- **逾時設定：** 連線 10 秒、等待伺服器回應 10 秒、傳輸中斷 20 秒。原本 nodemailer 的預設是 2 分鐘和 10 分鐘。三段都卡住的最壞情況約 40 秒，仍然在前端 60 秒的逾時之內。
- **回應格式：** `{ message: "新增成功", data, notification, replayed }`，是在原本的 `{message, data}` 上**新增欄位**，舊的呼叫端不受影響。
- **前端行為：** 只要回 201 就跳轉到感謝頁，不看 `notification`。通知信是寄給**管理者**的，跟報名者無關，所以就算寄信失敗，也不應該讓報名者以為失敗而重送。

## 3. 變更的檔案

| 範圍 | 檔案 |
|---|---|
| backend 設定 | `src/config/env.ts`、`src/config/database.ts`、`.env.example`、`src/server.ts` |
| backend 資料庫 | `src/infrastructure/database/client.ts`、`migrations/008_create_contact_idempotency_keys_table.sql`、`migrations/001_create_tables.sql`（只改檔頭註解）、`src/infrastructure/database/schema/database-schema.json`（10 → 11 張表）、`schema/README.md`、`scripts/migrate.ts`、`scripts/verify-schema.ts` |
| backend 報名 | `src/modules/contact/contact.{schemas,repository,service,controller,routes}.ts` |
| backend 其他 | `src/infrastructure/mail/{mail-transport,mail.service}.ts`、`src/middleware/error-handler.ts` |
| backend 測試 | `tests/integration/{contact,env,error-handler}.test.ts`、`tests/unit/database-pool.test.ts`（新增）、`tests/unit/schema-verifier.test.ts` |
| frontend | `components/SignUpClassForm.vue`、`api/signedUpClass.ts`、`api/interface/signedUpClass.ts`、`utils/http.ts`（`$http` 可以多帶 headers）、`utils/idempotency-key.ts`（新增） |
| 共用規格 | `specs/shared/api-contracts/openapi.yaml`、`api-specification.md` §4 |
| 文件 | 本檔、[NewData報告.md](NewData報告.md)（切換步驟加上 S8b、P3、R-B 說明）、[DO-MySQL規格評估.md](DO-MySQL規格評估.md) |

這份清單只列這次的變更。前幾次的變更（001 只建 7 張表、`db:verify` 快照等）也還沒 commit，審查時請一起看。

## 4. 部署注意事項

- **⚠️ Zeabur 綁定 `main`，合併就會自動部署**（[第二階段 §E-1](Zeabur遷移Railway第二階段.md)）。這次的變更在 Zeabur 上可以安全執行：
  - **TLS**：預設關閉，Zeabur 不用設定任何東西。
  - **防重複**：Zeabur 沒有 `contact_idempotency_keys` 表，會自動略過，報名照常寫入（已測試）。
  - **限流和人數上限**：照常生效。
  - **不要在 Zeabur 跑 008。** 依照遷移原則，不對 Zeabur 正式庫執行任何 migration。
- **DO 的設定：** `DB_SSL=true`、`DB_HOST=<叢集主機名稱>`、`DB_SSL_CA=<叢集 CA>`。匯入 NewData 之後，執行 `npm run db:migrate -- --allow-production`，只會套用 008（NewData報告 S8b）。
- **DO 的憑證主機名稱要在演練時確認。** 要確認 DO 的伺服器憑證有包含控制台顯示的主機名稱。**不符合時不可以關掉驗證**，要改用憑證上的那個主機名稱。
- **本機開發：** 本機資料庫要跑一次 `npm run db:migrate`（會套用 008）。沒跑也能用，只是不會防重複。

## 5. 測試結果

| 項目 | 結果 |
|---|---|
| backend `tsc --noEmit`、`eslint .`、`npm run build`、`openapi:validate` | ✅ |
| backend `vitest`（29 個檔案） | ✅ 354 個測試全部通過；新增 31 個（TLS env、pool 參數、取得連線逾時、503、寄信逾時、`notification`、人數上限、限流、防重複的 7 種情況、hash） |
| 實際 MySQL 8.4（強制 TLS、自建 CA） | ✅ 6 種 TLS 情況；NewData 匯入 → `db:verify` 回報少一張表 → `db:migrate` 只套用 008 → `db:verify` OK；10 個同時送出只建立 1 筆；重送、409、換新 key、沒帶 header；限流 429；人數上限 400；SMTP 連不上時 10 秒回 201 + `failed` |
| frontend `nuxt build` | ✅ |
| frontend key 產生器 | ✅ `randomUUID` 和備用方式產生的格式都符合後端規則，1,000 次沒有重複 |

**沒做到的：**
- **前端型別檢查、元件測試、瀏覽器實測。** 前端沒有測試框架，也沒有安裝 vue-tsc。按鈕 disabled、重送沿用 key 這些行為，要在 DO 演練時用瀏覽器實際點一次確認。
- **既有的不穩定測試。** 跑 15 次大約有 1～2 次，會在 admin 的測試出現 `socket hang up` 或狀態碼不符。我在**乾淨的 HEAD 上也重現了**（15 次裡 2 次），所以不是這次造成的，沒有在這次處理。

## 6. 後續

| # | 事項 |
|---|---|
| 1 | 審查之後 commit。合併到 `main` 就會觸發 Zeabur 自動部署，見 §4 |
| 2 | DO 建立好之後演練：TLS 主機名稱、S8b 套用 008、瀏覽器實際點送出按鈕 |
| 3 | 以後如果要跑 2 個以上 backend instance，限流要改成跨 instance 共用 |
| 4 | `contact_idempotency_keys` 每筆報名一列，目前不清理。量很小，以後有需要再依 `created_at` 清除舊資料 |
