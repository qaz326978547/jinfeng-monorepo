請完整檢查並加強這個 Nuxt 3 專案的 SEO。

正式網站：
https://laborservice5690.com/

專案背景：

-   前端使用 Nuxt 3 SSR
-   後端可能串接 Laravel API
-   網站主題為勞資爭議、勞資糾紛、勞基法講座與企業勞動法務課程
-   主要客群是企業老闆、公司負責人、人資主管、管理階層與創業者
-   主要轉換目標是填寫講座報名表或加入 LINE 諮詢
-   請保留目前網站外觀、動畫、表單功能、API 串接與 RWD，不要進行無關的大幅重構

請先分析整個專案，再直接完成合理且安全的 SEO 改善。

一、先進行 SEO 稽核

請檢查：

1. Nuxt 是否正確使用 SSR，重要文字是否存在於初始 HTML
2. app.vue、layouts、pages、components 與 nuxt.config.ts 的 SEO 設定
3. title、meta description、canonical、robots、viewport
4. Open Graph 與 Twitter Card
5. favicon、網站圖示與社群分享圖片
6. robots.txt 是否存在且內容正確
7. sitemap.xml 是否存在且包含所有公開頁面
8. HTML 是否只有一個明確的 h1
9. h1、h2、h3 是否依照語意正確排列
10. 圖片是否具有適當的 alt、width、height、loading 與格式
11. 是否有大量重要資訊只存在圖片中
12. 表單欄位是否有 label、name、autocomplete 與無障礙屬性
13. 站內連結、錨點連結與導覽是否可以被搜尋引擎理解
14. 是否存在重複 title、重複 description 或薄弱內容
15. Core Web Vitals，包括 LCP、CLS、INP
16. JavaScript bundle、第三方腳本、字型與圖片是否影響載入速度
17. 是否存在錯誤網址、404、重複網址或 query parameter 索引問題
18. 網站是否使用正確的繁體中文語系設定，例如 html lang="zh-Hant-TW"
19. 是否有錯字或不自然的導覽名稱，例如「F&Q」應評估改為「FAQ」或「常見問題」
20. 是否有不應被索引的測試頁、API 路徑或後台路徑

請先輸出目前發現的問題清單，按照以下層級分類：

-   Critical
-   High
-   Medium
-   Low

然後再進行實作。

二、完善全站 Meta SEO

請依照 Nuxt 3 最佳實務，建立可集中管理的 SEO 設定。

首頁建議使用：

title：
勞資爭議與勞資糾紛講座｜企業勞基法課程－勞資我來教你

meta description：
專為企業老闆、人資主管與管理者設計的勞資爭議講座，解析勞動契約、加班費、資遣費、職業災害、勞動檢查及勞資糾紛預防，協助企業降低勞動法令風險。

請注意：

-   title 建議控制在合理搜尋結果長度
-   description 約 80～150 個中文字內
-   不要堆砌關鍵字
-   使用 useSeoMeta 或 Nuxt 官方推薦方式
-   設定 canonical 為正式網址
-   不要讓 staging、localhost 或 preview 網址成為 canonical
-   canonical 網址結尾格式必須全站一致
-   補上 og:title、og:description、og:type、og:url、og:image、og:locale
-   補上 twitter:card、twitter:title、twitter:description、twitter:image
-   若目前沒有適合的分享圖片，請建立明確的檔案放置位置與 TODO，不要生成品質低落的假圖片
-   確保每個公開頁面可以覆寫自己的 title、description 與 canonical

三、加入結構化資料 JSON-LD

請使用安全、符合頁面實際內容的 Schema.org JSON-LD。

至少評估並實作：

1. Organization
2. WebSite
3. WebPage
4. FAQPage
5. Event
6. BreadcrumbList

規則：

-   Organization 僅填入專案中能確認的真實公司資料
-   不要虛構地址、價格、評分、講師資格或社群帳號
-   Event 的日期、地點、票價與報名狀態必須來自實際資料
-   如果場次資料目前無法可靠取得，請先建立可重用的 schema generator，只有資料完整時才輸出 Event schema
-   FAQPage 必須由頁面上使用者看得到的 FAQ 問答產生
-   不可只放問題而沒有實際答案
-   JSON-LD 不可重複輸出
-   避免 hydration mismatch
-   使用 Nuxt SSR 可正常輸出的方式加入 head

四、改善圖片型內容的 SEO

目前網站有大量重要資訊可能放在圖片中。

請：

1. 找出所有含有重要文案的圖片
2. 不要只依賴圖片 alt
3. 將重要內容以真正的 HTML 文字同步呈現在頁面中
4. 可以保留原圖片，但要建立語意清楚的文字區塊
5. 不要隱藏文字、不要使用 SEO 欺騙手法
6. 將文字合理整理成：

    - h2 標題
    - 簡短段落
    - 重點列表
    - FAQ 問答

7. 避免整頁關鍵字堆砌
8. 修正圖片 alt 中的錯字、重複內容與過長描述
9. 裝飾性圖片使用空 alt
10. 重要圖片使用具體、自然且精簡的繁體中文 alt
11. 圖片補上明確 width、height，降低 CLS
12. 首屏主視覺不要 lazy load
13. 非首屏圖片使用 lazy loading
14. 優先評估 WebP 或 AVIF
15. 若使用 Nuxt Image，請確認部署環境相容後再調整

五、改善頁面語意與內容架構

請確保首頁包含：

-   一個且只有一個 h1
-   清楚說明這是什麼服務
-   適合哪些對象
-   可以解決哪些勞資問題
-   課程內容
-   常見問題
-   報名方式
-   聯絡資訊
-   明確 CTA

建議首頁 h1：

企業勞資爭議與勞資糾紛預防講座

自然涵蓋以下主題，但不要硬塞關鍵字：

-   勞資爭議
-   勞資糾紛
-   勞基法講座
-   企業勞動法
-   資遣費
-   加班費
-   勞動契約
-   職業災害
-   勞動檢查
-   人資課程

請將目前沒有答案的 FAQ 補成真正的問答內容，但是：

-   只能根據網站現有內容整理
-   不要自行提供可能過時或不正確的法律結論
-   涉及法規數字、罰則、期限或法律判斷時，請加上資料來源 TODO 或保留原有已確認內容
-   不要把網站寫成提供個案法律意見
-   可加入「實際情況仍應依個案及最新法規判斷」之類的合理聲明

六、建立 robots.txt 與 sitemap

請檢查目前是否已有相關設定。

如果沒有，請使用適合 Nuxt 3 現有版本的穩定方案完成：

robots.txt 至少包含：

User-agent: \*
Allow: /
Sitemap: https://laborservice5690.com/sitemap.xml

同時：

-   排除不應索引的 API、後台、測試或預覽路徑
-   不要錯誤封鎖 CSS、JS 與圖片
-   sitemap 只包含正式公開網址
-   canonical 與 sitemap 網址格式一致
-   不要把表單送出結果頁、測試頁或重複網址放進 sitemap
-   若安裝 Nuxt module，先確認與目前 Nuxt 版本相容
-   不要同時存在兩套 sitemap 或 robots 實作

七、改善效能與 Core Web Vitals

在不破壞視覺效果的前提下：

-   優化首屏最大圖片
-   預載真正的 LCP 圖片
-   避免錯誤 preload
-   減少沒有使用的 JavaScript 與 CSS
-   延遲載入非必要第三方腳本
-   避免大型圖片阻塞首屏
-   字型使用 font-display: swap
-   減少 layout shift
-   為圖片與 iframe 保留尺寸
-   檢查 hydration warning
-   不要為了 Lighthouse 分數移除必要功能
-   不要改壞表單驗證、API 送出與追蹤功能

八、建立可擴充的內容頁面架構

先檢查目前網站是否為單頁。

若專案架構允許，請建立或規劃以下 SEO landing page，並確保不是重複或空洞內容：

-   /labor-dispute：勞資爭議
-   /labor-law-seminar：勞基法講座
-   /severance-pay：資遣費相關課程
-   /overtime-pay：加班費相關課程
-   /occupational-accident：職業災害風險
-   /labor-inspection：勞動檢查
-   /faq：常見問題

執行原則：

-   若現有內容不足以產生有價值的獨立頁面，不要建立大量薄弱頁面
-   可以先建立資料結構、頁面模板及明確 TODO
-   每頁必須有獨立 title、description、canonical、h1 與實質內容
-   不要複製首頁文案湊頁數
-   建立合理的首頁內部連結
-   每頁提供回到講座報名區或聯絡區的 CTA
-   若這次變更範圍過大，首頁技術 SEO 優先，內容頁架構列入第二階段

九、建立 SEO 共用工具

請視專案架構建立：

-   composables/usePageSeo.ts
-   utils 或 composables 的 canonical URL helper
-   JSON-LD schema helper
-   集中式 site config
-   可重用 FAQ schema
-   可重用 Event schema
-   TypeScript 型別

要求：

-   避免在每個頁面重複寫相同 meta
-   支援環境變數設定正式網站網址
-   production 預設正式網址
-   development 不得輸出錯誤 canonical
-   程式碼符合目前專案風格
-   不要引入過多套件
-   優先使用 Nuxt 原生能力

十、驗證與交付

完成後請執行：

1. TypeScript typecheck
2. ESLint
3. production build
4. 現有測試
5. 檢查 SSR 產出的 HTML
6. 確認 title 與 meta description 存在於初始 HTML
7. 確認 JSON-LD 是有效 JSON
8. 確認 robots.txt 可以存取
9. 確認 sitemap.xml 可以存取
10. 確認 canonical 使用正式網域
11. 確認沒有 duplicate h1
12. 確認圖片沒有明顯缺少 alt
13. 確認表單仍可正常使用
14. 確認手機版與桌面版沒有版面破壞

請最後輸出：

-   修改前的主要 SEO 問題
-   實際修改了哪些檔案
-   每個修改的目的
-   尚未完成且需要人工提供的資料
-   建議提交 Google Search Console 的步驟
-   建議優先追蹤的關鍵字
-   建議後續建立的內容頁面
-   驗證指令與結果
-   可能的風險
-   Git diff 摘要

重要限制：

-   不要虛構公司資訊、講師資訊、活動日期、地址、價格或法律內容
-   不要使用 hidden text、關鍵字堆砌或其他黑帽 SEO
-   不要改壞現有 UI、動畫、表單、API、RWD 或 GA/GTM
-   不要直接刪除現有內容
-   對不確定的改動先保留 TODO 並說明原因
-   修改前先閱讀 package.json、nuxt.config.ts 和現有專案結構
-   使用現有 package manager
-   請直接修改程式碼，不要只提供教學
-   若發現專案不是 Nuxt 3，請根據實際框架改用對應最佳實務

