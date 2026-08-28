<template>
  <div class="min-h-screen">
    <!-- FAQ Section -->
    <section id="faq" class="py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <p class="text-blue-900 font-bold text-base uppercase tracking-wider mb-2">FAQ</p>
          <h1 class="text-3xl md:text-4xl font-bold text-slate-900">常見問題</h1>
          <p class="mt-4 max-w-2xl mx-auto text-slate-600 leading-relaxed">
            以下整理企業老闆、人資主管與管理者最常詢問的勞資爭議、勞動契約與勞基法相關問題，協助您快速掌握重點；實際情況仍應依個案及最新法規判斷。
          </p>
        </div>
        <img
          class="w-full max-w-4xl mx-auto mb-8"
          src="~/assets/img/qa.webp"
          alt="勞資常見大哉問"
          loading="eager"
          width="1180"
          height="380"
        />
        <FaqComponent></FaqComponent>
        <img
          class="w-full max-w-4xl mx-auto mt-8"
          src="~/assets/img/qa-2.webp"
          alt="參加本講座後，以上勞資疑惑將得到解答"
          loading="lazy"
          width="1180"
          height="429"
        />
      </div>
    </section>
  </div>
  <LoadingComponet v-if="pending"></LoadingComponet>
</template>

<script setup lang="ts">
import type { ContactClass } from "@/api/interface/signedUpClass";
import { usePublicStore } from "@/store/usePublicStore";
import LoadingComponet from "~/components/LoadingComponet.vue";

const { apiBaseUrl } = storeToRefs(usePublicStore());

definePageMeta({
  layout: "default",
});

//SSR
const { data: faqData, refresh, error, pending } = await useFetch<ContactClass[]>(
  "/faq",
  {
    method: "GET",
    baseURL: apiBaseUrl.value,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  }
);

// SEO 優化：title / description / canonical / OG / Twitter Card 集中由 usePageSeo 處理
usePageSeo({
  title: "常見問題 FAQ - 勞資爭議、勞動法規疑問解答 | 金豐集團",
  description:
    "提供勞資爭議、勞動契約、加班費、資遣費、職業災害、工時規定等常見問題解答。金豐集團專業勞動法務顧問團隊，解答企業主與人資最關心的勞動法規疑問，協助企業避免勞資糾紛。",
  path: "/faq",
  image: "https://d1vjl2px6hqzku.cloudfront.net/qa.webp",
});

// FAQPage schema 已由 FaqComponent 依真實問答資料輸出，此頁僅補充導覽路徑
useSchemaOrg(
  buildBreadcrumbSchema([
    { name: "首頁", path: "/" },
    { name: "常見問題", path: "/faq" },
  ])
);
</script>
