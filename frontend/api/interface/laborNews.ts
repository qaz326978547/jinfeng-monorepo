// 前台使用（GET /labor-news 只回傳實際需要的欄位，不含 isActive/createdAt/updatedAt）
export interface PublicLaborNewsData {
    id: number;
    title: string;
    sourceName: string;
    sourceUrl: string;
    publishedAt: string;
    sortOrder: number;
}

// GET /labor-news 回傳的 Laravel 風格分頁 envelope（與 ContactData 同一套慣例，
// 見 signedUpClass.ts::ContactData），data 換成 PublicLaborNewsData[]。
export interface LaborNewsListData {
    current_page: number;
    data: PublicLaborNewsData[];
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

// 後台管理使用（GET/POST/PUT /admin/labor-news）
export interface LaborNewsData extends PublicLaborNewsData {
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// GET /admin/labor-news 回傳的分頁 envelope，data 換成 LaborNewsData[]
export interface AdminLaborNewsListData {
    current_page: number;
    data: LaborNewsData[];
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

// sourceUrl 必須 http(s):// 開頭；publishedAt 為 YYYY-MM-DD；sortOrder 數字越小顯示越前面，
// 不需唯一（後端以 publishedAt DESC、id DESC 當作 tie-break）。
export interface LaborNewsWritePayload {
    title: string;
    sourceName: string;
    sourceUrl: string;
    publishedAt: string;
    sortOrder: number;
    isActive: boolean;
}
