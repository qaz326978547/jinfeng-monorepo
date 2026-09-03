export default defineNuxtConfig({
    devtools: { enabled: false },
    ssr: true,
    css: ['~/assets/css/style.css'],
    build: {
        transpile: ['@iconify/vue']
    },
    routeRules: {
        // 首頁沒有 route rule = 沿用上面全域 ssr: true 的預設行為：每次 request 都重新 SSR，
        // 不快取。先前用過 isr（3 天，後改 5 分鐘）想降低伺服器負擔，但快取沒有依 TTL
        // revalidate，導致後台編輯輪播圖後前台一直顯示舊內容，因此移除。
        '/admin/**': { swr: 0 } // 後台實時抓資料
    },
    experimental: {
        writeEarlyHints: false
    },
    modules: [
        '@nuxtjs/tailwindcss',
        '@nuxt/icon',
        '@nuxt/content',
        'nuxt-schema-org',
        '@nuxtjs/sitemap',
        '@pinia/nuxt'
    ],
    site: {
        url: 'https://laborservice5690.com',
        name: '勞資爭議與勞資糾紛 - 勞資我來教你 | 金豐集團'
    },
    sitemap: {
        // 只收錄公開頁面，後台、登入頁與感謝頁不應被索引
        exclude: ['/admin/**', '/auth', '/thanks'],
        autoLastmod: true
    },
    runtimeConfig: {
        public: {
            // Backend API origin (no trailing /api/v2 — that's appended in
            // store/usePublicStore.ts). Nuxt automatically overrides this default with
            // NUXT_PUBLIC_API_BASE_URL when set (standard runtimeConfig convention — no
            // manual process.env read needed). Local dev default matches
            // backend/docker-compose.yml's exposed port.
            apiBaseUrl: 'http://127.0.0.1:8080',
            // 正式網址；未設定環境變數時預設為正式網域，避免 preview/staging 環境誤植錯誤 canonical。
            // Override via NUXT_PUBLIC_SITE_URL.
            siteUrl: 'https://laborservice5690.com',
            // Google Tag Manager container ID. Empty = GTM disabled, see
            // plugins/vue-gtm.client.ts. Override via NUXT_PUBLIC_GTM_ID.
            gtmId: ''
        }
    },
    app: {
        head: {
            htmlAttrs: {
                lang: 'zh-Hant-TW'
            },
            title: '勞資爭議與勞資糾紛 - 勞資我來教你 | 金豐集團',
            link: [
                {
                    rel: 'shortcut icon',
                    href: '/favicon.ico',
                    type: 'image/x-icon'
                },
                {
                    rel: 'Bookmark',
                    href: '/favicon.ico',
                    type: 'image/x-icon'
                }
            ],
            meta: [
                { charset: 'utf-8' },
                {
                    name: 'viewport',
                    content: 'width=device-width, initial-scale=1.0'
                },
                {
                    name: 'google-site-verification',
                    content: 'uArEb0abZoSODjzX4DKcU_x8fTbna7x5Hu9Rye4fleQ'
                }
            ]
        }
    },
    vite: {
        // No `define: {'process.env': process.env}` here — that used to dump the entire
        // build-time process.env object into the client bundle (see
        // specs/backend/production-env-readiness.md §2.1). All env values the client needs
        // now flow through the runtimeConfig.public allowlist above instead.
        //
        // The old `server.proxy['/api']` dev-server proxy is also gone: nothing in this
        // app calls a relative `/api/...` path — every axios/useFetch call already passes
        // an absolute `baseURL` (via usePublicStore().apiBaseUrl), so the proxy was dead
        // code, and it read the now-removed NUXT_API_BASE_URL name.
        resolve: {
            alias: {
                images: '/assets/img'
            }
        }
    }
});