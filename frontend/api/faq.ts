import { $http, asyncDo, isResponseOK } from '@/utils/http';
import type { AddContactInfo, ContactData, ContactClassData } from './interface/signedUpClass';

export namespace FAQInfoApi {
    /**
     * 這邊準備給後台使用 post
     */
    export async function getContact(data: {
        /**
         * 頁數 (一頁10筆)
         */
        page: number;
    }) {
        const [err, result] = await asyncDo($http<ContactData>('get', '/admin/faq', data));
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }
}

