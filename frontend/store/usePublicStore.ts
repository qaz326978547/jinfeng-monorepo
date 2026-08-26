import { defineStore, createPinia, setActivePinia } from 'pinia';
const pinia = createPinia();

export default { store: setActivePinia(pinia) };

export const usePublicStore = defineStore('public', () => {
    // Lazily evaluated (computed only runs its getter on first .value access) — safe to
    // create this store from anywhere, including module top-level (see utils/http.ts),
    // because useRuntimeConfig() itself is never called until something actually reads
    // apiBaseUrl.value, which in practice only happens from real component/composable
    // context (a page's script setup, or an axios interceptor firing on a real request).
    const apiBaseUrl = computed(() => `${useRuntimeConfig().public.apiBaseUrl}/api/v2`);

    const isLoading = ref(false);
    return {
        apiBaseUrl,
        isLoading
    };
});

