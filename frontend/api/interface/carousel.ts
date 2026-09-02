export type CarouselLinkType = 'internal' | 'external' | 'none';

// 對應 backend generateCarouselImageKey 的兩種前綴：carousel/desktop/{uuid}.ext、carousel/mobile/{uuid}.ext
export type CarouselImageVariant = 'desktop' | 'mobile';

// 前台首頁使用（GET /carousels 只回傳實際需要的欄位，不含 *ImageKey）
export interface PublicCarouselData {
    id: number;
    title: string;
    desktopImageUrl: string;
    mobileImageUrl: string;
    linkType: CarouselLinkType;
    linkUrl: string | null;
    sortOrder: number;
    isActive: boolean;
}

// 後台管理使用（GET/POST/PUT /admin/carousels）
export interface CarouselData {
    id: number;
    title: string;
    desktopImageKey: string;
    desktopImageUrl: string;
    mobileImageKey: string;
    mobileImageUrl: string;
    linkType: CarouselLinkType;
    linkUrl: string | null;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// 只送 *ImageKey，不送 *ImageUrl —— imageUrl 一律由 backend 依 AWS_S3_PUBLIC_BASE_URL 產生，
// 前端不可能（也不應該）自己組出可信任的圖片網址。
export interface CarouselWritePayload {
    title: string;
    desktopImageKey: string;
    mobileImageKey: string;
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
    { label: '勞資 News', path: '/labor-news' },
    { label: '勞資法規說明', path: '/labor-info' },
    { label: '勞資爭議', path: '/labor-dispute' },
    { label: '職業災害', path: '/occupational-accident' },
];
