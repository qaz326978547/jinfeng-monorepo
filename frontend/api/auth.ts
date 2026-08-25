import { $http, asyncDo, isResponseOK } from '@/utils/http';
import { useAuthStore } from '@/store/useAuthStore';

const { token } = storeToRefs(useAuthStore());
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
        const [err, result] = await asyncDo($http<any>('post', '/auth/register'));
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
        if (process.client) {
            localStorage.setItem('token', result.token);
        }

        return result;
    }
}

