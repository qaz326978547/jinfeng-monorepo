<template>
    <h3 class="mb-4 text-center text-[30px]">輪播圖管理</h3>
    <div class="rounded-md bg-white px-4 pb-[180px] pt-4">
        <button
            class="btn bg-blue-500 p-1 text-[10px] text-white hover:opacity-90 sm:text-[16px]"
            @click="openCreateModal"
        >
            新增輪播圖
        </button>

        <ul class="pt-5">
            <li class="rounded-t-md bg-black px-1 py-2 text-white">
                <ul class="flex items-center px-3 text-center">
                    <li class="w-[15%] text-[11px] sm:text-[16px]">圖片</li>
                    <li class="w-[25%] text-[11px] sm:text-[16px]">標題</li>
                    <li class="w-[20%] text-[11px] sm:text-[16px]">連結</li>
                    <li class="w-[10%] text-[11px] sm:text-[16px]">排序</li>
                    <li class="w-[10%] text-[11px] sm:text-[16px]">狀態</li>
                    <li class="w-[20%] text-[11px] sm:text-[16px]">操作</li>
                </ul>
            </li>
            <li
                class="min-h-[70px] border border-[#999] text-center"
                v-for="row in carouselList"
                :key="row.id"
            >
                <ul class="flex items-center p-3 text-center">
                    <li class="w-[15%] break-all pe-1">
                        <img :src="row.imageUrl" :alt="row.title" class="mx-auto h-12 w-20 rounded object-cover" />
                    </li>
                    <li class="w-[25%] break-all pe-1 text-[11px] sm:text-[16px]">{{ row.title }}</li>
                    <li class="w-[20%] break-all pe-1 text-[10px] sm:text-[14px]">
                        <span v-if="row.linkType === 'none'" class="text-[#999]">無連結</span>
                        <span v-else>{{ linkTypeLabel(row.linkType) }}：{{ row.linkUrl }}</span>
                    </li>
                    <li class="w-[10%] break-all text-[11px] sm:text-[16px]">{{ row.sortOrder }}</li>
                    <li class="w-[10%] break-all text-[11px] sm:text-[16px]">
                        <button
                            class="rounded px-2 py-1 text-white"
                            :class="row.isActive ? 'bg-green-600' : 'bg-gray-400'"
                            @click="toggleActive(row)"
                        >
                            {{ row.isActive ? '啟用中' : '已下架' }}
                        </button>
                    </li>
                    <li class="flex w-[20%] flex-col items-center justify-center sm:flex-row">
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
                            @click="removeCarousel(row.id)"
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

        <p v-if="carouselList && carouselList.length === 0" class="pt-5 text-center text-[#999]">
            目前尚無輪播圖資料
        </p>
        <LoadingComponet v-if="!carouselList || isLoading" />

        <!-- 新增/編輯 Modal -->
        <div
            v-if="showModal"
            class="bg-black-opacity fixed inset-0 z-40 flex items-center justify-center overflow-y-auto p-4"
        >
            <div class="w-full max-w-[600px] rounded-md bg-white p-6">
                <h4 class="mb-4 text-[20px] font-bold">{{ editingId ? '編輯輪播圖' : '新增輪播圖' }}</h4>

                <div class="mb-4">
                    <label class="mb-1 block text-[14px] font-bold">標題</label>
                    <input v-model="form.title" type="text" class="w-full rounded border p-2" placeholder="請輸入標題" />
                </div>

                <div class="mb-4">
                    <label class="mb-1 block text-[14px] font-bold">圖片（jpg/png/webp，最大 5MB）</label>
                    <input type="file" accept="image/jpeg,image/png,image/webp" @change="onFileSelected" />
                    <img
                        v-if="previewUrl"
                        :src="previewUrl"
                        class="mt-2 h-24 w-40 rounded border object-cover"
                        alt="預覽圖"
                    />
                    <div v-if="uploadPercent !== null" class="mt-2 h-2 w-full rounded bg-gray-200">
                        <div class="h-2 rounded bg-blue-500" :style="{ width: uploadPercent + '%' }"></div>
                    </div>
                </div>

                <div class="mb-4">
                    <label class="mb-1 block text-[14px] font-bold">連結類型</label>
                    <select v-model="form.linkType" class="w-full rounded border p-2">
                        <option value="none">無連結</option>
                        <option value="internal">站內連結</option>
                        <option value="external">外部連結</option>
                    </select>
                </div>

                <div v-if="form.linkType === 'internal'" class="mb-4">
                    <label class="mb-1 block text-[14px] font-bold">站內路徑</label>
                    <select v-model="internalPathSelect" class="mb-2 w-full rounded border p-2">
                        <option v-for="opt in INTERNAL_LINK_OPTIONS" :key="opt.path" :value="opt.path">
                            {{ opt.label }}（{{ opt.path }}）
                        </option>
                        <option value="__custom__">自訂路徑…</option>
                    </select>
                    <input
                        v-if="internalPathSelect === '__custom__'"
                        v-model="form.linkUrl"
                        type="text"
                        class="w-full rounded border p-2"
                        placeholder="/自訂路徑"
                    />
                </div>

                <div v-if="form.linkType === 'external'" class="mb-4">
                    <label class="mb-1 block text-[14px] font-bold">外部網址（必須 http(s):// 開頭）</label>
                    <input
                        v-model="form.linkUrl"
                        type="text"
                        class="w-full rounded border p-2"
                        placeholder="https://example.com"
                    />
                </div>

                <div class="mb-4 flex items-center gap-4">
                    <div>
                        <label class="mb-1 block text-[14px] font-bold">排序</label>
                        <input v-model.number="form.sortOrder" type="number" class="w-24 rounded border p-2" />
                    </div>
                    <label class="mt-5 flex items-center gap-2">
                        <input v-model="form.isActive" type="checkbox" />
                        啟用
                    </label>
                </div>

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
import { CarouselAdminApi } from '@/api/carousel';
import { INTERNAL_LINK_OPTIONS } from '@/api/interface/carousel';
import type { CarouselData, CarouselLinkType, CarouselWritePayload } from '@/api/interface/carousel';
import { usePublicStore } from '@/store/usePublicStore';
import LoadingComponet from '~/components/LoadingComponet.vue';

const { isLoading } = storeToRefs(usePublicStore());
definePageMeta({
    layout: 'admin'
});
useHead({
    meta: [{ name: 'robots', content: 'noindex' }]
});

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const carouselList = ref<CarouselData[] | null>(null);
const showModal = ref(false);
const editingId = ref<number | null>(null);
const selectedFile = ref<File | null>(null);
const uploadPercent = ref<number | null>(null);
const isSubmitting = ref(false);
const formError = ref('');
const internalPathSelect = ref<string>(INTERNAL_LINK_OPTIONS[0]?.path ?? '/');

const form = reactive<{
    title: string;
    imageKey: string;
    imageUrl: string;
    linkType: CarouselLinkType;
    linkUrl: string | null;
    sortOrder: number;
    isActive: boolean;
}>({
    title: '',
    imageKey: '',
    imageUrl: '',
    linkType: 'none',
    linkUrl: null,
    sortOrder: 0,
    isActive: true
});

const previewUrl = computed(() => {
    if (selectedFile.value) {
        return URL.createObjectURL(selectedFile.value);
    }
    return form.imageUrl || null;
});

function linkTypeLabel(type: CarouselLinkType) {
    return type === 'internal' ? '站內' : type === 'external' ? '外部' : '';
}

const getCarouselData = async () => {
    isLoading.value = true;
    const res = await CarouselAdminApi.getCarouselList();
    if (res) {
        carouselList.value = res;
    }
    isLoading.value = false;
};

const removeCarousel = async (id: number) => {
    if (!window.confirm('是否確定刪除？')) {
        return;
    }
    const res = await CarouselAdminApi.deleteCarousel(id);
    if (res) {
        alert('刪除成功');
        getCarouselData();
    }
};

const toggleActive = async (row: CarouselData) => {
    const payload: CarouselWritePayload = {
        title: row.title,
        imageUrl: row.imageUrl,
        imageKey: row.imageKey,
        linkType: row.linkType,
        linkUrl: row.linkUrl,
        sortOrder: row.sortOrder,
        isActive: !row.isActive
    };
    const res = await CarouselAdminApi.updateCarousel(row.id, payload);
    if (res) {
        getCarouselData();
    }
};

function resetForm() {
    form.title = '';
    form.imageKey = '';
    form.imageUrl = '';
    form.linkType = 'none';
    form.linkUrl = null;
    form.sortOrder = (carouselList.value?.length ?? 0) + 1;
    form.isActive = true;
    selectedFile.value = null;
    uploadPercent.value = null;
    formError.value = '';
    internalPathSelect.value = INTERNAL_LINK_OPTIONS[0]?.path ?? '/';
}

function openCreateModal() {
    editingId.value = null;
    resetForm();
    showModal.value = true;
}

function openEditModal(row: CarouselData) {
    editingId.value = row.id;
    form.title = row.title;
    form.imageKey = row.imageKey;
    form.imageUrl = row.imageUrl;
    form.linkType = row.linkType;
    form.linkUrl = row.linkUrl;
    form.sortOrder = row.sortOrder;
    form.isActive = row.isActive;
    selectedFile.value = null;
    uploadPercent.value = null;
    formError.value = '';
    if (row.linkType === 'internal') {
        const preset = INTERNAL_LINK_OPTIONS.find((opt) => opt.path === row.linkUrl);
        internalPathSelect.value = preset ? preset.path : '__custom__';
    } else {
        internalPathSelect.value = INTERNAL_LINK_OPTIONS[0]?.path ?? '/';
    }
    showModal.value = true;
}

function closeModal() {
    showModal.value = false;
}

function onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    formError.value = '';

    if (!file) {
        selectedFile.value = null;
        return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
        formError.value = '只允許 jpg、png、webp 格式的圖片';
        input.value = '';
        return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        formError.value = '圖片大小不可超過 5MB';
        input.value = '';
        return;
    }
    selectedFile.value = file;
}

// linkType 為 internal 時，把下拉選單（含「自訂路徑」）的選擇同步回 form.linkUrl
watch(internalPathSelect, (value) => {
    if (form.linkType === 'internal' && value !== '__custom__') {
        form.linkUrl = value;
    }
});
watch(
    () => form.linkType,
    (type) => {
        if (type === 'internal') {
            form.linkUrl = internalPathSelect.value === '__custom__' ? form.linkUrl : internalPathSelect.value;
        } else if (type === 'none') {
            form.linkUrl = null;
        } else if (type === 'external' && (!form.linkUrl || form.linkUrl.startsWith('/'))) {
            form.linkUrl = '';
        }
    }
);

function validateForm(): string {
    if (!form.title.trim()) {
        return 'title 為必填欄位';
    }
    if (!editingId.value && !selectedFile.value) {
        return '請選擇要上傳的圖片';
    }
    if (form.linkType === 'external' && !/^https?:\/\//i.test(form.linkUrl ?? '')) {
        return '外部連結必須是 http(s):// 開頭的網址';
    }
    if (form.linkType === 'internal' && !(form.linkUrl ?? '').startsWith('/')) {
        return '站內連結必須是 / 開頭的路徑';
    }
    if (!Number.isInteger(form.sortOrder)) {
        return '排序必須為整數';
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
        let imageKey = form.imageKey;
        let imageUrl = form.imageUrl;

        if (selectedFile.value) {
            const uploadUrlResult = await CarouselAdminApi.requestUploadUrl(selectedFile.value);
            if (!uploadUrlResult) {
                return;
            }
            uploadPercent.value = 0;
            const uploaded = await CarouselAdminApi.uploadImageToS3(
                uploadUrlResult.uploadUrl,
                selectedFile.value,
                (percent) => (uploadPercent.value = percent)
            );
            if (!uploaded) {
                formError.value = '圖片上傳失敗，請稍後再試';
                return;
            }
            imageKey = uploadUrlResult.imageKey;
            imageUrl = uploadUrlResult.imageUrl;
        }

        const payload: CarouselWritePayload = {
            title: form.title.trim(),
            imageUrl,
            imageKey,
            linkType: form.linkType,
            linkUrl: form.linkType === 'none' ? null : form.linkUrl,
            sortOrder: form.sortOrder,
            isActive: form.isActive
        };

        const res = editingId.value
            ? await CarouselAdminApi.updateCarousel(editingId.value, payload)
            : await CarouselAdminApi.addCarousel(payload);

        if (res) {
            alert(editingId.value ? '更新成功' : '新增成功');
            closeModal();
            getCarouselData();
        }
    } finally {
        isSubmitting.value = false;
        uploadPercent.value = null;
    }
}

onMounted(() => {
    getCarouselData();
});
</script>
