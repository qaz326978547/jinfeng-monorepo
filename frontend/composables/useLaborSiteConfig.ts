/**
 * 集中管理全站 SEO 設定。
 * 正式網址由 NUXT_PUBLIC_SITE_URL 環境變數決定，未設定時預設為正式網域，
 * 避免 development / preview 環境誤植 localhost 或 staging 網址成為 canonical。
 */
export function useLaborSiteConfig() {
    const config = useRuntimeConfig();
    const url = (config.public.siteUrl as string).replace(/\/+$/, '');

    return {
        url,
        name: '勞資爭議與勞資糾紛 - 勞資我來教你 | 金豐集團',
        shortName: '金豐集團',
        legalName: '金豐企業管理顧問股份有限公司',
        locale: 'zh_TW',
        // <meta> 標籤需要可公開存取的絕對網址，因此保留 CDN 圖檔網址；頁面顯示的圖片則使用 assets/img 靜態資源。
        // TODO: 目前尚無設計好的 1200x630 社群分享圖，暫用現有 logo 圖檔代替 favicon.ico。
        // 待設計團隊提供正式分享圖後，請上傳至 CDN 或 /public/og-image.jpg 並更新此路徑。
        defaultOgImage: 'https://d1vjl2px6hqzku.cloudfront.net/logo.webp'
    };
}
