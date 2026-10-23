# DigitalOcean Managed MySQL 規格評估

> 日期：2026-10-24
> 讀者：負責這次遷移的技術人員與專案團隊
> 範圍：只做分析。沒有修改程式、沒有建立 DigitalOcean 資源，也沒有對正式資料庫寫入或壓測。
> 依據：
> - 本機 Docker `mysql:8.4`（`sql_require_primary_key=ON`、UTC）匯入 NewData.sql 後的實測
> - backend／frontend 原始碼
> - 2026-10-23 對 Zeabur 正式庫的唯讀 `performance_schema` 統計（見 [Zeabur正式資料庫盤點報告.md](Zeabur正式資料庫盤點報告.md)）
> - DigitalOcean 官方文件（§9）
> 本文不含帳密和個資；所有統計都只用彙總數字。

## 結論

| 用途 | 建議 | 月費（只算 DB） |
|---|---|---|
| **遷移演練** | **方案 A**：1 vCPU／1 GB／10 GiB，**關閉** Storage Autoscaling，演練完就刪除 | 依使用時數計費，約 US$0.02／小時 |
| **正式上線** | **方案 A**：1 vCPU／1 GB／10 GiB，**開啟** Storage Autoscaling（80%／+10 GiB） | US$15.15 |
| 什麼時候升級到 B | 符合 §7-3 任一條件，或決定讓 backend 長期跑 3 個以上 instance | US$30.45 |
| 方案 C | 目前沒有理由選 | US$60.90 |

**理由：**
- **容量**：資料庫實際占用約 1.3 MiB，加上 MySQL 系統檔約 210 MiB，只用掉 10 GiB 的 2%。
- **負載**：正式站過去 32 天平均約 **0.02 次查詢／秒**；所有查詢都是單表、幾百列以內。
- **連線**：每個 backend instance 最多 10 條連線，2 個 instance 加上部署重疊也只要 43 條，低於上限 75。

**方案 A 的限制（升級到 B 也解決不了）：**
- **單一節點，不是高可用。** 節點故障、維護或升級時，會有短暫無法連線。
- **Standard Edition 的 standby 即將受限。** 2026-11-30 起（新帳號從 2026-10-15 起），新建的 Standard Edition 叢集不能加 standby。要高可用就得用 Advanced Edition，**US$130／月起**。

所以正式選 A 的前提是：**接受單節點，靠每日備份加 7 天 PITR（point-in-time recovery，可以還原到 7 天內任一時間點）**。這跟目前 Zeabur 的狀況一樣，Zeabur 也是單節點。

**這不代表網站扛得住某個訪客數。** 目前沒有尖峰流量資料（§8），上面只說明「以現有流量，方案 A 的餘裕很大」。

---

## 1. 容量

### 1-1. 檔案大小和實際占用不是同一件事

| 項目 | 大小 | 說明 |
|---|---|---|
| `data.sql`（Zeabur 原始備份，28 表） | 227 KiB | 文字檔 |
| `NewData.sql`（10 表） | **167 KiB**（170,865 bytes） | 文字檔：INSERT 語句和 DDL，沒有索引結構 |
| 資料庫統計的資料＋索引 | **448 KiB**（資料 352＋索引 96） | `information_schema`，以 16 KiB 為單位計算 |
| 資料表檔案（10 個 `.ibd`） | **1.31 MiB** | 實際占用的磁碟空間；每個 InnoDB 表檔案**最少約 112 KiB**，就算表是空的也一樣 |
| MySQL 系統檔（全新 8.4 預設） | 約 208 MiB | redo log 100 MiB、undo 32 MiB、`mysql.ibd` 31 MiB、doublewrite 16 MiB、ibdata 12 MiB、temp 12 MiB。DO 的設定可能不同，要以實際叢集為準 |
| 匯入時產生的 binlog | 約 3 MiB | row-based 會記錄整列資料，所以比 SQL 檔大。本機預設保留 30 天 |
| **匯入後的資料目錄總計（本機實測）** | **約 210 MiB** | 只占 10 GiB 的 2% |

**重點：** 決定磁碟用量的是 MySQL 自己的系統檔和 binlog，不是業務資料。

### 1-2. 各表大小（匯入 8.4 並執行 `ANALYZE TABLE` 之後）

| 表 | 筆數 | 平均列長 | 資料 KiB | 索引 KiB | `.ibd` KiB |
|---|---|---|---|---|---|
| contact | 208 | 551 B | 112 | 0 | 192 |
| contact_list | 325 | 201 B | 64 | 16 | 160 |
| faq | 15 | 3.2 KB | 48 | 16 | 144 |
| seo | 1 | （一列 12 KB 的 description） | 32 | 16 | 128 |
| carousel | 2 | — | 16 | 16 | 128 |
| consultations | 2 | — | 16 | 16 | 128 |
| contact_class | 40 | 409 B | 16 | 0 | 112 |
| contact_quest | 7 | — | 16 | 0 | 112 |
| node_schema_migrations | 7 | — | 16 | 0 | 112 |
| users | 3 | — | 16 | 16 | 128 |
| **合計** | | | **352** | **96** | **1,344** |

筆數少的表，平均列長沒有參考價值，因為 InnoDB 最少以 16 KiB 為單位配置空間。

### 1-3. 成長推估

- **報名成長很慢。** 2023-06 到 2026-08 共 208 筆報名，最多的一個月（2023-12）是 33 筆；2026 年到目前為止只有 4 筆。每筆報名平均 1.17 位聯絡人，最多 7 位。
- **每筆報名約占 0.8 KB**（contact 約 550 B，加上 contact_list 約 1.17 × 200 B），再加上索引和 binlog，抓 **3 KB 以內**。
- **就算每月 1,000 筆報名**（是歷史最高的 30 倍），一年也只增加約 36 MiB。
- **10 GiB 的實際風險不是資料量**，而是 binlog 保留天數和慢查詢 log（如果開啟）。所以要設磁碟告警（§7-2）。

## 2. 連線

### 2-1. 現在的設定（[database.ts](../../backend/src/config/database.ts)、mysql2 3.23.1 的預設值）

| 參數 | 值 | 影響 |
|---|---|---|
| `connectionLimit` | `DB_CONNECTION_LIMIT`，預設 **10** | 每個 instance 最多 10 條連線 |
| `maxIdle` | 沒設定 → 等於 `connectionLimit`（10） | 閒置連線**不會被關掉**。Zeabur 上實際看到 9 條連線閒置了 5～6 小時 |
| `idleTimeout` | 沒設定 → 60 秒 | 只對超過 `maxIdle` 的連線有效，所以實際上不會作用 |
| `queueLimit` | 沒設定 → 0（**不限**） | 連線用完時請求會一直排隊，不會馬上報錯 |
| `connectTimeout` | 沒設定 → 10 秒 | — |
| `enableKeepAlive` | 沒設定 | 長時間閒置的連線被中間網路設備切斷時，下一次查詢可能會失敗一次 |
| `ssl` | **沒有** | DO 一定要加，否則連不上（原本就列為待辦） |

**連線有沒有確實釋放：**
- 一般查詢都用 `pool.query()`，查完會自動歸還連線。
- 交易都走 [transaction.ts](../../backend/src/infrastructure/database/transaction.ts)：在 `finally` 裡 `release()`，失敗時先 `rollback()`。用到交易的有：報名新增、報名刪除、課程刪除、FAQ 刪除。
- 程式裡沒有其他地方直接呼叫 `getConnection()`，**沒有發現連線洩漏**。
- 關機時會呼叫 `pool.end()`，最多等 10 秒。

**其他會連資料庫的東西：**
- 前端（Nuxt）不會直接連資料庫。
- `db:migrate` 用 1 條連線。
- `db:verify` 用自己的 pool，查詢是依序執行，實際約用 1 條。
- 手動維運（mysql CLI）用 1～2 條。

### 2-2. 總連線需求

方案 A 的上限是 **75 條**（官方另外保留 1 條給系統程序，不算在 75 內）。

公式：**instance 數 × 10 × 2（部署時新舊並存）＋ 3（migrate、verify、手動維運）**

| backend instance 數 | 平常最多 | 部署重疊時最多 | 占 A 上限 | 占 B 上限（150） |
|---|---|---|---|---|
| 1 | 10 + 3 = 13 | 20 + 3 = **23** | 31% | 15% |
| 2 | 20 + 3 = 23 | 40 + 3 = **43** | 57% | 29% |
| 3 | 30 + 3 = 33 | 60 + 3 = **63** | **84%** | 42% |
| 3（每個 instance 改成 8 條） | 27 | 48 + 3 = 51 | 68% | 34% |

- App Platform 是滾動部署，新版通過健康檢查後才停舊版，所以要算「部署重疊」這一欄。
- **正式站實測：** 9 條連線同時存在（Zeabur，1 個 instance）；32 天內這個來源總共只建立過 188 次連線。實際用量遠低於上限。

## 3. 查詢、索引和掃描

所有查詢都是**單表**，**沒有 JOIN**，也**沒有 N+1**。程式裡唯一的迴圈查詢，是報名時逐筆 INSERT contact_list（平均 1.17 筆）。

| API | SQL | EXPLAIN（8.4） | 現在 | 資料變多以後 |
|---|---|---|---|---|
| `GET /seo`（**每一頁 SSR 都會呼叫**） | `SELECT * FROM seo` | 全表 1 列 | 很好 | 永遠 1 列。但每次都回傳 12 KB 的 description |
| `GET /carousels`（首頁） | `WHERE is_active=1 ORDER BY sort_order, id` | 用 `idx_carousel_active_sort` | 很好 | 很好 |
| `GET /faq` | `ORDER BY no DESC`，只取 4 欄 | 全表＋排序（15 列） | 很好 | 列數由後台控制，不會變大 |
| `GET /contact-class` | `WHERE del=0 ORDER BY no DESC` | 全表＋排序（40 列） | 很好 | 同上 |
| `GET /contact-quest` | `COUNT(*)` 加上 `LIMIT 10 OFFSET n` | 全表＋排序（7 列） | 很好 | 同上 |
| 登入 | `WHERE email=? LIMIT 1` | 唯一索引 | 很好 | 很好 |
| 後台：報名列表 | `ORDER BY created_at DESC LIMIT 10 OFFSET n` 加上 `COUNT(*)` | **全表＋排序，沒有索引**（208 列） | 很好 | 列數成長後最先變慢的地方。約 5 萬列以上可以考慮加 `created_at` 索引（要新增 migration，並同步更新快照） |
| 後台：公司搜尋 | `company LIKE '%x%'` | **全表掃描**（前面有 `%`，用不到索引） | 很好 | 跟資料量成正比。只有後台在用，可以接受 |
| 後台：報名明細 | `contact WHERE id=?`、`contact_list WHERE cid=?` | 主鍵／`contact_list_cid_index` | 很好 | 很好 |
| 後台：聯絡人列表 | `SELECT * FROM contact_list` | **全表、沒有分頁**（325 列） | 很好 | **回應大小跟總筆數成正比**，資料多了會變慢、占記憶體 |
| 後台：諮詢列表 | `ORDER BY id DESC LIMIT 10 OFFSET n` | 主鍵反向掃描 | 很好 | 很好 |

**`SELECT *`：** seo、contact、contact_list、contact_class、contact_quest 都是。因為整列會回傳給 API，現在不能改；以這個資料量也不構成效能問題。

**每次頁面 SSR 會產生幾次 DB 查詢：**

| 頁面 | API | DB 查詢次數 |
|---|---|---|
| 首頁 | seo、carousels | 2 |
| 常見問題頁 | seo、faq（＋1 支） | 約 3 |
| 講座報名頁 | seo、contact-class、contact-quest（count＋分頁） | 4 |

在頁面之間切換是前端導航，不會重新 SSR。首頁刻意不做快取（[nuxt.config.ts](../../frontend/nuxt.config.ts) 的註解有說明），所以每次 SSR 都會查資料庫。

## 4. 報名交易（contact + contact_list）

| 項目 | 分析 |
|---|---|
| 交易內容 | `INSERT contact` → 逐筆 `INSERT contact_list` → `SELECT contact WHERE id=?`，然後 commit。平均 3～4 次來回，同區域約幾毫秒到幾十毫秒 |
| 鎖定 | InnoDB 寫入只鎖新插入的那幾列，沒有 `SELECT … FOR UPDATE`，沒有範圍更新。**同時有多筆報名也不會互相等待** |
| AUTO_INCREMENT 鎖 | MySQL 8.x 預設 `innodb_autoinc_lock_mode=2`，不會鎖整張表。DO 叢集建好後用 `SELECT @@innodb_autoinc_lock_mode` 確認 |
| 寄信 | **commit 之後才寄**，寄信期間**不占 DB 連線** ✅。但 API 要等寄信完成才回應，nodemailer 沒有設定逾時，預設連線逾時是 2 分鐘。SMTP 慢的話，使用者會一直等，而且更容易重複送出 |
| **重複送出** | ⚠️ 報名表的送出按鈕（[SignUpClassForm.vue](../../frontend/components/SignUpClassForm.vue)）**在請求期間沒有 disabled**；後端也沒有冪等鍵、唯一約束或 rate limit。**連點就會產生多筆報名和多封通知信**。免費諮詢表單則有 disabled，也有 5 次／10 分鐘／IP 的限制 |
| 大量送出 | ⚠️ `POST /contact` 沒有 rate limit，`contactList` 陣列也**沒有上限**（只受 express.json 的 100 KB 限制，大約可以塞幾百筆）。一次惡意請求就會在同一個交易裡做幾百次 INSERT |
| 併發瓶頸 | **資料庫不是瓶頸。** 真的同時湧入大量報名時，會先卡在 SMTP 寄信和 backend 單一 instance 的事件迴圈 |

重複送出和沒有限流屬於**資料品質和防濫用**的問題，不是 DB 規格問題，升級方案也解決不了。建議另外開單處理（§7-4）。

## 5. 現有流量（Zeabur 正式站，2026-09-21 ～ 2026-10-23，共 32 天）

| 指標 | 數值 | 換算 |
|---|---|---|
| 新版 backend 送出的 SELECT | 62,097 次 | 平均約 **0.022 次／秒**（每小時約 80 次） |
| `SELECT * FROM seo`（≈ SSR 次數） | 61,575 次 | 每天約 1,900 次 |
| 首頁輪播查詢（≈ 首頁 SSR 次數） | 約 280 次 | 每天約 9 次 |
| 講座報名頁的查詢 | 約 240～320 次 | 每天約 8～10 次 |
| 寫入 | 報名 0 筆、諮詢 2 筆，加上後台修改課程 14 次 | 幾乎沒有 |
| 同時存在的連線 | 9 條 | — |

**推論（需要用存取紀錄確認）：** seo 查詢比首頁查詢多 200 倍以上。所以大部分 SSR 應該不是真人瀏覽首頁，比較可能是爬蟲、或打到不存在的路徑（404 頁也會套用 layout，所以也會查 seo）。這會影響 §8 壓測的流量組成。

這些都只是平均值，**沒有尖峰資料**。

## 6. 方案比較

| | A：1 vCPU／1 GB | B：1 vCPU／2 GB | C：2 vCPU／4 GB |
|---|---|---|---|
| 月費 | US$15.15 | US$30.45 | US$60.90 |
| 可用記憶體（官方說有約 350 MB 系統開銷） | 約 0.65 GB | 約 1.65 GB | 約 3.65 GB |
| 資料（1.3 MiB）能不能全部放進記憶體 | ✅ 綽綽有餘 | ✅ | ✅ |
| 連線上限 | 75 | 150 | 400（官方表格）；你提供的控制台畫面寫 225，**以控制台為準** |
| 儲存空間 | 10 GiB（實際用約 2%） | 30 GiB | 60 GiB |
| 高可用 | ❌ 單節點 | ❌ 單節點（standby 另外加錢，而且 Standard Edition 即將不能加） | 同左 |
| 適合 | 演練、目前的正式站 | 3 個以上 instance，或監控顯示記憶體吃緊 | 目前用不到 |

**CPU 都是 1 vCPU shared**，A 和 B 的運算能力一樣。B 只多了記憶體、連線數和磁碟，而這三樣目前都沒有不夠用。

### 6-1. 遷移演練

- **方案 A，10 GiB，關閉 Autoscaling。** 演練只會匯入 167 KiB 的資料、跑 QA，不需要自動擴充。
- **演練完就刪除叢集。** 依使用時數計費，留著不用也會一直算錢。
- 叢集建好後，順便確認這些設定的實際值：`innodb_buffer_pool_size`、`max_connections`（應該是 76）、`innodb_autoinc_lock_mode`、`binlog_expire_logs_seconds`、`time_zone`、`sql_require_primary_key`。這些數字可以拿來修正本報告。

### 6-2. 正式上線

- **方案 A，10 GiB，開啟 Storage Autoscaling（80% 時增加 10 GiB）。** 平常不會觸發，也就不會多花錢；萬一 binlog 或 log 暴增，可以避免磁碟寫滿。
- **限制：**
  1. 單節點，維護和故障時會短暫無法連線。這需要金豐接受，並寫進服務說明。
  2. 每日備份時會鎖住 DDL，所以不要在備份時段跑 migration。
  3. PITR 只能還原 7 天內的資料，更早的要靠自己保存的備份（§7 的做法）。
- **如果金豐要求高可用**，就是另一個層級的決定：Advanced Edition 至少 US$130／月，而且要加 standby。Standard Edition 的 standby 限制請在建立叢集前到控制台確認：你的帳號屬於哪個時間點、現在還能不能選。

## 7. 連線池設定、監控、升級條件

> **2026-10-24 決定：** 採用方案 A，backend 先跑 1 個 instance，接受單節點可能因維護或故障而短暫中斷。§7-1 的連線池和寄信設定、§7-4 的 1、2、4 項都已經在本機完成，見 [報名防重複與DB連線變更.md](報名防重複與DB連線變更.md)。

### 7-1. 連線池初始設定

| 參數 | 建議 | 說明 |
|---|---|---|
| `DB_CONNECTION_LIMIT` | **10**（1～2 個 instance）；**8**（3 個 instance） | 讓「部署重疊時最多」不超過上限的 70%（約 52 條） |
| backend instance 數 | 1 起步 | backend 的諮詢 rate limiter 存在記憶體裡，多個 instance 之間不會共用（[遷移預算](../digitalocean-migration-budget.md) L2） |

下面這些**需要改程式**，這次只是建議，等你決定後再另外做：
- `ssl`：必做。
- `enableKeepAlive: true`
- `maxIdle` 設 2～3，`idleTimeout` 設 60 秒：讓閒置連線自動收掉。
- `queueLimit` 設 50 左右：連線用完時快速回錯誤，而不是無限排隊。
- nodemailer 加上 `connectionTimeout`、`socketTimeout`（例如 10～15 秒）。

### 7-2. 必要監控指標

| 指標 | 從哪裡看 | 告警門檻 |
|---|---|---|
| CPU 使用率 | DO Insights | 尖峰時持續 15 分鐘 > 70% |
| 記憶體使用率 | DO Insights | 持續 > 85% |
| 磁碟使用率 | DO Insights | > 60% 警告、> 80% 嚴重（官方建議不要超過 90%） |
| 連線數（`Threads_connected`） | DO Insights／`SHOW GLOBAL STATUS` | > 45（上限 75 的 60%） |
| 連線被拒（`Aborted_connects`、`Connection_errors_max_connections`） | `SHOW GLOBAL STATUS` | > 0 就要查 |
| 慢查詢 | DO 設定 `slow_query_log`、`long_query_time=1` | 每小時 > 10 筆 |
| backend 錯誤率、`/ready` | App Platform／外部監控 | 5xx > 1%、`/ready` 失敗 |
| API p95 延遲 | App Platform 或 log | > 500 ms |
| 報名／諮詢筆數 | 每天跑 `reconcile-counts.sql` 或後台 | 跟通知信數量對不上就要查 |

### 7-3. 升級到 B 的條件（任一項成立）

1. 尖峰時 CPU 持續 > 70%，而且已經確認不是慢查詢造成的（如果是慢查詢，加索引通常比升級有效）
2. 記憶體持續 > 85%，或 buffer pool 命中率 < 99%
3. 部署重疊時的連線數 > 52，或出現「連線數已滿」的錯誤
4. backend 要長期跑 3 個以上 instance，又不想把每個 instance 的連線數降到 8
5. 磁碟用量超過 20 GiB（加買磁碟跟升級 B 的費用差不多）

### 7-4. 跟規格無關、但建議另外處理的事

| # | 問題 | 建議 |
|---|---|---|
| 1 | 報名按鈕可以連點 | 前端送出期間把按鈕 disabled |
| 2 | `POST /contact` 沒有限流，`contactList` 沒有上限 | 比照諮詢表單加 rate limit；Zod 加上 `.max()`，例如 20 筆 |
| 3 | 後台聯絡人列表不分頁 | 等資料量變大再處理 |
| 4 | 寄信沒有逾時 | 見 §7-1 |

## 8. 缺少的資料和壓測方式

### 8-1. 需要補的資料

| 資料 | 為什麼需要 | 從哪裡取得 |
|---|---|---|
| 每小時、每分鐘的尖峰頁面瀏覽數 | 平均 0.02 次／秒 看不出尖峰 | GA4（前端有 GTM）、Zeabur 或 CDN 存取紀錄 |
| 爬蟲／404 占 SSR 的比例 | §5 的推論需要證實 | 存取紀錄的 User-Agent 和狀態碼 |
| 活動期間的報名尖峰（例如講座公告後 1 小時內幾筆） | 寫入尖峰 | 金豐的行銷排程，加上歷史 `created_at` 分布 |
| 後台同時使用人數 | 後台查詢量 | 問金豐 |
| backend 預計 instance 數和部署頻率 | 連線計算 | 團隊決定 |
| 目前 Zeabur 的 API p95 延遲和 MySQL CPU／記憶體 | 對照組 | Zeabur 面板 |
| 每小時查詢數（唯讀取樣） | 尖峰 QPS | 在 Zeabur 正式庫尖峰時段，**隔 1 小時**各讀一次 `events_statements_summary_by_digest`（只有 SELECT，不寫入），相減就是那一小時的量 |

### 8-2. 壓測方式（只在演練環境做，**不可以對正式站**）

**環境：**
- DO 演練叢集（方案 A）＋ App Platform backend，同樣在 SGP1。
- 用演練匯入的資料，再用腳本把 contact／contact_list 複製到 10 倍、100 倍的量，模擬未來的資料量。
- `MAIL_HOST` 留空，避免真的寄信。

**工具：** k6 或 autocannon，從同一區域的機器發送請求。

| 情境 | 內容 | 怎麼加壓 | 觀察什麼 |
|---|---|---|---|
| S1 讀取組合 | 依 §3 的比例：seo、carousels、faq、contact-class、contact-quest | 每 2 分鐘加倍：5 → 10 → 20 → 40 → 80 次／秒 | p95 延遲、錯誤率、DB CPU、連線數 |
| S2 報名尖峰 | `POST /contact`（1～3 位聯絡人）＋ `POST /consultations` | 同時 10 → 50 個使用者，持續 5 分鐘 | 交易時間、有沒有 lock wait、錯誤率 |
| S3 後台 | 報名列表翻頁、公司搜尋、聯絡人列表（在 100 倍資料量下） | 同時 5 個使用者 | 單次回應時間、回應大小 |
| S4 部署重疊 | S1 進行中觸發一次 backend 重新部署 | — | 連線數高峰是不是 ≤ §2-2 的估算 |
| S5 端到端 | 改打前端頁面（包含 Nuxt SSR） | 跟 S1 一樣 | **瓶頸可能在前端，不在 DB** |

**判讀：**
- 找出「p95 > 500 ms 或錯誤率 > 1%」那一級的請求量，就是目前架構能承受的上限。
- 拿這個上限跟 §8-1 的實際尖峰比較，就知道餘裕有多少。
- 如果 DB CPU 先滿，看是不是升級 B（升級 B 不會多 CPU，可能要直接考慮 C）；如果 backend 或 Nuxt 先滿，就加 instance，**不用升級 DB**。

**收尾：** 壓測完刪除演練叢集，裡面的測試資料就一起清掉。

## 9. 參考資料（2026-10-24 查詢）

- [MySQL Limits](https://docs.digitalocean.com/products/databases/mysql/details/limits/)：連線數依記憶體計算（1 GiB = 75、2 GiB = 150、4 GiB = 400）、約 350 MB 系統開銷、另外保留 1 條系統連線、不支援 MySQL 連線池、只支援 8.4、PITR 7 天、每日備份會鎖 DDL、Standard Edition standby 的時程
- [MySQL Pricing](https://docs.digitalocean.com/products/databases/mysql/details/pricing/)：單節點「不是高可用、適合開發測試」、standby 價格、加購磁碟每 GiB US$0.215、Advanced Edition US$130 起
- [doctl databases storage-autoscale](https://docs.digitalocean.com/reference/doctl/reference/databases/storage-autoscale/)：觸發門檻 15～95%、每次增加 10～500 GiB、不會停機、上限依方案而定
- [How to Monitor MySQL Database Performance](https://docs.digitalocean.com/products/databases/mysql/how-to/monitor-databases/)：磁碟使用率建議 < 90%
- [digitalocean_database_mysql_config](https://docs.digitalocean.com/reference/terraform/reference/resources/database_mysql_config/)：binlog 保留時間可以設定（600～604,800 秒）
