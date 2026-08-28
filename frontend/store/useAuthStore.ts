import { defineStore, createPinia, setActivePinia } from 'pinia';
const pinia = createPinia();

export default { store: setActivePinia(pinia) };

export const useAuthStore = defineStore('auth', () => {
    // `tokenVersion` is a plain ref purely to give `token` a reactive dependency to
    // invalidate on — localStorage reads aren't reactive on their own, so without this,
    // `token` would compute once and never update after a later setToken() call. Using a
    // computed (rather than a plain ref holding the token itself) also means this value is
    // excluded from Pinia's SSR state serialization, so client hydration can't clobber a
    // real localStorage token with the server's always-null render-time value.
    const tokenVersion = ref(0);
    const token = computed(() => {
        tokenVersion.value;
        return process.client ? localStorage.getItem('token') : null;
    });

    const setToken = (value: string | null) => {
        if (process.client) {
            if (value) {
                localStorage.setItem('token', value);
            } else {
                localStorage.removeItem('token');
            }
        }
        tokenVersion.value++;
    };
    return {
        token,
        setToken
    };
});

