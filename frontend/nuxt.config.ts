export default defineNuxtConfig({
    devtools: { enabled: false },
    ssr: true,
    css: ['~/assets/css/style.css'],
    build: {
        transpile: ['@iconify/vue']
    },
    routeRules: {
        '/': { isr: 259200 }, // 每 3 天更新首頁
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
            // 正式網址；未設定環境變數時預設為正式網域，避免 preview/staging 環境誤植錯誤 canonical
            siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://laborservice5690.com'
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
        define: {
            'process.env': process.env
        },
        server: {
            proxy: {
                '/api': {
                    target:
                        process.env.NODE_ENV === 'production' ? process.env.NUXT_API_BASE_URL : 'http://127.0.0.1:9001',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/api/, '/api')
                }
            }
        },
        resolve: {
            alias: {
                images: '/assets/img'
            }
        }
    }
});
