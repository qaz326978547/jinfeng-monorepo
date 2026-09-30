<template>
    <h3 class="mb-4 text-center text-[30px]">免費諮詢資料</h3>
    <div class="rounded-md bg-white px-4 pb-[180px] pt-4">
        <ul class="pt-5">
            <li class="hidden rounded-t-md bg-black px-1 py-2 text-white sm:block">
                <ul class="flex items-center px-3 text-center">
                    <li class="w-[12%] text-[11px] sm:text-[16px]">姓名</li>
                    <li class="w-[12%] text-[11px] sm:text-[16px]">聯絡電話</li>
                    <li class="w-[14%] text-[11px] sm:text-[16px]">公司名稱</li>
                    <li class="w-[10%] text-[11px] sm:text-[16px]">LINE ID</li>
                    <li class="w-[18%] text-[11px] sm:text-[16px]">方便回電時間</li>
                    <li class="w-[12%] text-[11px] sm:text-[16px]">問題概述</li>
                    <li class="w-[10%] text-[11px] sm:text-[16px]">提交時間</li>
                    <li class="w-[12%] min-w-[88px] text-[11px] sm:text-[16px]">狀態</li>
                </ul>
            </li>
            <!-- 內容表單 -->
            <li
                class="mb-3 min-h-[50px] rounded-md border border-[#999] text-center sm:mb-0 sm:rounded-none"
                v-for="data in consultationData?.data"
                :key="data.id"
            >
                <!-- 手機版：卡片式，全部資訊完整顯示 -->
                <div class="space-y-2 p-3 text-left sm:hidden">
                    <p class="break-all text-[16px] font-bold">{{ data.name }}</p>
                    <dl class="space-y-1 text-[13px]">
                        <div class="flex gap-2 my-3">
                            <dt class="w-14 shrink-0 text-slate-500">電話</dt>
                            <dd>
                                <a :href="`tel:${data.phone}`" class="break-all text-blue-600 underline">
                                    {{ data.phone }}
                                </a>
                            </dd>
                        </div>
                        <div v-if="data.companyName || data.taxId" class="flex gap-2">
                            <dt class="w-14 shrink-0 text-slate-500">公司</dt>
                            <dd class="break-all">
                                {{ data.companyName || '-' }}<span v-if="data.taxId">（統編 {{ data.taxId }}）</span>
                            </dd>
                        </div>
                        <div v-if="data.lineId" class="flex gap-2">
                            <dt class="w-14 shrink-0 text-slate-500">LINE</dt>
                            <dd class="break-all">{{ data.lineId }}</dd>
                        </div>
                        <div class="flex gap-2">
                            <dt class="w-14 shrink-0 text-slate-500">回電</dt>
                            <dd>
                                <span
                                    v-for="time in data.callbackTimes"
                                    :key="time"
                                    class="mb-1 mr-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[12px] text-blue-900"
                                >
                                    {{ callbackTimeLabel(time) }}
                                </span>
                            </dd>
                        </div>
                        <div v-if="data.message" class="flex gap-2">
                            <dt class="w-14 shrink-0 text-slate-500">問題</dt>
                            <dd class="whitespace-pre-wrap break-all">{{ data.message }}</dd>
                        </div>
                        <div class="flex gap-2 text-slate-500">
                            <dt class="w-14 shrink-0">時間</dt>
                            <dd>{{ data.createdAt }}</dd>
                        </div>
                    </dl>
                    <label class="block pt-1">
                        <span class="mb-1 block text-[13px] font-bold text-slate-700">處理狀態（點擊可變更）</span>
                        <select
                            :value="data.status"
                            @change="onStatusChange(data, ($event.target as HTMLSelectElement).value as ConsultationStatus)"
                            class="block w-1/2 rounded-md border-2 px-3 py-3 text-[16px] font-bold"
                            :class="statusClass(data.status)"
                        >
                            <option value="pending">未處理</option>
                            <option value="contacted">已聯絡</option>
                            <option value="completed">已完成</option>
                        </select>
                    </label>
                </div>
                <!-- 桌機版：表格列 -->
                <ul class="hidden items-center p-3 text-center sm:flex">
                    <li class="w-[12%] break-all px-1 text-[11px] sm:text-[16px]">{{ data.name }}</li>
                    <li class="w-[12%] break-all px-1 text-[11px] sm:text-[16px]">{{ data.phone }}</li>
                    <li class="w-[14%] break-all px-1 text-[11px] sm:text-[16px]">{{ data.companyName || '-' }}</li>
                    <li class="w-[10%] break-all px-1 text-[11px] sm:text-[16px]">{{ data.lineId || '-' }}</li>
                    <li class="w-[18%] px-1 text-[11px] sm:text-[16px]">
                        <span
                            v-for="time in data.callbackTimes"
                            :key="time"
                            class="mb-1 mr-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-900 sm:text-[12px]"
                        >
                            {{ callbackTimeLabel(time) }}
                        </span>
                    </li>
                    <li class="w-[12%] break-all px-1 text-[10px] sm:text-[14px]" :title="data.message || ''">
                        {{ truncatedMessage(data.message) }}
                    </li>
                    <li class="w-[10%] break-all px-1 text-[10px] sm:text-[14px]">{{ data.createdAt }}</li>
                    <li class="w-[12%] min-w-[88px] px-1">
                        <select
                            :value="data.status"
                            @change="onStatusChange(data, ($event.target as HTMLSelectElement).value as ConsultationStatus)"
                            class="w-full min-w-[80px] rounded border border-slate-300  text-[12px] sm:text-[14px]"
                        >
                            <option value="pending">未處理</option>
                            <option value="contacted">已聯絡</option>
                            <option value="completed">已完成</option>
                        </select>
                    </li>
                </ul>
            </li>
        </ul>
        <!-- 分頁 -->
        <div class="flex justify-center mt-5">
            <button
                class="mx-1 rounded border bg-blue-500 text-white hover:bg-blue-700"
                @click="currentPage--"
                :disabled="!consultationData?.prev_page_url"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24">
                    <path
                        fill="white"
                        d="M7.94 13.06a1.5 1.5 0 0 1 0-2.12l5.656-5.658a1.5 1.5 0 1 1 2.121 2.122L11.122 12l4.596 4.596a1.5 1.5 0 1 1-2.12 2.122l-5.66-5.658Z"
                    />
                </svg>
            </button>
            <div
                class="mx-1 rounded border px-2 py-1"
                v-for="page in displayedPages"
                :key="page"
                :class="{ 'bg-blue-500 text-white': page === consultationData?.current_page }"
                @click="currentPage = page"
            >
                {{ page }}
            </div>
            <button
                class="mx-1 rounded border bg-blue-500 text-white hover:bg-blue-700"
                @click="currentPage++"
                :disabled="!consultationData?.next_page_url"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24">
                    <path
                        fill="white"
                        d="M16.06 10.94a1.5 1.5 0 0 1 0 2.12l-5.656 5.658a1.5 1.5 0 1 1-2.121-2.122L12.879 12L8.283 7.404a1.5 1.5 0 0 1 2.12-2.122l5.658 5.657Z"
                    />
                </svg>
            </button>
        </div>
        <LoadingComponet v-if="!consultationData || isLoading" />
    </div>
</template>

<script setup lang="ts">
import { ConsultationAdminApi } from '@/api/consultation';
import { CALLBACK_TIME_OPTIONS, type CallbackTime, type ConsultationListEnvelope, type ConsultationData, type ConsultationStatus } from '@/api/interface/consultation';
import { usePublicStore } from '@/store/usePublicStore';
import LoadingComponet from '~/components/LoadingComponet.vue';

const { isLoading } = storeToRefs(usePublicStore());

definePageMeta({
    layout: 'admin'
});
useHead({
    meta: [{ name: 'robots', content: 'noindex' }]
});

const currentPage = ref(1);
const consultationData = ref<ConsultationListEnvelope | null>(null);

const displayedPages = computed(() => {
    const startPage = Math.max(1, currentPage.value - 3);
    const endPage = Math.min(consultationData.value?.last_page || 1, startPage + 5);
    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
});

function callbackTimeLabel(value: CallbackTime) {
    return CALLBACK_TIME_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function statusClass(status: ConsultationStatus) {
    return {
        pending: 'border-red-500 bg-red-50 text-red-700',
        contacted: 'border-amber-500 bg-amber-50 text-amber-700',
        completed: 'border-green-600 bg-green-50 text-green-700'
    }[status];
}

function truncatedMessage(message: string | null) {
    if (!message) return '-';
    return message.length > 20 ? `${message.slice(0, 20)}...` : message;
}

const getConsultationData = async () => {
    isLoading.value = true;
    const res = await ConsultationAdminApi.getConsultations(currentPage.value);
    if (res) {
        consultationData.value = res;
    }
    isLoading.value = false;
};

async function onStatusChange(row: ConsultationData, status: ConsultationStatus) {
    const res = await ConsultationAdminApi.updateConsultationStatus(row.id, status);
    if (res && consultationData.value) {
        const updated = res.data;
        consultationData.value.data = consultationData.value.data.map((item) =>
            item.id === updated.id ? updated : item
        );
    }
}

watch(currentPage, getConsultationData);

onMounted(() => {
    getConsultationData();
});
</script>
