<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Labor Information Hub -->
    <section id="labor-info" class="py-20 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <p class="text-blue-900 font-bold text-base uppercase tracking-wider mb-2">
            Labor Information
          </p>
          <h1 class="text-3xl md:text-4xl font-bold text-slate-900">勞資法規說明</h1>
          <p class="text-slate-500 mt-4">詳細了解勞動法規與企業應對策略</p>
        </div>

        <!-- 講座介紹：價值主張，維持在總覽頁 -->
        <div class="max-w-4xl mx-auto mb-16">
          <div class="bg-white rounded-xl shadow-lg p-8 border border-slate-200">
            <h2 class="text-2xl font-bold text-slate-900 mb-4">
              價值百萬的講座，老闆與人資千萬別錯過
            </h2>
            <p class="text-slate-600 leading-relaxed mb-4">
              近年勞動事件法、勞工職業災害保險及保護法陸續上路，加上勞動教育促進法即將推行，勞資間的認定方式與舉證責任已大幅翻轉。若不清楚如何有效預防，爭議與訴訟風險將大為增加。
            </p>
            <p class="text-slate-600 leading-relaxed mb-4">
              違反勞基法相關規定，罰鍰約為新台幣2萬元至100萬元不等，實際金額仍以主管機關個案認定為準。
            </p>
            <ul class="list-disc list-inside space-y-2 text-slate-700 mb-6">
              <li>預防勞資爭議</li>
              <li>轉嫁職業災害風險</li>
              <li>掌握最新法規異動</li>
              <li>杜絕求職蟑螂陷阱</li>
            </ul>
            <img
              :src="image01"
              alt="價值百萬的講座,老闆及人資千萬不可錯過"
              class="w-full max-w-sm mx-auto rounded-lg"
              loading="eager"
              width="1180"
              height="1668"
            />
          </div>
        </div>

        <!-- 三大主題摘要卡：全部同時 SSR 渲染，非分頁點擊後才存在 -->
        <div class="max-w-6xl mx-auto">
          <h2 class="text-2xl font-bold text-slate-900 text-center mb-8">
            三大勞動法規重點主題
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="bg-white rounded-xl shadow-lg p-8 border border-slate-200 flex flex-col">
              <h3 class="text-xl font-bold text-slate-900 mb-3">勞動事件法與勞資爭議</h3>
              <p class="text-slate-600 leading-relaxed mb-4 flex-1">
                2020年勞動事件法上路後，工資工時的舉證責任已從雇主轉向員工認定，正職、技術工甚至求職者都能提告，企業面對的訴訟門檻大幅降低。常見的勞資爭議類型涵蓋勞動契約、工時加班、資遣程序與求職蟑螂等多種樣態。
              </p>
              <NuxtLink
                to="/labor-dispute"
                class="text-blue-900 font-medium hover:text-blue-700 transition"
              >
                了解勞資爭議與訴訟舉證責任 →
              </NuxtLink>
            </div>

            <div class="bg-white rounded-xl shadow-lg p-8 border border-slate-200 flex flex-col">
              <h3 class="text-xl font-bold text-slate-900 mb-3">職業災害保險</h3>
              <p class="text-slate-600 leading-relaxed mb-4 flex-1">
                勞工職業災害保險及保護法自2022年5月上路後，即使雇主未辦理投保，職災保障仍自動生效，未依規定投保更可能面臨罰鍰與行政處分，已成為勞動檢查的重點項目。
              </p>
              <NuxtLink
                to="/occupational-accident"
                class="text-blue-900 font-medium hover:text-blue-700 transition"
              >
                了解職業災害保險與職災補償 →
              </NuxtLink>
            </div>

            <div class="bg-white rounded-xl shadow-lg p-8 border border-slate-200 flex flex-col">
              <h3 class="text-xl font-bold text-slate-900 mb-3">最新法規與課程動態</h3>
              <p class="text-slate-600 leading-relaxed mb-4 flex-1">
                基本工資自105年至113年已連續調漲，月薪總計調漲37.3%、時薪調漲52.5%，勞健保與勞退成本同步提高；勞動部也持續簡化線上檢舉流程，並推動勞動教育促進法，企業須更主動掌握法規動態。
              </p>
              <NuxtLink
                to="/#register"
                class="text-blue-900 font-medium hover:text-blue-700 transition"
              >
                查看講座課程內容與報名方式 →
              </NuxtLink>
            </div>
          </div>
        </div>

        <p class="max-w-4xl mx-auto text-xs text-slate-400 mt-12 leading-relaxed">
          以上法規重點整理自講座教材，實際條文、罰則金額與最新修法內容，請以勞動部及相關主管機關公告為準；個別案件仍應依實際狀況諮詢專業意見，本頁內容不構成具體法律意見。
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import image01 from "~/assets/img/01.webp";

definePageMeta({
  layout: "default",
});

usePageSeo({
  title: "勞資法規說明 - 勞動事件法、職災保險法、勞資爭議處理 | 金豐集團",
  description:
    "詳細解析勞動事件法、職災保險法、勞資爭議處理等重要勞動法規。金豐集團提供專業講座，協助企業了解舉證責任、職業災害保險、勞資爭議預防等實務知識，降低企業風險。",
  path: "/labor-info",
  image: "https://d1vjl2px6hqzku.cloudfront.net/01.webp",
});

useSchemaOrg(
  buildBreadcrumbSchema([
    { name: "首頁", path: "/" },
    { name: "勞資法規說明", path: "/labor-info" },
  ])
);
</script>
