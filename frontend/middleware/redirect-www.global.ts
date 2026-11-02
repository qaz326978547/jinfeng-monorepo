// middleware/redirect-www.global.ts
import { productionRedirectUrl } from '~/utils/production-host';

export default defineNuxtRouteMiddleware(() => {
    if (process.env.NODE_ENV !== 'production') return;

    if (import.meta.server) {
        const headers = useRequestHeaders();
        const url = useRequestURL();
        const protocol = Array.isArray(headers['x-forwarded-proto'])
            ? headers['x-forwarded-proto'][0]
            : headers['x-forwarded-proto'];

        // 只處理正式網域：www → 主網域、http → https。目的地固定，不用 Host 標頭組網址。
        const redirectUrl = productionRedirectUrl(headers.host, protocol, url.pathname, url.search);
        if (redirectUrl) {
            // 換主機名稱對 Nuxt 來說是外部網址，沒有 external: true 會直接丟錯回 500
            // （正式站 www.* 的非首頁曾因此全部 500）。
            return navigateTo(redirectUrl, { redirectCode: 301, external: true });
        }
    }
});
