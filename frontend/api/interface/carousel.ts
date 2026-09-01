export type CarouselLinkType = 'internal' | 'external' | 'none';

// 前台首頁使用（GET /carousels 只回傳實際需要的欄位）
export interface PublicCarouselData {
    id: number;
    title: string;
    imageUrl: string;
    linkType: CarouselLinkType;
    linkUrl: string | null;
}

// 後台管理使用（GET/POST/PUT /admin/carousels）
export interface CarouselData {
    id: number;
    title: string;
    imageKey: string;
    imageUrl: string;
    linkType: CarouselLinkType;
    linkUrl: string | null;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CarouselWritePayload {
    title: string;
    imageUrl: string;
    imageKey: string;
    linkType: CarouselLinkType;
    linkUrl: string | null;
    sortOrder: number;
    isActive: boolean;
}

export interface UploadUrlResponse {
    uploadUrl: string;
    imageKey: string;
    imageUrl: string;
}

// 目前公開路由選單 — 供 internal link 下拉選單使用，同時允許自訂路徑輸入
// （對應 frontend/pages/*.vue，見規劃調查）
export const INTERNAL_LINK_OPTIONS: Array<{ label: string; path: string }> = [
    { label: '首頁', path: '/' },
    { label: '關於我們', path: '/about' },
    { label: '常見問題', path: '/faq' },
    { label: '勞資法規說明', path: '/labor-info' },
    { label: '勞資爭議', path: '/labor-dispute' },
    { label: '職業災害', path: '/occupational-accident' },
];
