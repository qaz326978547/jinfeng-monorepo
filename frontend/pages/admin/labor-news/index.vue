<template>
    <h3 class="mb-4 text-center text-[30px]">勞資 News 管理</h3>
    <div class="rounded-md bg-white px-4 pb-[180px] pt-4">
        <button
            class="btn bg-blue-500 p-1 text-[10px] text-white hover:opacity-90 sm:text-[16px]"
            @click="openCreateModal"
        >
            新增新聞
        </button>

        <ul class="pt-5">
            <li class="rounded-t-md bg-black px-1 py-2 text-white">
                <ul class="flex items-center px-3 text-center">
                    <li class="w-[10%] text-[11px] sm:text-[16px]">排序</li>
                    <li class="w-[15%] text-[11px] sm:text-[16px]">發布日期</li>
                    <li class="w-[15%] text-[11px] sm:text-[16px]">來源</li>
                    <li class="w-[35%] text-[11px] sm:text-[16px]">標題</li>
                    <li class="w-[10%] text-[11px] sm:text-[16px]">狀態</li>
                    <li class="w-[15%] text-[11px] sm:text-[16px]">操作</li>
                </ul>
            </li>
            <li
                class="min-h-[70px] border border-[#999] text-center"
                v-for="row in laborNewsData?.data"
                :key="row.id"
            >
                <ul class="flex items-center p-3 text-center">
                    <li class="w-[10%] break-all text-[11px] sm:text-[16px]">{{ row.sortOrder }}</li>
                    <li class="w-[15%] break-all text-[11px] sm:text-[16px]">{{ row.publishedAt }}</li>
                    <li class="w-[15%] break-all pe-1 text-[11px] sm:text-[16px]">{{ row.sourceName }}</li>
                    <li class="w-[35%] break-all pe-1 text-left text-[11px] sm:text-[16px]">{{ row.title }}</li>
                    <li class="w-[10%] break-all text-[11px] sm:text-[16px]">
                        <button
                            class="rounded px-2 py-1 text-white"
                            :class="row.isActive ? 'bg-green-600' : 'bg-gray-400'"
                            @click="toggleActive(row)"
                        >
                            {{ row.isActive ? '啟用中' : '已下架' }}
                        </button>
                    </li>
                    <li class="flex w-[15%] flex-col items-center justify-center sm:flex-row">
                        <button
                            class="btn m-1 bg-gradient-left p-1 text-[10px] hover:opacity-90 sm:text-[16px]"
                            @click="openEditModal(row)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 576 512">
                                <path
                                    fill="white"
                                    d="m402.3 344.9l32-32c5-5 13.7-1.5 13.7 5.7V464c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V112c0-26.5 21.5-48 48-48h273.5c7.1 0 10.7 8.6 5.7 13.7l-32 32c-1.5 1.5-3.5 2.3-5.7 2.3H48v352h352V350.5c0-2.1.8-4.1 2.3-5.6m156.6-201.8L296.3 405.7l-90.4 10c-26.2 2.9-48.5-19.2-45.6-45.6l10-90.4L432.9 17.1c22.9-22.9 59.9-22.9 82.7 0l43.2 43.2c22.9 22.9 22.9 60 .1 82.8M460.1 174L402 115.9L216.2 301.8l-7.3 65.3l65.3-7.3zm64.8-79.7l-43.2-43.2c-4.1-4.1-10.8-4.1-14.8 0L436 82l58.1 58.1l30.9-30.9c4-4.2 4-10.8-.1-14.9"
                                />
                            </svg>
                        </button>
                        <button
                            class="btn bg-primary p-1 text-[10px] hover:opacity-90 sm:text-[16px]"
                            @click="removeLaborNews(row.id)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 2048 2048">
                                <path
                                    fill="white"
                                    d="M1792 384h-128v1472q0 40-15 75t-41 61t-61 41t-75 15H448q-40 0-75-15t-61-41t-41-61t-15-75V384H128V256h512V128q0-27 10-50t27-40t41-28t50-10h384q27 0 50 10t40 27t28 41t10 50v128h512zM768 256h384V128H768zm768 128H384v1472q0 26 19 45t45 19h1024q26 0 45-19t19-45zM768 1664H640V640h128zm256 0H896V640h128zm256 0h-128V640h128z"
                                />
                            </svg>
                        </button>
                    </li>
                </ul>
            </li>
        </ul>

        <p v-if="laborNewsData && laborNewsData.data.length === 0" class="pt-5 text-center text-[#999]">
            目前尚無勞資 News 資料
        </p>
        <LoadingComponet v-if="!laborNewsData || isLoading" />

        <!-- 分頁 -->
        <div v-if="laborNewsData && laborNewsData.last_page > 1" class="flex justify-center pt-5">
            <button
                class="mx-1 rounded border bg-blue-500 px-3 py-1 text-white hover:bg-blue-700"
                @click="currentPage--"
                :disabled="!laborNewsData?.prev_page_url"
            >
                上一頁
            </button>
            <div
                class="mx-1 cursor-pointer rounded border px-3 py-1"
                v-for="page in displayedPages"
                :key="page"
                :class="{ 'bg-blue-500 text-white': page === laborNewsData?.current_page }"
                @click="currentPage = page"
            >
                {{ page }}
            </div>
            <button
                class="mx-1 rounded border bg-blue-500 px-3 py-1 text-white hover:bg-blue-700"
                @click="currentPage++"
                :disabled="!laborNewsData?.next_page_url"
            >
                下一頁
            </button>
        </div>

        <!-- 新增/編輯 Modal -->
        <div
            v-if="showModal"
            class="bg-black-opacity fixed inset-0 z-40 flex items-center justify-center overflow-y-auto p-4"
        >
            <div class="w-full max-w-[560px] max-h-[650px] overflow-auto rounded-md bg-white p-6">
                <h4 class="mb-4 text-[20px] font-bold">{{ editingId ? '編輯新聞' : '新增新聞' }}</h4>

                <div class="mb-4">
                    <label class="mb-1 block text-[14px] font-bold">新聞標題 *</label>
                    <input v-model="form.title" type="text" class="w-full rounded border p-2" placeholder="請輸入新聞標題" />
                </div>

                <div class="mb-4">
                    <label class="mb-1 block text-[14px] font-bold">新聞來源 *</label>
                    <input v-model="form.sourceName" type="text" class="w-full rounded border p-2" placeholder="例如：中國時報" />
                </div>

                <div class="mb-4">
                    <label class="mb-1 block text-[14px] font-bold">新聞網址 *</label>
                    <input v-model="form.sourceUrl" type="text" class="w-full rounded border p-2" placeholder="https://example.com/news/..." />
                </div>

                <div class="mb-4 flex items-center gap-4">
                    <div>
                        <label class="mb-1 block text-[14px] font-bold">發布日期 *</label>
                        <input v-model="form.publishedAt" type="date" class="rounded border p-2" />
                    </div>
                    <div>
                        <label class="mb-1 block text-[14px] font-bold">排序 *</label>
                        <input v-model.number="form.sortOrder" type="number" min="0" step="1" class="w-24 rounded border p-2" />
                        <p class="mt-1 text-[11px] text-[#999]">數字越小，顯示越前面</p>
                    </div>
                </div>

                <label class="mb-4 flex items-center gap-2">
                    <input v-model="form.isActive" type="checkbox" />
                    啟用
                </label>

                <p v-if="formError" class="mb-4 text-[14px] text-red-600">{{ formError }}</p>

                <div class="flex justify-end gap-2">
                    <button class="btn bg-gray-400 p-2 text-white hover:opacity-90" @click="closeModal">取消</button>
                    <button
                        class="btn bg-blue-500 p-2 text-white hover:opacity-90"
                        :disabled="isSubmitting"
                        @click="submitForm"
                    >
                        {{ isSubmitting ? '處理中...' : '儲存' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { LaborNewsAdminApi } from '@/api/laborNews';
import type { AdminLaborNewsListData, LaborNewsData, LaborNewsWritePayload } from '@/api/interface/laborNews';
import { usePublicStore } from '@/store/usePublicStore';
import LoadingComponet from '~/components/LoadingComponet.vue';

const { isLoading } = storeToRefs(usePublicStore());
definePageMeta({
    layout: 'admin'
});
useHead({
    meta: [{ name: 'robots', content: 'noindex' }]
});

const laborNewsData = ref<AdminLaborNewsListData | null>(null);
const currentPage = ref(1);
const showModal = ref(false);
const editingId = ref<number | null>(null);
const isSubmitting = ref(false);
const formError = ref('');

const displayedPages = computed(() => {
    const startPage = Math.max(1, currentPage.value - 3);
    const endPage = Math.min(laborNewsData.value?.last_page || 1, startPage + 5);
    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
});

const form = reactive<LaborNewsWritePayload>({
    title: '',
    sourceName: '',
    sourceUrl: '',
    publishedAt: '',
    sortOrder: 0,
    isActive: true
});

const getLaborNewsData = async () => {
    isLoading.value = true;
    const res = await LaborNewsAdminApi.getLaborNewsList({ page: currentPage.value });
    if (res) {
        laborNewsData.value = res;
    }
    isLoading.value = false;
};

const removeLaborNews = async (id: number) => {
    if (!window.confirm('是否確定刪除？')) {
        return;
    }
    const res = await LaborNewsAdminApi.deleteLaborNews(id);
    if (res) {
        alert('刪除成功');
        getLaborNewsData();
    }
};

const toggleActive = async (row: LaborNewsData) => {
    const payload: LaborNewsWritePayload = {
        title: row.title,
        sourceName: row.sourceName,
        sourceUrl: row.sourceUrl,
        publishedAt: row.publishedAt,
        sortOrder: row.sortOrder,
        isActive: !row.isActive
    };
    const res = await LaborNewsAdminApi.updateLaborNews(row.id, payload);
    if (res) {
        getLaborNewsData();
    }
};

function resetForm() {
    form.title = '';
    form.sourceName = '';
    form.sourceUrl = '';
    form.publishedAt = '';
    form.sortOrder = 0;
    form.isActive = true;
    formError.value = '';
}

function openCreateModal() {
    editingId.value = null;
    resetForm();
    showModal.value = true;
}

function openEditModal(row: LaborNewsData) {
    editingId.value = row.id;
    form.title = row.title;
    form.sourceName = row.sourceName;
    form.sourceUrl = row.sourceUrl;
    form.publishedAt = row.publishedAt;
    form.sortOrder = row.sortOrder;
    form.isActive = row.isActive;
    formError.value = '';
    showModal.value = true;
}

function closeModal() {
    showModal.value = false;
}

function isValidDateOnly(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function validateForm(): string {
    if (!form.title.trim()) {
        return '新聞標題為必填欄位';
    }
    if (!form.sourceName.trim()) {
        return '新聞來源為必填欄位';
    }
    if (!/^https?:\/\//i.test(form.sourceUrl.trim())) {
        return '新聞網址必須是 http(s):// 開頭的網址';
    }
    if (!isValidDateOnly(form.publishedAt)) {
        return '發布日期必須為有效日期';
    }
    if (!Number.isInteger(form.sortOrder) || form.sortOrder < 0) {
        return '排序必須為 0 或正整數';
    }
    return '';
}

async function submitForm() {
    const error = validateForm();
    if (error) {
        formError.value = error;
        return;
    }

    isSubmitting.value = true;
    formError.value = '';

    try {
        const payload: LaborNewsWritePayload = {
            title: form.title.trim(),
            sourceName: form.sourceName.trim(),
            sourceUrl: form.sourceUrl.trim(),
            publishedAt: form.publishedAt,
            sortOrder: form.sortOrder,
            isActive: form.isActive
        };

        const res = editingId.value
            ? await LaborNewsAdminApi.updateLaborNews(editingId.value, payload)
            : await LaborNewsAdminApi.addLaborNews(payload);

        if (res) {
            alert(editingId.value ? '更新成功' : '新增成功');
            closeModal();
            getLaborNewsData();
        }
    } finally {
        isSubmitting.value = false;
    }
}

watch(currentPage, getLaborNewsData);

onMounted(() => {
    getLaborNewsData();
});
</script>
