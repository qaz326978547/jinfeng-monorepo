import { $http, asyncDo, isResponseOK } from '@/utils/http';
import type { ConsultationCreatePayload, ConsultationData, ConsultationListEnvelope, ConsultationStatus } from './interface/consultation';

// 免費諮詢（獨立於課程報名 SignedUpClassInfoApi，不共用資料來源）
export namespace ConsultationApi {
    /**
     * 送出首頁「聯絡我們／免費諮詢」表單。
     * 刻意回傳 [err, result]（不預先 unwrap），讓表單元件自行決定成功/失敗訊息，
     * 而非沿用其他表單的 alert() 慣例。
     */
    export async function submitConsultation(data: ConsultationCreatePayload) {
        return asyncDo($http<{ message: string; data: ConsultationData }>('post', 'consultations', data));
    }
}

export namespace ConsultationAdminApi {
    export async function getConsultations(page: number) {
        const [err, result] = await asyncDo($http<ConsultationListEnvelope>('get', '/admin/consultations', { page }));
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }

    export async function updateConsultationStatus(id: number, status: ConsultationStatus) {
        const [err, result] = await asyncDo(
            $http<{ message: string; data: ConsultationData }>('patch', `/admin/consultations/${id}`, { status })
        );
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result;
    }
}
