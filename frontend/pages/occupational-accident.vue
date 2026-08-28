<template>
  <div class="min-h-screen bg-slate-50">
    <section class="py-20 bg-white">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <p class="text-blue-900 font-bold text-base uppercase tracking-wider mb-2">
          Occupational Accident
        </p>
        <h1 class="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
          職業災害保險與職災補償——企業投保義務與風險
        </h1>
        <p class="text-slate-600 mb-10 leading-relaxed">
          勞工職業災害保險及保護法自2022年5月1日施行，大幅提高了企業在職災保險投保上的責任與風險。以下整理企業老闆與人資主管最需要掌握的投保規則、罰則與相關爭議重點。
        </p>

        <div class="bg-white rounded-xl shadow-lg p-8 mb-8 border border-slate-200">
          <h2 class="text-2xl font-bold text-slate-900 mb-4">
            職災保險自動生效，雇主未投保不影響勞工保障
          </h2>
          <p class="text-slate-600 leading-relaxed mb-4">
            本法自2022年5月1日施行，即使雇主未替員工辦理投保手續，職業災害保險保障仍自動生效，性質等同勞工強制險；投保薪資最低為基本工資，並訂有投保上限級距。
          </p>
          <img
            :src="image07"
            alt="勞工職業災害保險及保護法 2022/05/01新法上路"
            class="w-full max-w-md mx-auto rounded-lg"
            loading="eager"
            width="1180"
            height="1668"
          />
        </div>

        <div class="bg-white rounded-xl shadow-lg p-8 mb-8 border border-slate-200">
          <h2 class="text-2xl font-bold text-slate-900 mb-4">
            投保薪資上限與雇主罰則
          </h2>
          <p class="text-slate-600 leading-relaxed mb-4">
            雇主罰則同步增訂：員工到職日未依規定投保，可能面臨罰鍰，情節重大者並可能遭處以行政處分，逾期未繳納將依法強制執行，本項目也已成為勞動檢查的重點項目之一，企業應事先了解相關規定並預作因應對策。
          </p>
          <ul class="list-disc list-inside space-y-2 text-slate-700">
            <li>不論雇主是否已辦理加保，職業災害保險保障自到職日起生效</li>
            <li>員工到職未投保，雇主可能面臨罰鍰及行政處分</li>
            <li>已列為勞動檢查重點項目</li>
          </ul>
          <img
            :src="image08"
            alt="職業災害保險及保護法,需留意投保薪資上限"
            class="w-full max-w-md mx-auto rounded-lg mt-6"
            loading="lazy"
            width="1180"
            height="1668"
          />
        </div>

        <div class="bg-blue-900 text-white rounded-xl shadow-lg p-8 mb-8">
          <h2 class="text-xl font-bold mb-3">職災補償也是常見勞資爭議來源</h2>
          <p class="text-blue-100 leading-relaxed mb-4">
            職業災害補償金爭議是企業常見的勞資爭議類型之一，通常涉及保險規劃是否得當、補償金額認定等問題。若企業對投保規劃或補償責任有疑慮，建議一併了解勞資爭議的常見類型與因應方式。
          </p>
          <NuxtLink
            to="/labor-dispute"
            class="inline-flex items-center text-amber-400 font-medium hover:text-amber-300 transition"
          >
            了解勞資爭議與訴訟舉證責任 →
          </NuxtLink>
        </div>

        <p class="text-xs text-slate-400 leading-relaxed mb-10">
          以上法規重點整理自講座教材，實際條文、罰則金額與最新修法內容，請以勞動部及相關主管機關公告為準；個別案件仍應依實際狀況諮詢專業意見，本頁內容不構成具體法律意見。
        </p>

        <div class="flex flex-wrap gap-4">
          <NuxtLink
            to="/labor-info"
            class="text-blue-900 font-medium hover:underline"
          >
            ← 回勞資法規說明總覽
          </NuxtLink>
          <NuxtLink
            to="/#register"
            class="ml-auto bg-amber-500 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-amber-600 transition"
          >
            了解講座課程與報名方式
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import image07 from "~/assets/img/07.webp";
import image08 from "~/assets/img/08.webp";

definePageMeta({
  layout: "default",
});

usePageSeo({
  title: "職業災害保險與職災補償 - 企業投保義務與風險 | 金豐集團",
  description:
    "解析勞工職業災害保險及保護法投保義務、投保薪資上限與雇主罰則，說明職災補償爭議與勞動檢查重點，協助企業降低職業災害相關法律風險。",
  path: "/occupational-accident",
});

useSchemaOrg(
  buildBreadcrumbSchema([
    { name: "首頁", path: "/" },
    { name: "勞資法規說明", path: "/labor-info" },
    { name: "職業災害保險與職災補償", path: "/occupational-accident" },
  ])
);
</script>
