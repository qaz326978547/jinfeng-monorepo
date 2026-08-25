export default defineNuxtRouteMiddleware((to) => {
    const badKeywords = ['.php', '/wp-', '/wp', '/cgi-bin/', '/include/'];
    
    // 允許合法的 admin 路由
    const isLegitimateAdminRoute = to.path.startsWith('/admin');
    
    if (isLegitimateAdminRoute) {
        return; // 允許通過
    }

    const isMalicious = badKeywords.some((kw) => to.path.toLowerCase().includes(kw));
    if (isMalicious) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden route.'
        });
    }
});

