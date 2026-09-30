export type CallbackTime = 'anytime' | 'morning' | 'noon' | 'afternoon' | 'evening';

export const CALLBACK_TIME_OPTIONS: { value: CallbackTime; label: string }[] = [
    { value: 'anytime', label: '隨時都可以' },
    { value: 'morning', label: '上午 08:00～12:00' },
    { value: 'noon', label: '中午 12:00～13:00' },
    { value: 'afternoon', label: '下午 13:00～18:00' },
    { value: 'evening', label: '晚上 18:00～22:00' }
];

// 免費諮詢送出資料（首頁「聯絡我們／免費諮詢」表單）
export interface ConsultationCreatePayload {
    name: string;
    phone: string;
    companyName: string | null;
    taxId: string | null;
    lineId: string | null;
    callbackTimes: CallbackTime[];
    message: string | null;
}

export type ConsultationStatus = 'pending' | 'contacted' | 'completed';

// 免費諮詢 Admin 資料（獨立於課程報名 Contact，不共用資料表/API）
export interface ConsultationData {
    id: number;
    name: string;
    phone: string;
    companyName: string | null;
    taxId: string | null;
    lineId: string | null;
    callbackTimes: CallbackTime[];
    message: string | null;
    status: ConsultationStatus;
    createdAt: string;
    updatedAt: string;
}

export interface ConsultationListEnvelope {
    current_page: number;
    data: ConsultationData[];
    first_page_url: string;
    from: number | null;
    last_page: number;
    last_page_url: string;
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number | null;
    total: number;
}
