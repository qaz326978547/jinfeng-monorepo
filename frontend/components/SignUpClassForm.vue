<template>
  <section class="py-20 bg-white" id="register">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16">
        <p class="text-blue-900 font-bold text-base uppercase tracking-wider mb-2">
          Contact Us
        </p>
        <h2 class="text-3xl md:text-4xl font-bold text-slate-900">報名與聯絡資訊</h2>
        <div class="w-20 h-1 bg-amber-500 mx-auto mt-4 rounded-full"></div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <!-- Left Side: Contact Info & Payment Info -->
        <div class="lg:col-span-5 space-y-8">
          <!-- Contact Card -->
          <div class="bg-slate-50 p-8 rounded-2xl shadow-sm border border-slate-200">
            <h3 class="text-xl font-bold text-blue-900 mb-6 flex items-center">
              <Icon name="tabler:phone" class="mr-2" size="24" /> 聯絡我們
            </h3>
            <div class="space-y-4">
              <div>
                <p class="text-sm text-slate-500">聯絡人</p>
                <p class="text-lg font-bold text-slate-800">吳冠璋 經理</p>
              </div>
              <div>
                <p class="text-sm text-slate-500">聯絡電話</p>
                <p class="font-medium text-slate-800 flex flex-col sm:flex-row sm:gap-4">
                  <a href="tel:0930532215" class="hover:text-blue-600">0930-532-215</a>
                  <a href="tel:0916834966" class="hover:text-blue-600">0916-834-966</a>
                </p>
              </div>
              <div>
                <p class="text-sm text-slate-500">電子信箱</p>
                <a
                  href="mailto:a0930532215@gmail.com"
                  class="text-blue-600 hover:underline"
                  >a0930532215@gmail.com</a
                >
              </div>
              <div>
                <a
                  href="https://lin.ee/9MI6Yao"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center justify-center w-full bg-[#06C755] text-white px-4 py-3 rounded-lg font-bold hover:bg-[#05b34c] transition shadow-md"
                >
                  <Icon name="tabler:message-circle" class="mr-2" />
                  加 LINE 好友諮詢
                </a>
              </div>
            </div>
          </div>

          <!-- Payment Info Card -->
          <div class="bg-blue-900 p-8 rounded-2xl shadow-lg text-white">
            <h3 class="text-xl font-bold mb-6 flex items-center text-amber-400">
              <Icon name="tabler:credit-card" class="mr-2" size="24" /> 轉帳繳款資訊
            </h3>
            <div class="space-y-4 text-blue-50">
              <div class="flex justify-between border-b border-blue-700 pb-2">
                <span>銀行代碼</span>
                <span class="font-mono">808 (玉山)</span>
              </div>
              <div class="flex justify-between border-b border-blue-700 pb-2">
                <span>分行名稱</span>
                <span>玉山銀行 - 北高雄分行</span>
              </div>
              <div class="pb-2">
                <p class="text-xs text-blue-300 mb-1">匯款帳號</p>
                <p class="text-2xl font-mono font-bold text-white tracking-wider">
                  0347-440-029556
                </p>
              </div>
              <div class="pb-2">
                <p class="text-xs text-blue-300 mb-1">戶名</p>
                <p class="font-bold">金豐企業管理顧問股份有限公司</p>
              </div>
              <div class="flex items-start bg-blue-800/50 p-3 rounded-lg text-sm">
                <Icon
                  name="tabler:circle-check"
                  size="16"
                  class="mt-0.5 mr-2 text-amber-400 flex-shrink-0"
                />
                <p>我們將提供金豐企業管理顧問股份有限公司發票</p>
              </div>
            </div>
          </div>

          <!-- Warning/Deadline Card -->
          <div class="bg-amber-50 p-6 rounded-2xl border border-amber-200 text-amber-900">
            <h3 class="font-bold flex items-center mb-3">
              <Icon name="tabler:alert-circle" class="mr-2" size="20" />
              報名截止與退費規定
            </h3>
            <ul class="list-disc list-inside space-y-2 text-sm">
              <li><strong>報名截止日期:</strong>講座前一週。</li>
              <li>截止日後不能退費。</li>
              <li>
                若要延期需加收延期費 <span class="font-bold text-red-600">$500</span>。
              </li>
              <li>
                <span class="font-bold text-red-600">台北場</span>需重新報名,無法延期。
              </li>
            </ul>
          </div>
        </div>

        <!-- Right Side: Contact Form -->
        <div class="lg:col-span-7">
          <div
            class="bg-white p-8 md:p-10 rounded-2xl shadow-lg border border-slate-200 h-full"
          >
            <h3 class="text-2xl font-bold text-slate-800 mb-6">講座報名 / 免費諮詢</h3>
            <p class="text-slate-600 mb-8">
              請填寫以下資訊,我們的團隊將在收到後盡快與您聯繫。
            </p>
            <!-- 報名場次 -->
            <div class="mb-8">
              <h3 class="text-lg font-semibold text-slate-900 mb-4">
                遠離勞資糾紛-法律速成班(報名場次)<span class="text-amber-500">*</span>
              </h3>
              <div class="space-y-3">
                <div
                  v-for="classData in contactClassData"
                  :key="classData.id"
                  class="flex items-center"
                >
                  <input
                    type="checkbox"
                    :id="String(classData.id)"
                    v-model="selectClass"
                    :value="classData.name"
                    :aria-label="classData.name"
                    class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label
                    class="ml-3 text-base text-slate-700 cursor-pointer"
                    :for="String(classData.id)"
                  >
                    {{ classData.name }}
                  </label>
                </div>
              </div>
            </div>
            <!-- 報名資料 -->
            <div class="mb-8">
              <h3 class="text-lg font-semibold text-slate-900 mb-4">
                填寫報名資料<span class="text-amber-500">*</span>
              </h3>
              <div class="space-y-4">
                <div>
                  <label
                    class="block text-sm font-medium text-slate-700 mb-1"
                    for="company"
                  >
                    公司名稱/服務單位 <span class="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="company"
                    v-model="signedUpClassData.company"
                    class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                    placeholder="請輸入公司名稱"
                  />
                </div>
                <div>
                  <label
                    class="block text-sm font-medium text-slate-700 mb-1"
                    for="phone"
                  >
                    公司電話 <span class="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="phone"
                    v-model="signedUpClassData.tel"
                    class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                    placeholder="請輸入公司電話"
                  />
                </div>
              </div>
            </div>
            <!-- 目前想解決或想瞭解的問題 -->
            <div class="mb-8">
              <h3 class="text-lg font-semibold text-slate-900 mb-4">
                目前想解決或想瞭解的問題<span class="text-amber-500">*</span>
              </h3>
              <div class="space-y-3">
                <div
                  v-for="faqData in contactFaqData?.data"
                  :key="faqData.id"
                  class="flex items-start"
                >
                  <input
                    type="checkbox"
                    :id="String(faqData.id)"
                    v-model="selectFaq"
                    :value="faqData.name"
                    :aria-label="faqData.name"
                    class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-1"
                  />
                  <label
                    class="ml-3 text-base text-slate-700 cursor-pointer"
                    :for="String(faqData.id)"
                    :aria-label="faqData.name"
                  >
                    {{ faqData.name }}
                  </label>
                </div>
              </div>
            </div>
            <hr class="my-6 border-slate-200" />
            <!-- 依人數增加 -->
            <div class="mb-6">
              <label for="peopleNum" class="block text-sm font-medium text-slate-700 mb-1"
                >報名人數</label
              >
              <select
                name=""
                id="peopleNum"
                class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                v-model="peopleNum"
              >
                <option v-for="n in 10" :key="n" :value="n">{{ n }}</option>
              </select>
            </div>
            <!-- 依人數增加 -->
            <div class="mb-8" v-for="(people, idx) in peopleInfo" :key="idx">
              <p class="mb-4 text-lg font-bold text-blue-700">參加人員 {{ idx + 1 }}</p>
              <div class="space-y-4">
                <div>
                  <label
                    class="block text-sm font-medium text-slate-700 mb-1"
                    :for="`name${idx}`"
                  >
                    姓名 <span class="text-amber-500">*</span>
                  </label>
                  <input
                    v-model="people.name"
                    class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                    type="text"
                    :id="`name${idx}`"
                    placeholder="請輸入姓名"
                  />
                </div>
                <div>
                  <label
                    class="block text-sm font-medium text-slate-700 mb-1"
                    :for="`cel${idx}`"
                  >
                    手機號碼<span class="text-amber-500">*</span>
                  </label>
                  <input
                    v-model="people.cel"
                    class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                    type="text"
                    :id="`cel${idx}`"
                    placeholder="請輸入手機號碼"
                  />
                </div>
                <div>
                  <label
                    class="block text-sm font-medium text-slate-700 mb-1"
                    :for="`job${idx}`"
                    >職稱</label
                  >
                  <input
                    v-model="people.job"
                    class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                    type="text"
                    :id="`job${idx}`"
                    placeholder="請輸入職稱"
                  />
                </div>
                <div>
                  <label
                    class="block text-sm font-medium text-slate-700 mb-1"
                    :for="`email${idx}`"
                  >
                    E-MAIL <span class="text-amber-500">*</span>
                  </label>
                  <input
                    v-model="people.email"
                    class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                    type="text"
                    :id="`email${idx}`"
                    placeholder="請輸入 E-MAIL"
                  />
                </div>
              </div>
            </div>
            <hr class="my-6 border-slate-200" />
            <!-- 匯款後五碼 -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-slate-700 mb-1" for="last5"
                >匯款末五碼</label
              >
              <input
                v-model="signedUpClassData.last5"
                class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                type="text"
                id="last5"
                placeholder="請輸入匯款末五碼"
              />
              <p class="mt-2 text-sm text-amber-600">
                (優惠1,000元/人 費用含講義及飯店下午茶
                再贈企業個別諮詢1小時保證物超所值,價值$5,000元,報名後請三日內完成繳費)。可以先填寫報名資料
                匯款完成後再於line官方帳號或mail填寫匯款資訊(匯款末五碼及匯款日期)
              </p>
            </div>
            <!-- 發票 -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-slate-700 mb-3">
                發票是否開立公司抬頭(三聯式發票)
              </label>
              <div class="flex gap-6">
                <div class="flex items-center">
                  <input
                    v-model="signedUpClassData.ticket"
                    class="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    type="radio"
                    id="yes"
                    value="3"
                    name="ticket"
                  />
                  <label class="ml-2 text-base text-slate-700 cursor-pointer" for="yes"
                    >是</label
                  >
                </div>
                <div class="flex items-center">
                  <input
                    v-model="signedUpClassData.ticket"
                    class="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    type="radio"
                    id="no"
                    value="2"
                    name="ticket"
                  />
                  <label class="ml-2 text-base text-slate-700 cursor-pointer" for="no"
                    >否</label
                  >
                </div>
              </div>
            </div>
            <div class="space-y-4">
              <div>
                <label
                  class="block text-sm font-medium text-slate-700 mb-1"
                  for="ticket_name"
                  >發票抬頭</label
                >
                <input
                  v-model="signedUpClassData.ticket_name"
                  placeholder="請填入發票抬頭"
                  class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                  type="text"
                  id="ticket_name"
                />
              </div>
              <div>
                <label
                  class="block text-sm font-medium text-slate-700 mb-1"
                  for="ticket_no"
                  >統一編號</label
                >
                <input
                  placeholder="請填入統一編號"
                  v-model="signedUpClassData.ticket_no"
                  class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                  type="text"
                  id="ticket_no"
                />
              </div>
              <div>
                <label
                  class="block text-sm font-medium text-slate-700 mb-1"
                  for="ticket_address"
                  >發票寄送地址</label
                >
                <input
                  placeholder="請填入發票寄送地址"
                  v-model="signedUpClassData.ticket_address"
                  class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                  type="text"
                  id="ticket_address"
                />
              </div>
              <div>
                <label
                  class="block text-sm font-medium text-slate-700 mb-1"
                  for="HowToKnow"
                  >得知講座管道</label
                >
                <input
                  placeholder="請填入得知講座管道"
                  v-model="signedUpClassData.from"
                  class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                  type="text"
                  id="HowToKnow"
                />
              </div>
              <div>
                <label
                  class="block text-sm font-medium text-slate-700 mb-1"
                  for="recommend_name"
                  >推薦人姓名</label
                >
                <input
                  placeholder="請填入推薦人姓名"
                  v-model="signedUpClassData.suggest_name"
                  class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                  type="text"
                  id="recommend_name"
                />
              </div>
            </div>
            <button
              @click="addSignedUpClass"
              class="w-full mt-8 bg-blue-900 hover:bg-blue-800 text-white font-bold py-4 rounded-lg shadow-lg transition duration-300 transform hover:-translate-y-1 flex justify-center items-center"
            >
              送出資訊 <Icon name="tabler:arrow-right" class="ml-2" size="20" />
            </button>
            <p class="text-xs text-slate-500 text-center mt-4">
              提交即表示您同意我們的服務條款與隱私政策。
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
  <LoadingComponet v-if="!contactClassData || !contactFaqData || isLoading" />
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import type {
  ContactClass,
  AddContactInfo,
  ContactListInfo,
  ContactClassData,
} from "@/api/interface/signedUpClass";
import { usePublicStore } from "@/store/usePublicStore";
import { useAuthStore } from "@/store/useAuthStore";
import { SignedUpClassInfoApi } from "@/api/signedUpClass";

const { apiBaseUrl, isLoading } = storeToRefs(usePublicStore());
const { token } = useAuthStore();
const peopleNum = ref(1);

const selectClass = ref<string[]>([]); //不能為空
const selectFaq = ref<string[]>([]); //不能為空
const peopleInfo = ref<ContactListInfo[]>([{ name: "", cel: "", job: "", email: "" }]);

watch(peopleNum, (val) => {
  const currentLength = peopleInfo.value.length;
  if (val > currentLength) {
    for (let i = currentLength; i < val; i++) {
      peopleInfo.value.push({ name: "", cel: "", job: "", email: "" });
    }
  } else if (val < currentLength) {
    peopleInfo.value.splice(val);
  }
});

const signedUpClassData = ref<AddContactInfo>({
  class: "",
  company: "",
  tel: "", //最多只能輸入10碼
  num: String(peopleNum.value),
  last5: "", //最多只能輸入5碼
  ticket: "",
  ticket_name: "",
  ticket_no: "",
  ticket_address: "",
  suggest_name: "",
  quest: "",
  from: "",
  contactList: [
    {
      name: "", //不能為空
      cel: "", //不能為空
      job: "",
      email: "", //不能為空
    },
  ],
});

// const contactClassData = ref<ContactClass[] | null>(null);

// const getContactClassData = async () => {
//     const res = await SignedUpClassInfoApi.getContactClass();
//     if (res) {
//         contactClassData.value = res;
//     }
// };

const { data: contactClassData, refresh, error } = await useFetch<ContactClass[]>(
  "/contact-class",
  {
    method: "GET",
    baseURL: apiBaseUrl.value,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    onRequest({ request, options }) {
      // console.log('Request was sent');
    },
    onResponse({ request, response, options }) {
      // console.log('Response data:', response._data);
      contactClassData.value = response._data; // 更新数据
    },
  }
);

const {
  data: contactFaqData,
  refresh: refreshFaq,
  error: errorFaq,
} = await useFetch<ContactClassData>("/contact-quest", {
  method: "GET",
  query: { page: 1 },
  baseURL: apiBaseUrl.value,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    Authorization: `Bearer ${token || ""}`,
  },
});
onMounted(() => {
  refresh();
  refreshFaq();
  // getContactClassData();
});

const router = useRouter();

const addSignedUpClass = async () => {
  signedUpClassData.value.class = selectClass.value.join(", ");
  signedUpClassData.value.quest = selectFaq.value.join(", ");
  signedUpClassData.value.num = String(peopleNum.value);
  signedUpClassData.value.contactList = peopleInfo.value;

  const res = await SignedUpClassInfoApi.addContactInfo(signedUpClassData.value);
  if (res) {
    isLoading.value = true;
    setTimeout(() => {
      isLoading.value = false;
      router.push({ name: "thanks" });
    }, 3000); //3秒後跳轉
  }
};
</script>
