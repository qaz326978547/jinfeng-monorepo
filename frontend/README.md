# 金豐集團 - 勞資爭議與勞資糾紛網站

這是一個基於 Nuxt 3 開發的勞資爭議諮詢服務網站,提供勞資糾紛相關課程、常見問題解答和後台管理系統。

## 專案簡介

本專案使用 Nuxt 3 框架搭建,整合了 Tailwind CSS、Pinia 狀態管理、Google Tag Manager 追蹤等功能,支援 SSR (伺服器端渲染) 和 ISR (增量靜態再生),提供優秀的 SEO 表現和使用者體驗。

**網站名稱**: 勞資爭議與勞資糾紛 - 勞資我來教你 | 金豐集團  
**網址**: https://laborservice5690.com

## 技術棧

-   **框架**: Nuxt 3
-   **語言**: TypeScript
-   **UI 框架**: Tailwind CSS, Nuxt UI
-   **狀態管理**: Pinia
-   **HTTP 客戶端**: Axios
-   **圖示庫**: Iconify
-   **SEO 優化**: nuxt-jsonld, nuxt-schema-org, @nuxtjs/sitemap
-   **分析追蹤**: Google Tag Manager
-   **安全性**: Helmet

## 專案架構

```
📦 jenfeng/
├── 📁 api/                          # API 接口層
│   ├── auth.ts                      # 認證相關 API
│   ├── faq.ts                       # 常見問題 API
│   ├── signedUpClass.ts             # 課程報名 API
│   └── 📁 interface/                # TypeScript 介面定義
│       ├── auth.ts                  # 認證介面
│       ├── seo.ts                   # SEO 介面
│       └── signedUpClass.ts         # 課程報名介面
│
├── 📁 assets/                       # 靜態資源
│   ├── 📁 css/
│   │   └── style.css                # 全域樣式
│   └── 📁 img/                      # 圖片資源
│
├── 📁 components/                   # Vue 組件
│   ├── FaqComponent.vue             # 常見問題組件
│   ├── FixedIcon.vue                # 固定圖示組件
│   ├── FooterComponent.vue          # 頁尾組件
│   ├── HeaderComponent.vue          # 頁首組件
│   ├── LoadingComponet.vue          # 載入動畫組件
│   ├── PrivacyModel.vue             # 隱私權彈窗組件
│   ├── SignUpClassForm.vue          # 課程報名表單組件
│   └── 📁 admin/                    # 後台專用組件
│       └── NavBarComponent.vue      # 後台導航列組件
│
├── 📁 html/                         # 靜態 HTML 範本
│   ├── index.html                   # 首頁範本
│   └── seminar.html                 # 研討會範本
│
├── 📁 layouts/                      # 頁面佈局
│   ├── admin.vue                    # 後台佈局
│   └── default.vue                  # 預設佈局
│
├── 📁 middleware/                   # 中間件
│   ├── blockBadRoutes.global.ts     # 阻擋不良路由 (全域)
│   ├── pageview.global.ts           # 頁面瀏覽追蹤 (全域)
│   └── redirect-www.global.ts       # WWW 重定向 (全域)
│
├── 📁 pages/                        # 頁面路由
│   ├── auth.vue                     # 認證頁面
│   ├── index.vue                    # 首頁
│   ├── thanks.vue                   # 感謝頁面
│   └── 📁 admin/                    # 後台管理
│       ├── index.vue                # 後台首頁
│       └── 📁 contact/              # 聯絡管理
│           ├── [id].vue             # 聯絡詳情 (動態路由)
│           ├── contact_class.vue    # 課程聯絡列表
│           ├── contact_detail.vue   # 聯絡詳情頁
│           ├── contact_quest.vue    # 問題聯絡列表
│           ├── index.vue            # 聯絡管理首頁
│           └── 📁 class/            # 課程管理
│               ├── [id].vue         # 課程詳情 (動態路由)
│               └── create_class.vue # 新增課程
│
├── 📁 plugins/                      # Nuxt 插件
│   └── vue-gtm.client.ts            # Google Tag Manager 插件 (客戶端)
│
├── 📁 public/                       # 公開靜態文件
│   ├── robots.txt                   # 爬蟲規則
│   └── sitemap.xml                  # 網站地圖
│
├── 📁 server/                       # 伺服器端代碼
│   ├── tsconfig.json                # 伺服器 TypeScript 配置
│   └── 📁 middleware/               # 伺服器中間件
│       ├── blockBadPaths.ts         # 阻擋不良路徑
│       └── helmet.ts                # Helmet 安全性中間件
│
├── 📁 store/                        # Pinia 狀態管理
│   ├── useAuthStore.ts              # 認證狀態管理
│   └── usePublicStore.ts            # 公開資料狀態管理
│
├── 📁 utils/                        # 工具函數
│   └── http.ts                      # HTTP 請求封裝
│
├── error.vue                        # 錯誤頁面
├── nuxt.config.ts                   # Nuxt 配置文件
├── package.json                     # 專案依賴配置
├── sitemap.xml                      # 網站地圖
├── tailwind.config.ts               # Tailwind CSS 配置
└── tsconfig.json                    # TypeScript 配置
```

## 功能模組說明

### 1. 前台功能

-   **首頁 (`/`)**: 展示課程資訊、服務介紹
-   **課程報名**: 透過表單報名勞資課程
-   **常見問題 (FAQ)**: 提供勞資糾紛相關常見問題解答
-   **固定聯絡圖示**: 快速聯絡方式 (電話、LINE 等)
-   **隱私權政策**: 彈窗顯示隱私權資訊

### 2. 後台管理 (`/admin/*`)

-   **認證系統**: 登入驗證保護後台頁面
-   **聯絡管理**:
    -   查看所有聯絡表單提交
    -   課程報名管理
    -   問題諮詢管理
-   **課程管理**:
    -   新增/編輯課程資訊
    -   課程詳情管理

### 3. SEO 優化

-   **Server-Side Rendering (SSR)**: 提升首屏載入速度和 SEO
-   **Incremental Static Regeneration (ISR)**: 首頁每 3 天更新一次
-   **結構化資料**: 使用 JSON-LD 格式
-   **Sitemap**: 自動生成網站地圖
-   **Meta 標籤**: 完整的 Open Graph 和 Twitter Card 支援

### 4. 效能與安全

-   **CDN 整合**: CloudFront 圖片加速
-   **Helmet**: HTTP 標頭安全性保護
-   **路由保護**: 阻擋不良路由和路徑
-   **WWW 重定向**: 統一域名訪問

### 5. 追蹤與分析

-   **Google Tag Manager**: 整合 GTM 追蹤代碼
-   **頁面瀏覽追蹤**: 自動記錄頁面瀏覽事件

## 環境設定

### 安裝依賴

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

### 開發環境

啟動開發伺服器 (運行於 `http://localhost:3000`):

```bash
# npm
npm run dev

# pnpm
pnpm run dev

# yarn
yarn dev

# bun
bun run dev
```

### 生產環境建置

建置應用程式用於生產環境:

```bash
# npm
npm run build

# pnpm
pnpm run build

# yarn
yarn build

# bun
bun run build
```

### 預覽生產建置

本地預覽生產環境建置:

```bash
# npm
npm run preview

# pnpm
pnpm run preview

# yarn
yarn preview

# bun
bun run preview
```

### 生成靜態網站

生成靜態 HTML 檔案:

```bash
# npm
npm run generate

# pnpm
pnpm run generate

# yarn
yarn generate

# bun
bun run generate
```

## 環境變數

見 `frontend/.env.example`（唯一的真相來源，內容已對照 `nuxt.config.ts`/`store/usePublicStore.ts`/`plugins/vue-gtm.client.ts` 的實際程式碼逐一核對）。三個變數都走 Nuxt `runtimeConfig.public` 的標準 override 慣例：

```env
# 後端 API origin（不含路徑，/api/v2 由 store/usePublicStore.ts 附加）
NUXT_PUBLIC_API_BASE_URL=http://localhost:8080

# 正式網址，用於 canonical URL / SEO metadata
NUXT_PUBLIC_SITE_URL=http://localhost:3000

# Google Tag Manager 容器 ID，留空 = 不啟用 GTM
NUXT_PUBLIC_GTM_ID=
```

CDN 圖片網址（`https://d1vjl2px6hqzku.cloudfront.net`）目前是直接寫死在 `composables/useLaborSiteConfig.ts` 等檔案裡，**沒有**對應的環境變數。

## 路由規則

專案使用混合渲染策略:

-   **首頁 (`/`)**: ISR - 每 3 天重新生成
-   **後台頁面 (`/admin/**`)\*\*: SWR - 即時更新,無快取

## 資料夾功能詳解

### `api/`

包含所有 API 呼叫邏輯,使用 Axios 進行 HTTP 請求。每個 API 文件對應一個業務模組,並在 `interface/` 子目錄中定義 TypeScript 類型。

### `components/`

Vue 組件庫,採用模組化設計。包含共用組件和後台專用組件,支援組件自動導入。

### `middleware/`

中間件處理請求攔截和全域邏輯:

-   **blockBadRoutes**: 防止惡意路由訪問
-   **pageview**: GTM 頁面瀏覽事件追蹤
-   **redirect-www**: 處理 www 子域名重定向

### `pages/`

基於文件的路由系統,自動生成路由配置。使用 `[id].vue` 語法建立動態路由。

### `store/`

Pinia 狀態管理:

-   **useAuthStore**: 管理使用者認證狀態
-   **usePublicStore**: 管理公開資料和快取

### `server/middleware/`

伺服器端中間件,在 Nitro 引擎層級運行:

-   **helmet**: 設置安全 HTTP 標頭
-   **blockBadPaths**: 伺服器層級路徑過濾

### `utils/`

工具函數庫,包含 HTTP 客戶端封裝和通用輔助函數。

## 開發規範

### 程式碼風格

-   使用 TypeScript 進行類型檢查
-   使用 Prettier 進行程式碼格式化
-   遵循 Vue 3 Composition API 風格

### 命名規範

-   組件: PascalCase (如 `HeaderComponent.vue`)
-   文件/目錄: camelCase 或 kebab-case
-   Store: `use` 前綴 (如 `useAuthStore`)

### 提交規範

建議使用語義化提交訊息:

-   `feat`: 新功能
-   `fix`: 修復錯誤
-   `docs`: 文件更新
-   `style`: 程式碼格式調整
-   `refactor`: 重構
-   `test`: 測試相關
-   `chore`: 建置或輔助工具變動

## 部署

### Vercel / Netlify

專案可直接部署到 Vercel 或 Netlify,支援自動 CI/CD。

### Node.js 伺服器

```bash
npm run build
node .output/server/index.mjs
```

### Docker

可建立 Dockerfile 進行容器化部署。

## 相關連結

-   [Nuxt 3 文檔](https://nuxt.com/docs)
-   [Tailwind CSS](https://tailwindcss.com/)
-   [Pinia](https://pinia.vuejs.org/)
-   [Vue 3](https://vuejs.org/)

## 授權

此專案為 金豐集團 所有,僅供內部使用。

## 聯絡方式

如有問題或建議,請聯繫開發團隊。

---

**最後更新**: 2026年1月19日

