import { defineStore, createPinia, setActivePinia } from 'pinia';
const pinia = createPinia();

export default { store: setActivePinia(pinia) };

export const useAuthStore = defineStore('auth', () => {
    const token = computed(() => (process.client ? localStorage.getItem('token') : ''));

    const setToken = (value: string | null) => {
        if (process.client) {
            if (value) {
                localStorage.setItem('token', value);
            } else {
                localStorage.removeItem('token');
            }
        }
    };
    return {
        token,
        setToken
    };
});

