import { $http, asyncDo, isResponseOK } from '@/utils/http';

export namespace AuthApi {
    /**
     * 註冊
     */
    export async function register(data: {
        /**
         * 名字
         */
        name: string;
        /**
         * 電子郵件
         */
        email: string;
        /**
         * 密碼
         */
        password: string;
        /**
         * 確認密碼
         */
        password_confirmation: string;
        /**
         *  是否為最高權限
         */
        is_admin?: boolean;
    }) {
        const [err, result] = await asyncDo($http<any>('post', '/auth/register', data));
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }
    /**
     * 登入
     */
    export async function login(data: {
        /**
         * 電子郵件
         */
        email: string;
        /**
         * 密碼
         */
        password: string;
    }) {
        const [err, result] = await asyncDo($http<{ token: string }>('post', '/auth/login', data));
        if (!isResponseOK(err, result)) {
            return null;
        }
        if (!result) return null;
        // Token persistence goes through useAuthStore().setToken() at the call site —
        // localStorage is the single source of truth, written from exactly one place.
        return result;
    }

    /**
     * 登出
     */
    export async function logout() {
        // Stateless JWT (specs/backend/laravel-to-node-parity.md §10.9/§10.11): the
        // server doesn't invalidate anything, so a failed request here (network error,
        // already-expired token, etc.) must never block the client-side logout — the
        // caller always clears localStorage itself regardless of this outcome.
        try {
            await $http<{ message: string }>('post', '/auth/logout');
        } catch {
            // intentionally ignored — see comment above
        }
    }
}

