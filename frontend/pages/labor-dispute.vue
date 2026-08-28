<template>
  <div class="min-h-screen bg-slate-50">
    <section class="py-20 bg-white">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <p class="text-blue-900 font-bold text-base uppercase tracking-wider mb-2">
          Labor Dispute
        </p>
        <h1 class="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
          勞資爭議與訴訟舉證責任——企業常見風險與因應
        </h1>
        <p class="text-slate-600 mb-10 leading-relaxed">
          近年勞動事件法陸續上路，勞資間的舉證責任與認定方式已大幅翻轉，勞資爭議案件數也明顯上升。以下整理企業老闆與人資主管最需要掌握的舉證責任變化、常見爭議類型與求職蟑螂因應對策。
        </p>

        <div class="bg-white rounded-xl shadow-lg p-8 mb-8 border border-slate-200">
          <h2 class="text-2xl font-bold text-slate-900 mb-4">
            2020年勞動事件法上路，舉證責任大幅轉向勞工
          </h2>
          <p class="text-slate-600 leading-relaxed mb-4">
            勞動事件法自2020年1月1日施行後，工資與工時的認定原則、舉證責任分配出現重大轉變。過去工資工時爭議多以雇主認定為主、員工須自行舉證；現行制度則改為員工認定為主，除非雇主能提出反證，否則出勤紀錄與薪資收入將優先被推定為工時、工資。
          </p>
          <p class="text-slate-600 leading-relaxed mb-4">
            訴訟門檻也大幅降低：企業正職員工、技術工、建教生，甚至求職者都可以提出勞資爭議，且若法院認為有必要，訴訟期間雇主仍須繼續給付員工薪資。根據勞動部統計，勞動事件法施行後，勞資爭議受理案件數與涉及人數皆明顯上升。
          </p>
          <ul class="list-disc list-inside space-y-2 text-slate-700">
            <li>工資、工時爭議：以員工認定為主，雇主須負舉證責任</li>
            <li>提告更容易：所有身分的工作者皆可提出勞資爭議，訴訟成本降低</li>
            <li>訴訟期間：經法院認定後，雇主仍須照常給付薪資</li>
            <li>開放專業輔佐人免費協助勞工進行訴訟</li>
          </ul>
        </div>

        <div class="bg-white rounded-xl shadow-lg p-8 mb-8 border border-slate-200">
          <h2 class="text-2xl font-bold text-slate-900 mb-4">
            企業常見七大勞資爭議類型
          </h2>
          <p class="text-slate-600 leading-relaxed mb-4">
            企業常見的勞資爭議類型包括：勞動契約爭議（發生爭議時勞工的主張經常優先被採認）、勞動條件爭議（工時、加班、補休程序的合法性）、契約終止爭議（資遣、開除員工時應留意的程序）、工資認定爭議（工資與非工資的界定，影響二次費用及職業災害補償金計算）、職業災害補償金爭議（保險規劃是否得當）、安定責任準備金爭議，以及證據保全爭議（如何建立並保存有效證據）。
          </p>
          <img
            :src="image15"
            alt="面對常見勞資爭議企業要如何因應及防護對策解析"
            class="w-full max-w-md mx-auto rounded-lg"
            loading="lazy"
            width="1180"
            height="1668"
          />
        </div>

        <div class="bg-white rounded-xl shadow-lg p-8 mb-8 border border-slate-200">
          <h2 class="text-2xl font-bold text-slate-900 mb-4">
            求職蟑螂：履歷查核與到職流程是關鍵防線
          </h2>
          <p class="text-slate-600 leading-relaxed mb-4">
            近年也出現「求職蟑螂」爭議，即部分求職者或到職員工利用法規漏洞，向企業索討賠償或資遣費。企業應留意履歷真實性查核與到職流程管理，避免蒙受不必要的損失。
          </p>
          <img
            :src="image09"
            alt="面對求職蟑螂,企業應如何處理避免吃啞巴虧"
            class="w-full max-w-md mx-auto rounded-lg"
            loading="lazy"
            width="1180"
            height="1668"
          />
        </div>

        <div class="bg-blue-900 text-white rounded-xl shadow-lg p-8 mb-8">
          <h2 class="text-xl font-bold mb-3">職業災害補償金爭議也是常見類型之一</h2>
          <p class="text-blue-100 leading-relaxed mb-4">
            上述七大爭議類型中，職業災害補償金爭議通常與企業的職災保險規劃直接相關。若想進一步了解投保義務與罰則，建議參考職業災害保險說明頁。
          </p>
          <NuxtLink
            to="/occupational-accident"
            class="inline-flex items-center text-amber-400 font-medium hover:text-amber-300 transition"
          >
            了解職業災害保險與職災補償 →
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
import image09 from "~/assets/img/09.webp";
import image15 from "~/assets/img/15.webp";

definePageMeta({
  layout: "default",
});

usePageSeo({
  title: "勞資爭議與訴訟舉證責任 - 常見爭議類型解析 | 金豐集團",
  description:
    "說明2020年勞動事件法上路後舉證責任的轉變、企業常見七大勞資爭議類型與求職蟑螂因應對策，協助企業老闆與人資主管預防勞資糾紛。",
  path: "/labor-dispute",
});

useSchemaOrg(
  buildBreadcrumbSchema([
    { name: "首頁", path: "/" },
    { name: "勞資法規說明", path: "/labor-info" },
    { name: "勞資爭議與訴訟舉證責任", path: "/labor-dispute" },
  ])
);
</script>
