<template>
  <div class="min-h-screen bg-slate-50">
    <!-- About Us Section -->
    <section id="about" class="py-20 bg-slate-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p class="text-blue-900 font-bold text-base uppercase tracking-wider mb-2">
              About Us
            </p>
            <h1 class="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
              關於金豐集團
            </h1>
            <p class="text-slate-600 mb-6 leading-relaxed">
              企業在經營管理上所面臨最大的難題,乃在於公司內部人員的勞動法務管理、規章制度的建立以及衍生的人事成本控制。
            </p>
            <p class="text-slate-600 mb-8 leading-relaxed">
              金豐集團為協助兩岸企業,提供勞動法相關的專業諮詢以及顧問協助,幫助企業在勞動法務管理上,降低人事成本及勞資爭議並創造勞資雙贏、提升企業整體競爭力。
            </p>

            <div class="space-y-4 border-l-4 border-amber-400 pl-6">
              <div class="relative">
                <span class="font-bold text-blue-900">1995年</span>
                <p class="text-slate-700">成立 金豐企業管理顧問股份有限公司</p>
              </div>
              <div class="relative">
                <span class="font-bold text-blue-900">2005年</span>
                <p class="text-slate-700">成立 上海善緣企業管理諮詢有限公司</p>
              </div>
              <div class="relative">
                <span class="font-bold text-blue-900">2007年</span>
                <p class="text-slate-700">成立 金豐企業管理諮詢顧問(昆山)有限公司</p>
              </div>
              <div class="relative">
                <span class="font-bold text-blue-900">2015年</span>
                <p class="text-slate-700">成立 善緣(廈門)勞資管理有限公司</p>
              </div>
            </div>
          </div>
          <div class="relative">
            <div class="bg-white p-4 rounded-2xl shadow-xl">
              <img
                src="~/assets/img/Certification.webp"
                alt="金豐集團專業認證證書 - 企業管理顧問資格認證"
                class="w-full h-auto rounded-lg object-cover"
                loading="eager"
                width="800"
                height="1200"
              />
              <p class="text-center text-sm text-slate-500 mt-4">專業認證,值得信賴</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Why Choose Us -->
    <section id="why-us" class="py-20 bg-blue-900 text-white relative overflow-hidden">
      <div
        class="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-blue-700 opacity-20 blur-3xl"
      ></div>
      <div
        class="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-amber-600 opacity-10 blur-3xl"
      ></div>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <p class="text-amber-400 font-bold text-base uppercase tracking-wider mb-2">
          Why Us
        </p>
        <h2 class="text-3xl md:text-4xl font-bold mb-12">我們的優勢</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div class="bg-white/10 p-8 rounded-2xl border border-white/20">
            <Icon name="tabler:circle-check" class="text-amber-400 mb-4 h-8 w-8" />
            <h3 class="text-xl font-bold mb-2">專業團隊陣容</h3>
            <p class="text-blue-100">豐富實務經驗與專業知識,幫助您掌握重要議題。</p>
          </div>
          <div class="bg-white/10 p-8 rounded-2xl border border-white/20">
            <Icon name="tabler:circle-check" class="text-amber-400 mb-4 h-8 w-8" />
            <h3 class="text-xl font-bold mb-2">實用落地內容</h3>
            <p class="text-blue-100">課程設計貼近實際,直接應用於工作現場。</p>
          </div>
          <div class="bg-white/10 p-8 rounded-2xl border border-white/20">
            <Icon name="tabler:circle-check" class="text-amber-400 mb-4 h-8 w-8" />
            <h3 class="text-xl font-bold mb-2">顧客滿意保證</h3>
            <p class="text-blue-100">重視反饋,持續改進,確保您的收穫。</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "default",
});

// SEO 優化：title / description / canonical / OG / Twitter Card 集中由 usePageSeo 處理
usePageSeo({
  title: "關於金豐集團 - 專業勞動法務管理顧問 | 兩岸企業勞資爭議解決專家",
  description:
    "金豐集團成立於1995年，專注提供兩岸企業勞動法務管理諮詢服務。協助企業降低人事成本、預防勞資爭議，創造勞資雙贏。服務涵蓋台灣、上海、昆山、廈門等地。",
  path: "/about",
  image: "https://d1vjl2px6hqzku.cloudfront.net/Certification.webp",
});

// Organization schema 已於 layouts/default.vue 全站輸出一次，此頁僅補充導覽路徑
useSchemaOrg(
  buildBreadcrumbSchema([
    { name: "首頁", path: "/" },
    { name: "關於我們", path: "/about" },
  ])
);
</script>
