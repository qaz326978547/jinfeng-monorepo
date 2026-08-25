export interface PageSeoOptions {
    /** 頁面標題，會自動用於 title / og:title / twitter:title */
    title: string;
    /** 頁面描述，建議 80~150 個中文字內 */
    description: string;
    /** 目前頁面路徑，預設取當前路由，例如 /about */
    path?: string;
    /** 分享圖片路徑（相對或絕對網址），未提供則使用全站預設圖 */
    image?: string;
    /** og:type，預設 website */
    type?: 'website' | 'article';
    /** 是否禁止索引，例如後台、感謝頁、登入頁 */
    noindex?: boolean;
}

export interface FaqSchemaItem {
    id: number | string;
    name: string;
    info: string;
}

export interface BreadcrumbItem {
    name: string;
    path: string;
}

/**
 * 場次資料需完整（名稱、開始時間、地點）才會產生 Event schema，
 * 避免輸出不完整或不正確的結構化資料。
 */
export interface EventSchemaInput {
    name: string;
    startDate: string;
    endDate?: string;
    location: {
        name: string;
        address: string;
    };
    description?: string;
    /** 例如 https://schema.org/EventScheduled */
    eventStatus?: string;
    /** 例如 https://schema.org/OfflineEventAttendanceMode */
    eventAttendanceMode?: string;
    offers?: {
        price: string;
        priceCurrency: string;
        availability?: string;
        url?: string;
    };
}
