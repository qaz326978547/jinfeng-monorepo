<template>
    <div class="pt-[70px] lg:pt-[100px]">
        <div>
            <HeaderComponent />
            <slot />
        </div>
        <FooterComponent />
    </div>
    <NuxtLoadingIndicator :throttle="0" />
    <FixedIcon />
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import FixedIcon from '~/components/FixedIcon.vue';
import type { SeoData } from '@/api/interface/seo';
import { usePublicStore } from '@/store/usePublicStore';

const { apiBaseUrl } = storeToRefs(usePublicStore());

// 获取 SEO 数据
const {
    data: SeoData,
    refresh,
    error
} = await useFetch<SeoData[]>('/seo', {
    method: 'GET',
    baseURL: apiBaseUrl.value,
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    }
});

// 僅在後台 API 有回傳資料時才提供預設 description，且用 useSeoMeta 確保與各頁面自訂的
// description 正確去重（各頁面的 usePageSeo 會在此之後執行並覆蓋預設值，不會產生重複 meta 標籤）
if (SeoData.value?.[0]?.description) {
    useSeoMeta({
        description: SeoData.value[0].description,
        ogDescription: SeoData.value[0].description
    });
}
if (SeoData.value?.[0]?.keyword) {
    useHead({
        meta: [{ name: 'keywords', content: SeoData.value[0].keyword }]
    });
}

// 全站共用 Organization 結構化資料，僅在此輸出一次，各頁不再重複宣告。
// WebSite 節點由 nuxt-schema-org 依 nuxt.config 的 site 設定自動產生，此處不再手動重複輸出。
useSchemaOrg(buildOrganizationSchema());

// const options: NuxtFacebookChatOptions = {
//   pageId: "104937349349639",  // Your Facebook Page ID
//   locale: "th_TH",            // Set the locale for the chat
//   themeColor: "#E04040",      // Customize the chat theme color
//   elementId: 'fb-customer-chat', // 可選，聊天元素的ID,

// };

// onMounted(() => {
//     var chatbox = document.getElementById('fb-customer-chat');
//     if (chatbox) {
//         chatbox.setAttribute('page_id', '104937349349639');
//         chatbox.setAttribute('attribution', 'biz_inbox');
//     }
// });
</script>

