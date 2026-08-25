export default defineNuxtRouteMiddleware((to) => {
    if (import.meta.server) return;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
        event: 'Pageview',
        pagePath: to.fullPath,
        pageTitle: document.title
    });
    console.log('[GTM] Pageview:', to.fullPath);
});

