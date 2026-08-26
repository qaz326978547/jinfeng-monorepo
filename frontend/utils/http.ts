import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse, Method } from 'axios'; // 引入类型声明
import { usePublicStore } from '@/store/usePublicStore';
// 封装 Axios 请求
const { apiBaseUrl, isLoading } = storeToRefs(usePublicStore());
const ajax = axios.create({
    baseURL: apiBaseUrl.value,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    },
    timeout: 60000 // 超时设置
});

// Read the token fresh from localStorage on every request instead of baking it into the
// axios instance's static headers at module-eval time — otherwise a login that happens
// after this module first loads would never be reflected in later requests (the instance's
// headers object was already built with whatever token existed at that moment, usually none).
ajax.interceptors.request.use((config) => {
    if (process.client) {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers = config.headers ?? {};
            config.headers.Authorization = `Bearer ${token}`;
        } else if (config.headers) {
            delete config.headers.Authorization;
        }
    }
    return config;
});

// 用于客户端请求的封装函数
export async function clientFetch<T = any>(method: AxiosRequestConfig['method'], url: string, data?: any): Promise<T> {
    const response = await ajax.request<T>({
        method,
        url,
        data
    });
    return response.data;
}

export async function $http<T = any>(method: Method, url: string, ...payload: any[]): Promise<T> {
    const requestData: AxiosRequestConfig = { url, method };

    if (method == 'get' || method == 'GET') {
        requestData.params = payload[0];
    } else {
        requestData.data = payload[0];
        requestData.params = payload[1];
    }

    try {
        isLoading.value = true;
        const response = await ajax.request(requestData);
        return response.data;
    } catch (err: any) {
        if (err.response) {
            throw err.response;
        }
        throw err;
    } finally {
        isLoading.value = false;
    }
}

export function asyncDo<T, E = any>(promise: Promise<T>): Promise<[undefined, T] | [E, undefined]> {
    return promise.then<[undefined, T]>((res) => [undefined, res]).catch((err) => [err, undefined]);
}

// Module-scoped so a burst of concurrent requests that all 401 at once (e.g. several
// admin API calls firing on page load with an expired token) only alerts/redirects once,
// instead of once per failed request.
let authFailureAlertShown = false;

function handleAuthFailure() {
    if (!process.client) return;
    // Never treat a 401 on the login page itself (e.g. wrong credentials on
    // POST /auth/login) as a "session expired" event — that's just a failed login
    // attempt, and redirecting to /auth while already there would be a no-op at best
    // and a misleading "session expired" alert at worst.
    if (window.location.pathname === '/auth') return;
    localStorage.removeItem('token');
    if (!authFailureAlertShown) {
        authFailureAlertShown = true;
        alert('登入已過期，請重新登入');
    }
    navigateTo('/auth');
}

export function isResponseOK(err: any, result: any) {
    if (err && !result) {
        console.warn(err, result);
        if (err.status == 401) {
            handleAuthFailure();
            return false;
        }
        if (err.status == 403) {
            alert('權限不足');
        }
        if (err.status == 404) {
            alert('找不到資源');
        }
        if (err.status == 500) {
            alert('伺服器錯誤');
        }
        if (err.status == 503) {
            alert('服務暫時無法使用');
        }
        return false;
    }
    return true;
}

