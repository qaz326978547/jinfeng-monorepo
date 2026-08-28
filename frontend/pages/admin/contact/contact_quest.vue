<template>
    <h3 class="mb-4 text-center text-[30px]">FAQ 管理</h3>
    <div class="rounded-md bg-white px-4 pb-[180px] pt-4">
        <nuxt-link to="/admin/contact/faq/create_faq">
            <button class="btn bg-blue-500 p-1 text-[10px] text-white hover:opacity-90 sm:text-[16px]">
                新增 FAQ
            </button>
        </nuxt-link>
        <ul class="pt-5">
            <li class="rounded-t-md bg-black px-1 py-2 text-white">
                <ul class="flex items-center px-3 text-center">
                    <li class="w-[45%] text-[11px] sm:text-[16px]">問題</li>
                    <li class="w-[30%] text-[11px] sm:text-[16px]">回答</li>
                    <li class="w-[10%] text-[11px] sm:text-[16px]">排序</li>
                    <li class="w-[15%] text-[11px] sm:text-[16px]">操作</li>
                </ul>
            </li>
            <!-- 內容表單 -->
            <li class="min-h-[50px] border border-[#999] text-center" v-for="data in faqData" :key="data.id">
                <ul class="flex items-center p-3 text-center">
                    <li class="w-[45%] break-all pe-1 text-[11px] sm:text-[16px]">
                        {{ data.name }}
                    </li>
                    <li class="w-[30%] break-all pe-1 text-[11px] sm:text-[16px]">
                        {{ stripHtml(data.info) }}
                    </li>
                    <li class="w-[10%] break-all text-[11px] sm:text-[16px]">
                        <input
                            class="w-full"
                            type="text"
                            v-model="data.no"
                            @change="updateFaqNo(data)"
                        />
                    </li>
                    <li class="flex w-[15%] flex-col items-center justify-center sm:flex-row">
                        <nuxt-link :to="`/admin/contact/faq/${data.id}`">
                            <button class="btn m-1 bg-gradient-left p-1 text-[10px] hover:opacity-90 sm:text-[16px]">
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 576 512">
                                    <path
                                        fill="white"
                                        d="m402.3 344.9l32-32c5-5 13.7-1.5 13.7 5.7V464c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V112c0-26.5 21.5-48 48-48h273.5c7.1 0 10.7 8.6 5.7 13.7l-32 32c-1.5 1.5-3.5 2.3-5.7 2.3H48v352h352V350.5c0-2.1.8-4.1 2.3-5.6m156.6-201.8L296.3 405.7l-90.4 10c-26.2 2.9-48.5-19.2-45.6-45.6l10-90.4L432.9 17.1c22.9-22.9 59.9-22.9 82.7 0l43.2 43.2c22.9 22.9 22.9 60 .1 82.8M460.1 174L402 115.9L216.2 301.8l-7.3 65.3l65.3-7.3zm64.8-79.7l-43.2-43.2c-4.1-4.1-10.8-4.1-14.8 0L436 82l58.1 58.1l30.9-30.9c4-4.2 4-10.8-.1-14.9"
                                    />
                                </svg>
                            </button>
                        </nuxt-link>
                        <button
                            class="btn bg-primary p-1 text-[10px] hover:opacity-90 sm:text-[16px]"
                            @click="deleteFaqData(data.id)"
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

        <p v-if="faqData && faqData.length === 0" class="pt-5 text-center text-[#999]">目前尚無 FAQ 資料</p>
        <LoadingComponet v-if="!faqData || isLoading" />
    </div>
</template>

<script setup lang="ts">
import { FAQInfoApi } from '@/api/faq';
import { usePublicStore } from '@/store/usePublicStore';
import type { FAQData } from '@/api/interface/signedUpClass';
import LoadingComponet from '~/components/LoadingComponet.vue';

const { isLoading } = storeToRefs(usePublicStore());
definePageMeta({
    layout: 'admin'
});
useHead({
    meta: [{ name: 'robots', content: 'noindex' }]
});

const faqData = ref<FAQData[] | null>(null);

// info 是公開頁面用 v-html 渲染的富文本（見 FaqComponent.vue），這裡的列表只是
// 給管理者快速預覽用途，去除標籤顯示純文字即可——編輯用的 textarea 仍是原始 HTML。
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');

const getFaqData = async () => {
    isLoading.value = true;
    const res = await FAQInfoApi.getFaqList();
    if (res) {
        faqData.value = res;
    }
    isLoading.value = false;
};

const deleteFaqData = async (id: number) => {
    if (!window.confirm('是否確定刪除？')) {
        return;
    }
    const res = await FAQInfoApi.deleteFaq(id);
    if (res) {
        getFaqData();
    }
};

const updateFaqNo = async (data: FAQData) => {
    isLoading.value = true;
    const res = await FAQInfoApi.updateFaq(data.id, {
        name: data.name,
        info: data.info,
        no: Number(data.no)
    });
    if (res) {
        getFaqData();
    }
    isLoading.value = false;
};

onMounted(() => {
    getFaqData();
});
</script>
