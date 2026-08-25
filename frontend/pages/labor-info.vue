<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Labor Information Section - 勞資說明分頁 -->
    <section id="labor-info" class="py-20 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <p class="text-blue-900 font-bold text-base uppercase tracking-wider mb-2">
            Labor Information
          </p>
          <h1 class="text-3xl md:text-4xl font-bold text-slate-900">勞資法規說明</h1>
          <p class="text-slate-500 mt-4">詳細了解勞動法規與企業應對策略</p>
        </div>

        <!-- Tab Navigation -->
        <div class="flex flex-wrap justify-center gap-2 mb-8">
          <button
            v-for="(tab, index) in laborTabs"
            :key="index"
            @click="currentLaborTab = index"
            :class="`px-6 py-3 rounded-lg font-medium transition duration-300 ${
              currentLaborTab === index
                ? 'bg-blue-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`"
          >
            {{ tab.title }}
          </button>
        </div>

        <!-- Tab Content: 文字說明（供搜尋引擎與螢幕閱讀器閱讀，圖片僅作為輔助視覺呈現） -->
        <div class="max-w-4xl mx-auto">
          <transition name="fade" mode="out-in">
            <div :key="currentLaborTab" class="bg-white rounded-xl shadow-lg p-8 mb-8">
              <h2 class="text-2xl font-bold text-slate-900 mb-4">
                {{ laborTabs[currentLaborTab].summary.heading }}
              </h2>
              <p
                v-for="(paragraph, pIdx) in laborTabs[currentLaborTab].summary.paragraphs"
                :key="pIdx"
                class="text-slate-600 leading-relaxed mb-4"
              >
                {{ paragraph }}
              </p>
              <ul
                v-if="laborTabs[currentLaborTab].summary.list?.length"
                class="list-disc list-inside space-y-2 text-slate-700"
              >
                <li v-for="(point, lIdx) in laborTabs[currentLaborTab].summary.list" :key="lIdx">
                  {{ point }}
                </li>
              </ul>
            </div>
          </transition>

          <transition name="fade" mode="out-in">
            <div :key="currentLaborTab" class="bg-white rounded-xl shadow-lg p-8">
              <!-- 使用 assets/img 的靜態圖檔，不經過 Nuxt Image、IPX 或 CDN。 -->
              <img
                v-for="(img, idx) in laborTabs[currentLaborTab].images"
                :key="idx"
                class="sm:w-[400px] w-full md:w-[600px] lg:w-[800px] mx-auto mb-4"
                :src="img.src"
                :alt="img.alt"
                :loading="currentLaborTab === 0 && idx === 0 ? 'eager' : 'lazy'"
                :width="img.width || 1180"
                :height="img.height || 1668"
              />
            </div>
          </transition>
        </div>

        <p class="max-w-4xl mx-auto text-xs text-slate-400 mt-8 leading-relaxed">
          以上法規重點整理自講座教材，實際條文、罰則金額與最新修法內容，請以勞動部及相關主管機關公告為準；個別案件仍應依實際狀況諮詢專業意見，本頁內容不構成具體法律意見。
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import image01 from "~/assets/img/01.webp";
import image02 from "~/assets/img/02.webp";
import image03 from "~/assets/img/03.webp";
import image04 from "~/assets/img/04.webp";
import image05 from "~/assets/img/05.webp";
import image06 from "~/assets/img/06.webp";
import image07 from "~/assets/img/07.webp";
import image08 from "~/assets/img/08.webp";
import image09 from "~/assets/img/09.webp";
import image10 from "~/assets/img/10.webp";
import image11 from "~/assets/img/11.webp";
import image12 from "~/assets/img/12.webp";
import image13 from "~/assets/img/13.webp";
import image14 from "~/assets/img/14.webp";
import image15 from "~/assets/img/15.webp";
import image16 from "~/assets/img/16.webp";
import image17 from "~/assets/img/17.webp";
import image18 from "~/assets/img/18.webp";
import image19 from "~/assets/img/19.webp";

definePageMeta({
  layout: "default",
});

// Labor Information Tabs - 將原有圖片分類，並補上真實文字內容（非僅存在於圖片中）
const currentLaborTab = ref(0);
const laborTabs = [
  {
    title: "講座介紹",
    summary: {
      heading: "價值百萬的講座，老闆與人資千萬別錯過",
      paragraphs: [
        "近年勞動事件法、勞工職業災害保險及保護法陸續上路，加上勞動教育促進法即將推行，勞資間的認定方式與舉證責任已大幅翻轉。若不清楚如何有效預防，爭議與訴訟風險將大為增加。",
        "違反勞基法相關規定，罰鍰約為新台幣2萬元至100萬元不等，實際金額仍以主管機關個案認定為準。",
      ],
      list: ["預防勞資爭議", "轉嫁職業災害風險", "掌握最新法規異動", "杜絕求職蟑螂陷阱"],
    },
    images: [
      {
        src: image01,
        alt: "價值百萬的講座,老闆及人資千萬不可錯過",
        width: 1180,
        height: 1668,
      },
      {
        src: image02,
        alt: "避免陷入勞資糾紛,以下情況千萬注意",
        width: 1180,
        height: 1668,
      },
      {
        src: image03,
        alt: "符合上列其中一樣情況,建議您立即報名本講座",
        width: 734,
        height: 1038,
      },
    ],
  },
  {
    title: "勞動事件法",
    summary: {
      heading: "2020年起，勞資舉證責任大不同",
      paragraphs: [
        "勞動事件法自2020年1月1日施行後，工資與工時的認定原則、舉證責任分配出現重大轉變。過去工資工時爭議多以雇主認定為主、員工須自行舉證；現行制度則改為員工認定為主，除非雇主能提出反證，否則出勤紀錄與薪資收入將優先被推定為工時、工資。",
        "訴訟門檻也大幅降低：企業正職員工、技術工、建教生，甚至求職者都可以提出勞資爭議，且若法院認為有必要，訴訟期間雇主仍須繼續給付員工薪資。根據勞動部統計，勞動事件法施行後，勞資爭議受理案件數與涉及人數皆明顯上升。",
      ],
      list: [
        "工資、工時爭議：以員工認定為主，雇主須負舉證責任",
        "提告更容易：所有身分的工作者皆可提出勞資爭議，訴訟成本降低",
        "訴訟期間：經法院認定後，雇主仍須照常給付薪資",
        "開放專業輔佐人免費協助勞工進行訴訟",
      ],
    },
    images: [
      {
        src: image04,
        alt: "勞動事件法/加班費的算法/資遣費的算法",
        width: 1180,
        height: 1668,
      },
      { src: image05, alt: "工資、工時爭議", width: 1180, height: 1668 },
      { src: image06, alt: "勞動事件法 需注意?", width: 1180, height: 1668 },
      {
        src: image13,
        alt: "109年勞動事件法實施",
        width: 1180,
        height: 1030,
      },
    ],
  },
  {
    title: "職災保險法",
    summary: {
      heading: "勞工職業災害保險及保護法，2022年5月上路",
      paragraphs: [
        "本法自2022年5月1日施行，即使雇主未替員工辦理投保手續，職業災害保險保障仍自動生效，性質等同勞工強制險；投保薪資最低為基本工資，並訂有投保上限級距。",
        "雇主罰則同步增訂：員工到職日未依規定投保，可能面臨罰鍰，情節重大者並可能遭處以行政處分，逾期未繳納將依法強制執行，本項目也已成為勞動檢查的重點項目之一，企業應事先了解相關規定並預作因應對策。",
      ],
      list: [
        "不論雇主是否已辦理加保，職業災害保險保障自到職日起生效",
        "員工到職未投保，雇主可能面臨罰鍰及行政處分",
        "已列為勞動檢查重點項目",
      ],
    },
    images: [
      {
        src: image07,
        alt: "勞工職業災害保險及保護法 2022/05/01新法上路",
        width: 1180,
        height: 1668,
      },
      {
        src: image08,
        alt: "職業災害保險及保護法,需留意投保薪資上限",
        width: 1180,
        height: 1668,
      },
    ],
  },
  {
    title: "勞資爭議",
    summary: {
      heading: "常見勞資爭議與求職蟑螂因應對策",
      paragraphs: [
        "企業常見的勞資爭議類型包括：勞動契約爭議（發生爭議時勞工的主張經常優先被採認）、勞動條件爭議（工時、加班、補休程序的合法性）、契約終止爭議（資遣、開除員工時應留意的程序）、工資認定爭議（工資與非工資的界定，影響二次費用及職災補償金計算）、職業災害補償金爭議（保險規劃是否得當）、安定責任準備金爭議，以及證據保全爭議（如何建立並保存有效證據）。",
        "近年也出現「求職蟑螂」爭議，即部分求職者或到職員工利用法規漏洞，向企業索討賠償或資遣費。企業應留意履歷真實性查核與到職流程管理，避免蒙受不必要的損失。",
      ],
    },
    images: [
      {
        src: image09,
        alt: "面對求職蟑螂,企業應如何處理避免吃啞巴虧",
        width: 1180,
        height: 1668,
      },
      {
        src: image15,
        alt: "面對常見勞資爭議企業要如何因應及防護對策解析",
        width: 1180,
        height: 1668,
      },
    ],
  },
  {
    title: "法規與課程",
    summary: {
      heading: "最新法規動態與講座課程內容",
      paragraphs: [
        "基本工資自105年至113年已連續調漲，月薪總計調漲37.3%、時薪調漲52.5%，勞健保與勞退提撥等人事成本也隨之提高；同時勞動部持續簡化線上檢舉流程，並推動勞動教育促進法，企業須更主動掌握法規動態。",
        "本講座課程內容涵蓋勞動事件法的舉證責任與工時工資推定問題、出勤表薪資表特休表等法定報表的合法性、職業災害保險及保護法的投保與風險轉嫁規劃、勞動教育促進法的因應準備，以及企業留才與人事成本控管；適合即將創業的準老闆、企業老闆／負責人與人資主管參考。詳細場次、費用與優惠內容，請以報名頁面公告為準。",
      ],
    },
    images: [
      {
        src: image10,
        alt: "勞動教育促進法通過在即",
        width: 1180,
        height: 1668,
      },
      {
        src: image11,
        alt: "基本工資連續7年調漲",
        width: 1180,
        height: 1668,
      },
      {
        src: image12,
        alt: "資訊透明化/檢舉方式簡易化",
        width: 1180,
        height: 1668,
      },
      { src: image14, alt: "參加本講座課程內容", width: 1180, height: 1668 },
      {
        src: image16,
        alt: "講座後您將省下超過百萬損失",
        width: 1180,
        height: 1668,
      },
      { src: image17, alt: "此講座課程適合對象", width: 1180, height: 1668 },
      {
        src: image18,
        alt: "本講座為勞動法務高階速修班",
        width: 1180,
        height: 1668,
      },
      {
        src: image19,
        alt: "專業勞基法專家諮詢服務",
        width: 1180,
        height: 1668,
      },
    ],
  },
];

// SEO 優化：title / description / canonical / OG / Twitter Card 集中由 usePageSeo 處理
usePageSeo({
  title: "勞資法規說明 - 勞動事件法、職災保險法、勞資爭議處理 | 金豐集團",
  description:
    "詳細解析勞動事件法、職災保險法、勞資爭議處理等重要勞動法規。金豐集團提供專業講座，協助企業了解加班費、資遣費、職業災害保險、勞資爭議預防等實務知識，降低企業風險。",
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

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
