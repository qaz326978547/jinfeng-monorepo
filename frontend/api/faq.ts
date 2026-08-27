import { $http, asyncDo, isResponseOK } from '@/utils/http';
import type { FAQData } from './interface/signedUpClass';

// 後台 FAQ 管理
export namespace FAQInfoApi {
    /**
     * 取得所有 FAQ（後台管理用，未分頁）
     */
    export async function getFaqList() {
        const [err, result] = await asyncDo($http<{ data: FAQData[] }>('get', '/admin/faq'));
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result.data;
    }

    /**
     * 新增 FAQ
     */
    export async function addFaq(data: { name: string; info: string; no: number }) {
        const [err, result] = await asyncDo(
            $http<{ message: string; data: FAQData }>('post', '/admin/faq', data)
        );
        if (!isResponseOK(err, result)) {
            alert(err.data?.message ?? '新增失敗');
            return false;
        }
        return result.data;
    }

    /**
     * 更新 FAQ
     */
    export async function updateFaq(id: number, data: { name: string; info: string; no: number }) {
        const [err, result] = await asyncDo(
            $http<{ message: string; data: FAQData }>('put', `/admin/faq/${id}`, data)
        );
        if (!isResponseOK(err, result)) {
            alert(err.data?.message ?? '更新失敗');
            return false;
        }
        return result.data;
    }

    /**
     * 刪除 FAQ（單筆或批次）
     */
    export async function deleteFaq(ids: number | number[]) {
        const [err, result] = await asyncDo(
            $http<{ message: string }>('delete', '/admin/faq', { ids })
        );
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }
}
