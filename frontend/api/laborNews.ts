import { $http, asyncDo, isResponseOK } from '@/utils/http';
import type {
    AdminLaborNewsListData,
    LaborNewsData,
    LaborNewsListData,
    LaborNewsWritePayload
} from './interface/laborNews';

// 前台：勞資 News
export namespace LaborNewsApi {
    /**
     * 取得啟用中的勞資 News（分頁、可搜尋）。首頁用 pageSize=5，/labor-news 列表頁用 pageSize=10。
     */
    export async function getLaborNewsList(params: { page: number; pageSize: number; keyword?: string }) {
        const [err, result] = await asyncDo(
            $http<LaborNewsListData>('get', '/labor-news', params)
        );
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }
}

// 後台：勞資 News 管理
export namespace LaborNewsAdminApi {
    /**
     * 取得所有勞資 News（後台管理用，含未啟用，分頁）
     */
    export async function getLaborNewsList(params: { page: number }) {
        const [err, result] = await asyncDo(
            $http<AdminLaborNewsListData>('get', '/admin/labor-news', params)
        );
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }

    /**
     * 新增勞資 News
     */
    export async function addLaborNews(data: LaborNewsWritePayload) {
        const [err, result] = await asyncDo(
            $http<{ message: string; data: LaborNewsData }>('post', '/admin/labor-news', data)
        );
        if (!isResponseOK(err, result)) {
            alert(err.data?.message ?? '新增失敗');
            return false;
        }
        return result.data;
    }

    /**
     * 更新勞資 News（含排序 sortOrder）
     */
    export async function updateLaborNews(id: number, data: LaborNewsWritePayload) {
        const [err, result] = await asyncDo(
            $http<{ message: string; data: LaborNewsData }>('put', `/admin/labor-news/${id}`, data)
        );
        if (!isResponseOK(err, result)) {
            alert(err.data?.message ?? '更新失敗');
            return false;
        }
        return result.data;
    }

    /**
     * 刪除勞資 News（單筆）
     */
    export async function deleteLaborNews(id: number) {
        const [err, result] = await asyncDo($http<{ message: string }>('delete', `/admin/labor-news/${id}`));
        if (!isResponseOK(err, result)) {
            alert(err.data?.message ?? '刪除失敗');
            return false;
        }
        return result;
    }
}
