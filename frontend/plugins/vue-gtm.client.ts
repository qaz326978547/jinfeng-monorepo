import { createGtm } from '@gtm-support/vue-gtm';
import type { Router } from 'vue-router';

export default defineNuxtPlugin((nuxtApp) => {
    const router = nuxtApp.$router as Router;
    const gtmId = import.meta.env.VITE_GTM_ID;

    if (!gtmId) {
        console.error('❌ [GTM] VITE_GTM_ID is not defined in .env!');
        return;
    }

    nuxtApp.vueApp.use(
        createGtm({
            id: gtmId,
            enabled: true,
            debug: true,
            defer: false,
            loadScript: true,
            compatibility: false,
            trackOnNextTick: false,
            vueRouter: router
        })
    );
});

