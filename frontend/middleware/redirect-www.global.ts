// middleware/redirect-www.global.ts

export default defineNuxtRouteMiddleware(() => {
    if (process.env.NODE_ENV !== 'production') return;

    if (import.meta.server) {
        const headers = useRequestHeaders();
        const url = useRequestURL();
        const host = headers.host;

        if (!host) return;

        const isWWW = host.startsWith('www.');
        const protocol = Array.isArray(headers['x-forwarded-proto'])
            ? headers['x-forwarded-proto'][0]
            : headers['x-forwarded-proto'];
        const isHTTP = protocol === 'http';

        if (isWWW || isHTTP) {
            const cleanHost = host.replace(/^www\./, '');
            const redirectUrl = `https://${cleanHost}${url.pathname}${url.search}`;
            return navigateTo(redirectUrl, { redirectCode: 301 });
        }
    }
});

