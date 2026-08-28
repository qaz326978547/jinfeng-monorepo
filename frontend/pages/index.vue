<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Hero Section (Carousel) -->
    <header
      id="hero"
      class="relative bg-blue-900 pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden min-h-[600px] flex items-center"
    >
      <!-- Background Slides -->
      <div
        :class="`absolute inset-0 transition-opacity duration-1000 ${
          currentHeroSlide === 0 ? 'opacity-20' : 'opacity-0'
        }`"
      >
        <svg
          class="h-full w-full bg-blue-800"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path d="M0 100 L100 0 L100 100 Z" fill="#1e3a8a" />
        </svg>
      </div>
      <div
        :class="`absolute inset-0 transition-opacity duration-1000 ${
          currentHeroSlide === 1 ? 'opacity-20' : 'opacity-0'
        }`"
      >
        <svg
          class="h-full w-full bg-indigo-900"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <circle cx="50" cy="50" r="40" fill="#312e81" />
        </svg>
      </div>
      <div
        :class="`absolute inset-0 transition-opacity duration-1000 ${
          currentHeroSlide === 2 ? 'opacity-20' : 'opacity-0'
        }`"
      >
        <svg
          class="h-full w-full bg-slate-800"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <rect x="20" y="20" width="60" height="60" fill="#1e293b" />
        </svg>
      </div>

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <div class="max-w-4xl mx-auto">
          <h1
            class="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 drop-shadow-lg"
          >
            勞動法務速成講座 <br />
            <span class="text-amber-400">預防 90% 勞資爭議</span>
          </h1>
          <p class="text-xl text-blue-100 mb-10 leading-relaxed max-w-2xl mx-auto">
            協助兩岸企業降低人事成本,創造勞資雙贏,提升企業整體競爭力。
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#register"
              class="inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-bold rounded-lg text-blue-900 bg-amber-400 hover:bg-amber-500 transition duration-300 shadow-lg transform hover:scale-105"
            >
              立即報名講座
              <Icon name="tabler:arrow-right" class="ml-2 h-5 w-5" />
            </a>
            <a
              href="#services"
              class="inline-flex items-center justify-center px-8 py-4 border border-white text-lg font-medium rounded-lg text-white hover:bg-white hover:bg-opacity-10 transition duration-300"
            >
              了解服務項目
            </a>
          </div>
        </div>

        <!-- Carousel Indicators -->
        <div class="flex justify-center mt-12 space-x-2">
          <button
            v-for="index in 3"
            :key="index"
            @click="currentHeroSlide = index - 1"
            :class="`w-3 h-3 rounded-full transition-all ${
              currentHeroSlide === index - 1 ? 'bg-amber-400 w-6' : 'bg-white/50'
            }`"
          />
        </div>
      </div>
    </header>

    <!-- Services Section -->
    <section id="services" class="py-20 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <p class="text-blue-900 font-bold text-base uppercase tracking-wider mb-2">
            Our Services
          </p>
          <h2 class="text-3xl md:text-4xl font-bold text-slate-900">10 大專業服務項目</h2>
          <div class="w-20 h-1 bg-amber-500 mx-auto mt-4 rounded-full"></div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div
            v-for="(service, index) in services"
            :key="index"
            class="bg-slate-50 p-6 rounded-xl border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition duration-300 group"
          >
            <div
              class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-900 transition duration-300"
            >
              <Icon
                :name="service.icon"
                class="text-2xl text-blue-900 group-hover:text-white transition duration-300"
              />
            </div>
            <h3 class="text-lg font-bold text-slate-900 mb-2">{{ service.title }}</h3>
            <p class="text-sm text-slate-600 leading-relaxed">{{ service.desc }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
  <SignUpClassForm />
</template>

<script setup lang="ts">
import { usePublicStore } from "@/store/usePublicStore";

const { apiBaseUrl } = storeToRefs(usePublicStore());

definePageMeta({
  layout: "default",
});

// SEO 優化：title / description / canonical / OG / Twitter Card 集中由 usePageSeo 處理
usePageSeo({
  title: "勞資爭議與勞資糾紛講座｜企業勞基法課程－勞資我來教你",
  description:
    "專為企業老闆、人資主管與管理者設計的勞資爭議講座，解析勞動契約、加班費、資遣費、職業災害、勞動檢查及勞資糾紛預防，協助企業降低勞動法令風險。",
  path: "/",
});

// Hero Carousel State
const currentHeroSlide = ref(0);

// Services Data
const services = [
  {
    icon: "tabler:file-text",
    title: "量身訂做勞動契約",
    desc: "依據企業屬性,制定合規且完善的勞動契約。",
  },
  {
    icon: "tabler:book",
    title: "客製化工作規則並協助送審",
    desc: "建立明確管理制度,並協助完成政府核備程序。",
  },
  {
    icon: "tabler:calculator",
    title: "薪資結構調整",
    desc: "優化薪資設計,符合法規並兼顧經營成本。",
  },
  {
    icon: "tabler:shield-check",
    title: "職業災害風險轉嫁規劃",
    desc: "完善的保險規劃,降低企業職災賠償風險。",
  },
  {
    icon: "tabler:user-check",
    title: "規劃人才留根計畫",
    desc: "設計激勵機制,留住核心人才,降低流動率。",
  },
  {
    icon: "tabler:users",
    title: "協助成立勞資會議",
    desc: "輔導召開勞資會議,促進雙方溝通與和諧。",
  },
  {
    icon: "tabler:gavel",
    title: "勞資爭議處理",
    desc: "專業協調與法律諮詢,快速解決勞資糾紛。",
  },
  {
    icon: "tabler:alert-circle",
    title: "工作場所性騷擾防治",
    desc: "協助訂立防治措施,建立友善職場環境。",
  },
  {
    icon: "tabler:cloud",
    title: "專利雲端打卡系統",
    desc: "數位化出勤管理,精準紀錄工時,避免爭議。",
  },
  {
    icon: "tabler:briefcase",
    title: "勞動檢查預防及處理",
    desc: "模擬勞檢實況,協助企業提前改善缺失。",
  },
];

// Hero Carousel Auto-play
onMounted(() => {
  const timer = setInterval(() => {
    currentHeroSlide.value = (currentHeroSlide.value + 1) % 3;
  }, 5000);

  onUnmounted(() => clearInterval(timer));
});
</script>

<style scoped>
[style*="display: none"] {
  height: 0 !important;
}

[style*="display: block"] {
  height: auto !important;
}
</style>
