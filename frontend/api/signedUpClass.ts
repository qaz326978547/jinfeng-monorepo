import { $http, asyncDo, isResponseOK } from '@/utils/http';
import type {
    AddContactInfo,
    AddContactResponse,
    ContactData,
    ContactClassData,
    ContactClass,
    ContactListData
} from './interface/signedUpClass';

// 報名課程公司資訊
export namespace SignedUpClassInfoApi {
    /**
     * 取得報名課程公司資訊
     */
    export async function getContact(data: {
        /**
         * 頁數 (一頁10筆)
         */
        page: number;
    }) {
        const [err, result] = await asyncDo($http<ContactData>('get', '/admin/contact', data));
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }

    /**
     * 取得 單筆 報名課程公司資訊
     */
    export async function getSingleContact(id: number) {
        const [err, result] = await asyncDo($http<ContactListData>('get', `/admin/contact/${id}`));
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }

    /**
     * 新增報名課程公司資訊
     *
     * idempotencyKey：同一筆報名（內容相同）重送時沿用同一個值，後端會回傳第一次建立的報名，
     * 不會重複寫入或重寄通知信。只要回 201 就代表報名已成功寫入，
     * 即使 notification 是 "failed"（只影響寄給管理者的通知信）。
     * 失敗時回傳 { failed: true, status }，status 為 undefined 代表沒收到回應（網路／逾時）。
     */
    export async function addContactInfo(
        data: AddContactInfo | null,
        idempotencyKey?: string
    ): Promise<AddContactResponse | { failed: true; status?: number }> {
        const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined;
        const [err, result] = await asyncDo(
            $http<AddContactResponse>('post', 'contact', data, undefined, headers)
        );
        if (!isResponseOK(err, result)) {
            // isResponseOK 已針對 401/403/404/500/503 跳過提示，這裡只補其餘狀態的訊息
            if (![401, 403, 404, 500, 503].includes(err?.status)) {
                alert(
                    err?.data?.message ??
                        '網路連線異常，請確認網路後再按一次送出（同一筆報名重送不會重複建立）'
                );
            }
            return { failed: true, status: err?.status };
        }
        return result as AddContactResponse;
    }

    /**
     * 更新報名課程公司資訊
     */
    export async function updateContactInfo(data: AddContactInfo) {
        const [err, result] = await asyncDo($http<any>('put', 'admin/contact', data));
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }

    /**
     * 刪除報名公司資訊
     */
    export async function deleteContactInfo(ids: { ids: number | number[] }) {
        const [err, result] = await asyncDo($http<any>('delete', 'admin/contact', ids));
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }

    /**
     *  搜尋報名公司名稱
     */
    export async function searchContactInfo(data: { 'company': string }) {
        const [err, result] = await asyncDo($http<ContactData>('get', '/admin/contact/search/search-company', data));
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }

    // class 課程資訊
    /**
     * 取得報名課程資訊
     */
    export async function getContactClass() {
        const [err, result] = await asyncDo($http<ContactClass[]>('get', '/contact-class'));
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }

    /**
     * 取得單筆報名課程資訊
     */
    export async function getSingleContactClass(id: number) {
        const [err, result] = await asyncDo($http<ContactClass>('get', `/admin/contact-class/${id}`));
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }

    /**
     * 新增報名課程資訊
     */
    export async function addContactClass(data: { 'name': string; 'no': number }) {
        const [err, result] = await asyncDo($http<ContactClass>('post', '/admin/contact-class', data));
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }

    /**
     *
     *  刪除 報名課程資訊
     */
    export async function deleteSingleContactClass(ids: { ids: number | number[] }) {
        const [err, result] = await asyncDo($http<ContactClass>('delete', `/admin/contact-class`, ids));
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }

    /**
     *
     * 更改 報名課程資訊
     */
    export async function UpdateContactClass(id: number, data: { 'name': string; 'no': number }) {
        const [err, result] = await asyncDo($http<ContactClass>('put', `/admin/contact-class/${id}`, data));
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }
}

// {{host}}/api/v2/auth/login
// {{host}}/api/v2/auth/register
// {{host}}/api/v2/admin/contact
// {{host}}/api/v2/contact/1
// {{host}}/api/v2/admin/contact-list
// {{host}}/api/v2/admin/contact-list/1
// export API

