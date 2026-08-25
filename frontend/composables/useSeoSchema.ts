import type { BreadcrumbItem, EventSchemaInput, FaqSchemaItem } from '~/types/seo';

/**
 * Organization schema。只填入專案中可確認的真實資料：
 * 公司名稱、聯絡電話、Email、LINE 官方帳號（皆取自 FooterComponent 現有內容），
 * 以及 about 頁面既有的成立年份與據點城市。不虛構地址、評分或社群帳號。
 */
export function buildOrganizationSchema() {
    const site = useLaborSiteConfig();

    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: site.legalName,
        alternateName: site.shortName,
        url: site.url,
        logo: site.defaultOgImage,
        description:
            '金豐集團為專業的勞動法務管理顧問公司，自1995年成立以來，提供兩岸企業勞動法相關的專業諮詢與顧問服務。',
        foundingDate: '1995',
        address: [
            { '@type': 'PostalAddress', addressCountry: 'TW', addressLocality: '台灣' },
            { '@type': 'PostalAddress', addressCountry: 'CN', addressLocality: '上海' },
            { '@type': 'PostalAddress', addressCountry: 'CN', addressLocality: '昆山' },
            { '@type': 'PostalAddress', addressCountry: 'CN', addressLocality: '廈門' }
        ],
        knowsAbout: ['勞動法務管理', '勞資爭議處理', '人事成本控制', '工作規則制定', '勞動契約', '職業災害處理'],
        contactPoint: [
            {
                '@type': 'ContactPoint',
                contactType: 'customer service',
                telephone: '+886-930-532-215',
                email: 'a0930532215@gmail.com',
                areaServed: 'TW'
            }
        ],
        sameAs: ['https://lin.ee/9MI6Yao']
    };
}

/**
 * 備用的 WebSite schema helper。目前 nuxt-schema-org 會依 nuxt.config 的 site.url / site.name
 * 自動產生 WebSite 節點，因此全站不需再手動呼叫本函式，以免重複輸出；保留供未來停用自動產生時使用。
 */
export function buildWebSiteSchema() {
    const site = useLaborSiteConfig();

    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: site.name,
        url: site.url,
        inLanguage: 'zh-TW'
    };
}

/**
 * FAQPage schema，僅接受頁面上真實顯示的問答資料；資料為空時回傳 null，避免輸出空殼或假資料。
 */
export function buildFaqPageSchema(items: FaqSchemaItem[] | null | undefined) {
    if (!items || items.length === 0) return null;

    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((item) => ({
            '@type': 'Question',
            name: item.name,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.info
            }
        }))
    };
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
    const site = useLaborSiteConfig();

    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: `${site.url}${item.path === '/' ? '' : item.path}`
        }))
    };
}

/**
 * Event schema generator。僅在名稱、時間、地點皆為真實且完整的資料時才回傳 schema，
 * 否則回傳 null（呼叫端不應輸出任何 Event JSON-LD）。
 * 目前講座場次資料由後台 /contact-class API 動態提供，尚未有可靠的公開場次時間/地點可用，
 * 待該資料到位後可直接呼叫本函式產生 schema。
 */
export function buildEventSchema(input: EventSchemaInput | null | undefined) {
    if (!input) return null;
    if (!input.name || !input.startDate || !input.location?.name || !input.location?.address) {
        return null;
    }

    return {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        eventStatus: input.eventStatus ?? 'https://schema.org/EventScheduled',
        eventAttendanceMode: input.eventAttendanceMode ?? 'https://schema.org/OfflineEventAttendanceMode',
        location: {
            '@type': 'Place',
            name: input.location.name,
            address: input.location.address
        },
        description: input.description,
        offers: input.offers
            ? {
                  '@type': 'Offer',
                  price: input.offers.price,
                  priceCurrency: input.offers.priceCurrency,
                  availability: input.offers.availability ?? 'https://schema.org/InStock',
                  url: input.offers.url
              }
            : undefined
    };
}
