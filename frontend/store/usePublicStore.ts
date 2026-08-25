import { defineStore, createPinia, setActivePinia } from 'pinia';
const pinia = createPinia();

export default { store: setActivePinia(pinia) };

export const usePublicStore = defineStore('public', () => {
    const apiBaseUrl = computed(
        () =>
            `${process.env.NODE_ENV === 'production' ? process.env.NUXT_API_BASE_URL : 'http://127.0.0.1:9001'}/api/v2`
    );

    const isLoading = ref(false);
    return {
        apiBaseUrl,
        isLoading
    };
});

