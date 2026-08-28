import { $http, asyncDo, isResponseOK } from '@/utils/http';
import type {
    AddContactInfo,
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
     */
    export async function addContactInfo(data: AddContactInfo | null) {
        const [err, result] = await asyncDo($http<any>('post', 'contact', data));
        if (!isResponseOK(err, result)) {
            alert(err.data.message);
            return false;
        }
        return result;
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

