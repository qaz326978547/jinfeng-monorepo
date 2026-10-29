// 正式網域固定寫在程式裡，不讀環境變數：設錯 NUXT_PUBLIC_SITE_URL 也不會讓演練站變成可索引，
// 轉址目的地也不會被 Host 標頭帶走。換網域時要改這裡。
// 這個檔案不能用 Nuxt 的 auto-import（server middleware 和 tests/ 都直接 import 它）。
export const PRODUCTION_HOST = 'laborservice5690.com';
const PRODUCTION_WWW_HOST = `www.${PRODUCTION_HOST}`;

/** 小寫、去掉 port 和結尾的點：`WWW.Example.com.:443` → `www.example.com` */
export function normalizeHost(host: string | undefined | null): string {
    return (host ?? '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

/** 只有正式主網域和它的 www 可以被索引；其他主機名稱（含相似網域）一律不行。 */
export function isIndexableHost(host: string | undefined | null): boolean {
    const normalized = normalizeHost(host);
    return normalized === PRODUCTION_HOST || normalized === PRODUCTION_WWW_HOST;
}

/**
 * 正式網域的 www 或 http 請求要轉去的網址；不需要轉址時回傳 null。
 * 目的地固定是 https://PRODUCTION_HOST，只帶上原本的路徑和 query，避免開放轉址。
 * 其他主機名稱（DO／Zeabur 預設網址、本機）不轉址。
 */
export function productionRedirectUrl(
    host: string | undefined | null,
    forwardedProto: string | undefined | null,
    pathname: string,
    search: string
): string | null {
    const normalized = normalizeHost(host);
    if (normalized !== PRODUCTION_HOST && normalized !== PRODUCTION_WWW_HOST) return null;

    const proto = (forwardedProto ?? '').split(',')[0].trim().toLowerCase();
    if (normalized === PRODUCTION_HOST && proto !== 'http') return null;

    const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
    return `https://${PRODUCTION_HOST}${path}${search}`;
}
