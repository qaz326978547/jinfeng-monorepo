<template>
  <div class="min-h-screen">
    <section id="labor-news" class="py-20">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <p class="text-blue-900 font-bold text-base uppercase tracking-wider mb-2">News</p>
          <h1 class="text-3xl md:text-4xl font-bold text-slate-900">勞資 News</h1>
          <p class="mt-4 max-w-2xl mx-auto text-slate-600 leading-relaxed">
            彙整近期勞資爭議、勞動法規相關新聞報導，協助企業掌握最新趨勢，提前預防勞資糾紛。
          </p>
        </div>

        <!-- 搜尋 -->
        <div class="flex items-center justify-center mb-10 gap-2">
          <input
            v-model="keywordInput"
            type="text"
            placeholder="搜尋新聞標題或來源"
            class="w-full max-w-md rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900"
            @keyup.enter="handleSearch"
          />
          <button
            class="rounded-lg bg-blue-900 px-5 py-2 text-white font-medium hover:bg-blue-800 transition duration-300"
            @click="handleSearch"
          >
            搜尋
          </button>
        </div>

        <!-- Loading -->
        <div v-if="pending" class="py-16 text-center text-slate-500">載入中...</div>

        <!-- Error -->
        <div v-else-if="loadError" class="py-16 text-center">
          <p class="text-red-600 mb-4">新聞載入失敗，請稍後再試。</p>
          <button
            class="rounded-lg border border-blue-900 px-5 py-2 text-blue-900 font-medium hover:bg-blue-900 hover:text-white transition duration-300"
            @click="fetchList()"
          >
            重新載入
          </button>
        </div>

        <!-- Empty -->
        <div v-else-if="newsList.length === 0" class="py-16 text-center text-slate-500">
          目前尚無相關新聞{{ appliedKeyword ? "（找不到符合「" + appliedKeyword + "」的結果）" : "" }}
        </div>

        <!-- List -->
        <ul v-else class="divide-y divide-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
          <li v-for="item in newsList" :key="item.id">
            <a
              :href="item.sourceUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="block px-6 py-5 hover:bg-slate-50 transition duration-300"
            >
              <p class="text-sm text-slate-500 mb-1">
                {{ formatLaborNewsDate(item.publishedAt) }}　{{ item.sourceName }}
              </p>
              <p class="text-slate-900 font-medium leading-relaxed">{{ item.title }}</p>
            </a>
          </li>
        </ul>

        <!-- Pagination -->
        <div v-if="pagination && pagination.last_page > 1" class="flex justify-center mt-10 gap-2">
          <button
            class="rounded-lg border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
            :disabled="!pagination?.prev_page_url"
            @click="currentPage--"
          >
            上一頁
          </button>
          <div
            v-for="page in displayedPages"
            :key="page"
            class="cursor-pointer rounded-lg border px-4 py-2"
            :class="page === pagination?.current_page
              ? 'bg-blue-900 text-white border-blue-900'
              : 'border-slate-300 text-slate-600 hover:bg-slate-50'"
            @click="currentPage = page"
          >
            {{ page }}
          </div>
          <button
            class="rounded-lg border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
            :disabled="!pagination?.next_page_url"
            @click="currentPage++"
          >
            下一頁
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { LaborNewsApi } from "@/api/laborNews";
import type { LaborNewsListData, PublicLaborNewsData } from "@/api/interface/laborNews";

const PAGE_SIZE = 10;

definePageMeta({
  layout: "default",
});

usePageSeo({
  title: "勞資 News｜勞資爭議與勞動法規新聞 | 金豐集團",
  description:
    "彙整勞資爭議、勞動契約、加班費、資遣費等相關新聞報導，協助企業主與人資掌握最新勞動法規趨勢，提前預防勞資糾紛。",
  path: "/labor-news",
});

useSchemaOrg(
  buildBreadcrumbSchema([
    { name: "首頁", path: "/" },
    { name: "勞資 News", path: "/labor-news" },
  ]),
);

const currentPage = ref(1);
const keywordInput = ref("");
const appliedKeyword = ref("");
const newsList = ref<PublicLaborNewsData[]>([]);
const pagination = ref<LaborNewsListData | null>(null);
const pending = ref(true);
const loadError = ref(false);

const displayedPages = computed(() => {
  const startPage = Math.max(1, currentPage.value - 3);
  const endPage = Math.min(pagination.value?.last_page || 1, startPage + 5);
  return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
});

async function fetchList() {
  pending.value = true;
  loadError.value = false;

  const res = await LaborNewsApi.getLaborNewsList({
    page: currentPage.value,
    pageSize: PAGE_SIZE,
    keyword: appliedKeyword.value,
  });

  if (!res) {
    loadError.value = true;
    pending.value = false;
    return;
  }

  pagination.value = res;
  newsList.value = res.data;
  pending.value = false;
}

function handleSearch() {
  appliedKeyword.value = keywordInput.value.trim();
  if (currentPage.value === 1) {
    fetchList();
  } else {
    currentPage.value = 1;
  }
}

// backend 已依 sort_order ASC, publishedAt DESC, id DESC 排序完成 —
// 前端直接照 API 回傳順序顯示，不再自行 .sort()/.slice()。
function formatLaborNewsDate(dateOnly: string): string {
  return dateOnly.replaceAll("-", "/");
}

watch(currentPage, fetchList);

onMounted(() => {
  fetchList();
});
</script>
