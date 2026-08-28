export default defineEventHandler((event) => {
    try {
        if (process.env.NODE_ENV !== 'production') return;

        const url = event.node.req.url?.toLowerCase() || '';
        const allowedPatterns = [
            '/',
            '/_nuxt',
            '/favicon.ico',
            '/robots.txt',
            '/sitemap.xml',
            '/api',
            '/assets',
            '/.well-known',
            '/admin'  // 允許合法的 admin 路由
        ];
        const isAllowed = allowedPatterns.some((pattern) => url.startsWith(pattern));
        if (isAllowed) return;

        const badPatterns = ['.php', '/wp-', '/wp', '/cgi-bin/', '/include/'];
        const isMalicious = badPatterns.some((pattern) => url.includes(pattern));

        if (isMalicious) {
            console.warn(`[BLOCKED] ${url}`);
            event.node.res.statusCode = 403;
            event.node.res.end('Forbidden: suspicious path');
        }
    } catch (err) {
        console.error('[blockBadPaths middleware] error:', err);
    }
});

