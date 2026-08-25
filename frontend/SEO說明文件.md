# SEO 改善說明文件

本文件記錄依據 `SEO.md` 需求所完成的 SEO 改善工作，包含已完成項目、尚未實作項目，以及過程中發現的重要問題。

最後更新：2026-07-17

---

## 一、稽核發現的主要問題（修改前）

| 等級 | 問題 |
| --- | --- |
| Critical | `pages/about.vue`、`faq.vue`、`labor-info.vue` 的 canonical / og:url / og:image / JSON-LD 全部寫死錯誤網域 `https://www.jenfeng.com.tw`（實測為 404），而非正式網域 `laborservice5690.com` |
| Critical | 首頁 `HeaderComponent.vue` 有一個 `sr-only` 的 `<h1>`，加上 `index.vue` hero 區塊自己的 `<h1>`，首頁出現重複 H1 |
| Critical | `/faq` 頁面同時輸出兩組 FAQPage JSON-LD：一組來自真實問答資料，另一組是 `pages/faq.vue` 寫死、只有主題名稱沒有真正答案的假資料 |
| Critical | 全站 `og:image` 使用 64×64 的 `favicon.ico`，不符合社群分享圖規格 |
| High | `public/sitemap.xml`（與根目錄重複的一份）只有首頁一筆，缺少 `/about`、`/faq`、`/labor-info`；同時裝了 `@nuxtjs/sitemap` 與 `nuxt-simple-sitemap` 兩套模組但都沒有註冊到 `nuxt.config.ts` |
| High | `/labor-info` 頁面幾乎 100% 由圖片構成，重要法規文字完全不存在於 HTML 中 |
| High | 導覽選單「F&Q」錯字 |
| High | 已安裝 `nuxt-jsonld` 模組但完全沒被使用，與實際在用的 `nuxt-schema-org` 並存造成混亂 |
| Medium | 各頁使用舊版 `hid` 屬性寫法，未使用官方建議的 `useSeoMeta` |
| Medium | canonical 網址寫死字串，沒有環境變數保護，開發/預覽環境有誤植風險 |
| Medium | `/thanks`、`/auth`、部分 admin 子頁缺少 `noindex` |
| Low | robots.txt 第一行寫 `Allow: /favicon.ico` 而非標準 `Allow: /` |

---

## 二、已完成項目

### 1. 建立集中式 SEO 工具（composables）

| 檔案 | 用途 |
| --- | --- |
| `composables/useLaborSiteConfig.ts` | 集中管理網站名稱、法定名稱、預設語系、預設分享圖等設定。特別命名為 `useLaborSiteConfig` 而非 `useSiteConfig`，是因為 `nuxt-site-config`（`@nuxtjs/sitemap` 的相依套件）本身就有一個同名的自動匯入 composable，若同名會被 Nuxt 靜默忽略。 |
| `composables/useCanonicalUrl.ts` | 依環境變數 `NUXT_PUBLIC_SITE_URL`（預設為正式網域）產生統一格式的 canonical 網址。 |
| `composables/usePageSeo.ts` | 單一函式集中設定 title / description / canonical / og:* / twitter:* / robots，所有公開頁面都改用這個，不再各自重複寫 meta。 |
| `composables/useSeoSchema.ts` | JSON-LD 產生器：`buildOrganizationSchema()`（真實公司資料）、`buildFaqPageSchema()`（僅在有真實問答時才輸出，否則回傳 `null`）、`buildBreadcrumbSchema()`、`buildEventSchema()`（欄位不完整時回傳 `null`，見「尚未實作」）。 |
| `types/seo.ts` | 上述工具共用的 TypeScript 型別。 |

### 2. 修正 canonical / OG / 網域問題

- `about.vue`、`faq.vue`、`labor-info.vue`、`index.vue` 全部改用 `usePageSeo()`，canonical 與 og:url 統一指向 `https://laborservice5690.com`。
- 首頁 title / description 改為需求指定文案：
  - title：`勞資爭議與勞資糾紛講座｜企業勞基法課程－勞資我來教你`
  - description：`專為企業老闆、人資主管與管理者設計的勞資爭議講座...`
- og:image 改用 CDN 上實際存在的圖片網址（`https://d1vjl2px6hqzku.cloudfront.net/...`），不再使用會 404 的組合網址。

### 3. JSON-LD 結構化資料整理

- `layouts/default.vue` 全站僅呼叫一次 `buildOrganizationSchema()`，避免每頁重複宣告 Organization。
- WebSite 節點**沒有**手動宣告，因為 `nuxt-schema-org` 會依 `nuxt.config.ts` 的 `site.url` / `site.name` 自動產生（同時它也會依網址最後一段自動推斷頁面類型，例如 `/faq` 自動變成 `FAQPage`、`/about` 自動變成 `AboutPage`）。
- `pages/faq.vue` 移除原本重複且假資料的 FAQPage JSON-LD，改由 `components/FaqComponent.vue` 依真實 API 問答資料透過 `buildFaqPageSchema()` 輸出；資料為空時不輸出，避免假結構化資料。
- 各頁補上 `BreadcrumbList`（首頁 › 目前頁）。

### 4. H1 / 標題階層修正

- `HeaderComponent.vue` 移除跨頁重複的 `sr-only` H1。
- `index.vue`、`about.vue`、`faq.vue`、`labor-info.vue` 各補上唯一且語意正確的 H1，並修正 H2/H3 排列順序（原本多處是「裝飾用小標」被寫成 H2、真正的區塊標題反而是 H3 的顛倒情況）。
- `components/SignUpClassForm.vue` 同步修正標題階層。

### 5. 導覽與文字修正

- 「F&Q」→「常見問題」（桌機版、手機版選單皆修正）。

### 6. 圖片內容轉為真實文字（`/labor-info`）

- 逐張讀取 `assets/img/01.webp` ~ `19.webp` 共 19 張圖片內容，依 5 個分類（講座介紹、勞動事件法、職災保險法、勞資爭議、法規與課程）整理成真正的 h2 標題 + 段落 + 條列文字，與原圖片並列呈現（圖片保留，非取代）。
- 頁尾加上「以上法規重點整理自講座教材，實際規定請以勞動部及相關主管機關公告為準」聲明。
- `/faq` 頁面加上真實 h1 與導言段落。

### 7. Sitemap / robots.txt

- 啟用 `@nuxtjs/sitemap`（已安裝但原本沒註冊的模組），移除重複、未使用的 `nuxt-simple-sitemap` 與 `nuxt-jsonld`。
- 刪除兩份手動維護、內容過舊的靜態 `sitemap.xml`（根目錄與 `public/`），改為自動產生，正確排除 `/admin/**`、`/auth`、`/thanks`。
- `public/robots.txt` 簡化並修正為標準格式（`Allow: /` 取代 `Allow: /favicon.ico`）。
- `pages/thanks.vue`、`pages/auth.vue`、`pages/admin/contact/class/[id].vue`、`pages/admin/contact/class/create_class.vue` 補上 `noindex`。

### 8. 效能（Core Web Vitals）

- `labor-info.vue` 當前分頁第一張圖、`faq.vue` 首圖、`about.vue` 證書圖，`loading` 從 `lazy` 改為 `eager`（避免首屏 LCP 圖片被延遲載入）；其餘非首屏圖片維持 `lazy`。

### 9. 意外發現並修復的嚴重 Bug（與 SEO 需求無關，但直接影響 SEO 成效）

`nuxt.config.ts` 原本的 `devtools: { enabled: true }` 會導致 **production build 下，除了首頁以外的所有頁面（`/about`、`/faq`、`/labor-info`）回傳 HTTP 500**（`npm run dev` 測不出來，只有實際 `npm run build` 才會出現）。已確認這個問題在改動 SEO 之前就存在（用原始程式碼重現得到相同結果），已將 `devtools` 關閉並驗證所有頁面恢復 200。**這個問題非常關鍵：若正式站也受影響，代表 Google 完全無法索引除了首頁以外的頁面**，強烈建議部署前用 `npm run build` 實際訪問各頁確認。

### 10. 驗證

- `npx nuxi typecheck`：通過（僅有專案原本就存在、與 `/html/new.tsx` 這個非路由用的 React 參考檔相關的錯誤，與本次改動無關）。
- `npm run build`：通過。
- 修正 devtools 問題後，實際啟動 production build 並用 curl 檢查：
  - 首頁 / about / faq / labor-info 皆回傳 200
  - title、description、canonical、OG、Twitter、JSON-LD 皆存在於 SSR 初始 HTML
  - 每頁僅有 1 個 H1
  - robots.txt、sitemap.xml 皆可正常存取，內容正確
  - `/thanks`、`/auth` 皆有 `noindex`

---

## 三、尚未實作 / 需要人工提供資料

1. **正式社群分享圖（OG image）**
   目前全站預設分享圖暫用 `logo.webp`（真實存在的 CDN 圖片，非假圖），但不是理想的 1200×630 尺寸。待設計團隊提供正式分享圖後，於 `composables/useLaborSiteConfig.ts` 的 `defaultOgImage` 更新路徑（檔案內已標記 TODO）。

2. **SEO landing page（`/labor-dispute`、`/labor-law-seminar`、`/severance-pay`、`/overtime-pay`、`/occupational-accident`、`/labor-inspection`、`/faq` 獨立擴充）**
   依先前討論，這次先不建立，避免內容不足產生薄弱頁面。列入第二階段，待有足夠獨立內容素材時再規劃。

3. **Event（活動場次）結構化資料**
   `useSeoSchema.ts` 中的 `buildEventSchema()` 已建好，但因場次日期、地點目前僅存在於後台 `/contact-class` API 動態資料中，無可靠的公開場次資訊可用，因此尚未在任何頁面呼叫。待該 API 資料完整（有明確場次名稱、日期、地點）後即可直接串接，函式會在資料不完整時自動回傳 `null`，不會誤輸出結構化資料。

4. **ESLint**
   專案目前沒有 ESLint 設定/依賴，因此本次驗證跳過此步驟，未新增此工具（避免超出 SEO 範圍的額外配置決策）。

5. **`/faq` 頁面的 FAQPage 結構化資料是否有真實內容，取決於後台 API 是否有回傳資料**
   目前已確認邏輯正確（有資料才輸出、無資料不輸出假 schema），但本機測試環境沒有連到正式後台，未能驗證正式環境下實際輸出的問答內容數量是否完整，建議上線後用 Google 的 [Rich Results Test](https://search.google.com/test/rich-results) 實際驗證 `/faq`。

6. **`html/new.tsx`**
   這是一個非路由、疑似 React 參考用的舊檔案，會讓 `npx nuxi typecheck` 報錯，但不影響實際網站運作。是否清理不在本次 SEO 範圍內，僅在此記錄供參考。

---

## 四、建議後續動作

1. **部署前**：務必用 `npm run build` 產出正式 build 並實際訪問 `/about`、`/faq`、`/labor-info` 確認回傳 200（見上方 devtools 問題）。
2. **Google Search Console**：提交 `https://laborservice5690.com/sitemap.xml`，並用「URL 檢查」工具個別提交首頁與三個子頁面。
3. **Rich Results Test**：驗證 `/faq` 頁面的 FAQPage 結構化資料是否正確顯示問答內容。
4. **優先追蹤關鍵字**：勞資爭議、勞資糾紛、勞基法講座、企業勞動法、資遣費、加班費、職業災害、勞動檢查。
