在frontend/pages/index.vue 輪播圖區域我需要開發新功能

1. 後台新增 輪播圖設定頁面

- 可以控制前台輪播圖區域的圖片和點擊後的路由連結(例如:/labor-info,/about 等...)

2. 前台可以根據後台的api 取得對應的輪播圖片和路由連結

另外我已經有AWS S3 , 我想透過上傳到AWS S3 做CRUD 要怎麼做?

---

## 更新（Desktop / Mobile 雙圖片設計）

同一筆輪播圖現在同時包含兩張獨立圖片，不是兩筆資料：

- **PC / Desktop**：建議尺寸 1920 × 1080 px，比例 16:9
- **Mobile**：建議尺寸 700 × 800 px，比例 7:8

### Breakpoint

- `< 768px` → 顯示 Mobile 圖
- `>= 768px` → 顯示 Desktop 圖

前台不使用 `window.innerWidth` / `matchMedia` / resize listener，改用瀏覽器原生的
`<picture><source media="(max-width: 767px)">` 讓瀏覽器自己決定下載哪張圖，避免先下載
Desktop 大圖再切換成 Mobile 圖的浪費。

### S3 Key Prefix

- Desktop：`carousel/desktop/{uuid}.{ext}`
- Mobile：`carousel/mobile/{uuid}.{ext}`

兩者都在 `carousel/*` 底下，沿用既有 IAM policy
（`arn:aws:s3:::laborservice5690-assets/carousel/*`），不需要調整權限。

### 圖片規格驗證（第一版）

- 只驗證 MIME type（`image/jpeg`、`image/png`、`image/webp`）與檔案大小（每張最大 5MB）
- 不 resize、不 crop、不引入 sharp、不檢查實際 pixel dimensions

### API

- `GET /api/v2/carousels`（public）回傳 `desktopImageUrl`/`mobileImageUrl`，不回 `*ImageKey`
- `POST /api/v2/admin/carousels/upload-url` 的 request 多一個 `variant: "desktop" | "mobile"` 欄位，決定 S3 key 前綴
- Admin CRUD（`GET/POST/PUT/DELETE /api/v2/admin/carousels`）全面使用
  `desktopImageKey`/`desktopImageUrl`/`mobileImageKey`/`mobileImageUrl` 命名，不再使用單一的
  `imageKey`/`imageUrl` 代表 desktop

### CDN

圖片公開讀取網址為 `https://cdn.laborservice5690.com`（CloudFront，S3 bucket 本身為 private），
由 backend 的 `AWS_S3_PUBLIC_BASE_URL` 環境變數 + imageKey 組成。Presigned upload 仍然直接對
S3 簽章、直接從瀏覽器 PUT 到 S3，不經過 CloudFront（CloudFront 只負責讀取）。
