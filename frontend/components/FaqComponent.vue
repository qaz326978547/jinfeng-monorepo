<template>
    <ul class="mt-16" v-if="faqData">
        <li v-for="(item, i) in faqData" :key="item.id" class="mb-16 pl-[40px] sm:pl-[60px]">
            <div
                v-if="item.info"
                @click="toggle(i)"
                class="relative cursor-pointer rounded-r-[50px] border-2 border-black py-8 pe-[50px] ps-[20px] text-[24px] font-bold transition-all duration-300 ease-in-out sm:ps-[60px] sm:text-[30px]"
            >
                <h2>{{ item.name }}</h2>
                <div
                    class="absolute left-[-60px] top-[-40px] h-[75px] w-[80px] bg-qa-icon-red bg-contain sm:h-[117px] sm:w-[125px]"
                >
                    <span class="flex items-center justify-center text-[40px] font-bold text-white sm:text-[65px]">{{
                        i + 1
                    }}</span>
                </div>
                <Icon
                    :name="isOpen[i] ? 'teenyicons:up-solid' : 'teenyicons:down-solid'"
                    width="30"
                    height="30"
                    class="absolute right-[30px] top-1/2 -translate-y-1/2 transform text-[30px] text-primary transition-all duration-300 ease-in-out"
                />
            </div>
            <div
                v-if="isOpen[i]"
                class="mt-4 min-h-[80px] rounded pl-0 transition-all duration-300 ease-in-out sm:pl-[100px]"
                :style="{ height: isOpen[i] ? 'auto' : '0' }"
                style="overflow: hidden"
            >
                <p class="pe-[50px] text-[20px]" v-html="item.info"></p>
            </div>
        </li>
    </ul>
</template>

<script setup lang="ts">
import type { FAQData } from '@/api/interface/signedUpClass';
import { usePublicStore } from '@/store/usePublicStore';

const { apiBaseUrl } = storeToRefs(usePublicStore());

const {
    data: faqData,
    refresh,
    error
} = await useFetch<FAQData[]>('/faq', {
    method: 'GET',
    baseURL: apiBaseUrl.value,
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    }
});

// FAQPage schema 僅在有真實問答資料時才輸出，避免產生空殼結構化資料
const faqSchema = buildFaqPageSchema(faqData.value ?? undefined);
if (faqSchema) {
    useSchemaOrg(faqSchema);
}

const isOpen = reactive(faqData.value ? Array(faqData.value.length).fill(false) : []);

const toggle = (i: any) => {
    isOpen[i] = !isOpen[i];
};
</script>

