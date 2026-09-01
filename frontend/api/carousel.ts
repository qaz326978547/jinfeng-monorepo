import { $http, asyncDo, isResponseOK } from '@/utils/http';
import type { CarouselData, CarouselWritePayload, UploadUrlResponse } from './interface/carousel';

// 後台輪播圖管理
export namespace CarouselAdminApi {
    /**
     * 取得所有輪播圖（後台管理用，含未啟用）
     */
    export async function getCarouselList() {
        const [err, result] = await asyncDo($http<{ data: CarouselData[] }>('get', '/admin/carousels'));
        if (!isResponseOK(err, result)) {
            return false;
        }
        return result.data;
    }

    /**
     * 新增輪播圖
     */
    export async function addCarousel(data: CarouselWritePayload) {
        const [err, result] = await asyncDo(
            $http<{ message: string; data: CarouselData }>('post', '/admin/carousels', data)
        );
        if (!isResponseOK(err, result)) {
            alert(err.data?.message ?? '新增失敗');
            return false;
        }
        return result.data;
    }

    /**
     * 更新輪播圖
     */
    export async function updateCarousel(id: number, data: CarouselWritePayload) {
        const [err, result] = await asyncDo(
            $http<{ message: string; data: CarouselData }>('put', `/admin/carousels/${id}`, data)
        );
        if (!isResponseOK(err, result)) {
            alert(err.data?.message ?? '更新失敗');
            return false;
        }
        return result.data;
    }

    /**
     * 刪除輪播圖（單筆）
     */
    export async function deleteCarousel(id: number) {
        const [err, result] = await asyncDo($http<{ message: string }>('delete', `/admin/carousels/${id}`));
        if (!isResponseOK(err, result)) {
            alert(err.data?.message ?? '刪除失敗');
            return false;
        }
        return result;
    }

    /**
     * 取得圖片上傳用的 S3 Presigned URL
     */
    export async function requestUploadUrl(file: File) {
        const [err, result] = await asyncDo(
            $http<UploadUrlResponse>('post', '/admin/carousels/upload-url', {
                fileName: file.name,
                contentType: file.type,
                fileSize: file.size
            })
        );
        if (!isResponseOK(err, result)) {
            alert(err.data?.message ?? '取得上傳網址失敗');
            return false;
        }
        return result;
    }

    /**
     * 將圖片檔案直接 PUT 到 S3 的 presigned URL。
     * 刻意不透過 utils/http.ts 的 ajax instance —— 那個 instance 的攔截器會自動加上
     * baseURL（我們自己 API 的網址）和 Authorization（我們自己的 JWT），
     * 兩者對直接打 S3 的請求都是錯的，必須用乾淨的 fetch。
     */
    export async function uploadImageToS3(
        uploadUrl: string,
        file: File,
        onProgress?: (percent: number) => void
    ): Promise<boolean> {
        return new Promise((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', uploadUrl, true);
            xhr.setRequestHeader('Content-Type', file.type);

            xhr.upload.onprogress = (event) => {
                if (onProgress && event.lengthComputable) {
                    onProgress(Math.round((event.loaded / event.total) * 100));
                }
            };

            xhr.onload = () => {
                resolve(xhr.status >= 200 && xhr.status < 300);
            };
            xhr.onerror = () => resolve(false);
            xhr.send(file);
        });
    }
}
