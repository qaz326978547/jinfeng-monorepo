<template>
  <section id="consultation" class="py-20 bg-slate-50">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16">
        <p class="text-blue-900 font-bold text-base uppercase tracking-wider mb-2">
          Free Consultation
        </p>
        <h2 class="text-3xl md:text-4xl font-bold text-slate-900">聯絡我們／免費諮詢</h2>
        <div class="w-20 h-1 bg-amber-500 mx-auto mt-4 rounded-full"></div>
        <p class="text-slate-600 mt-6 leading-relaxed max-w-2xl mx-auto">
          有任何勞動法務、人資管理相關問題，或想進一步了解課程與服務內容嗎？<br class="hidden sm:block" />
          歡迎留下您的聯絡資訊與需求，我們收到後會儘快安排專人與您聯繫，提供進一步的說明與協助。
        </p>
      </div>

      <div class="bg-white p-8 md:p-10 rounded-2xl shadow-lg border border-slate-200">
        <div v-if="submitSuccess" class="text-center py-8">
          <Icon name="tabler:circle-check" class="text-blue-900 mx-auto mb-4" size="48" />
          <p class="text-lg font-medium text-slate-900">
            感謝您的留言，我們已收到您的諮詢需求，將儘快安排專人與您聯繫。
          </p>
          <button
            @click="submitSuccess = false"
            class="mt-6 text-blue-900 font-medium hover:underline"
          >
            填寫另一筆諮詢
          </button>
        </div>

        <form v-else @submit.prevent="onSubmit">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1" for="consultation-name">
                姓名 <span class="text-amber-500">*</span>
              </label>
              <input
                type="text"
                id="consultation-name"
                v-model="form.name"
                required
                maxlength="100"
                class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                placeholder="請輸入您的姓名"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1" for="consultation-phone">
                聯絡人電話 <span class="text-amber-500">*</span>
              </label>
              <input
                type="text"
                id="consultation-phone"
                v-model="form.phone"
                required
                maxlength="20"
                class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                placeholder="請輸入聯絡電話"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1" for="consultation-company">
                公司名稱
              </label>
              <input
                type="text"
                id="consultation-company"
                v-model="form.companyName"
                maxlength="200"
                class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                placeholder="請輸入公司名稱"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1" for="consultation-tax-id">
                統一編號
              </label>
              <input
                type="text"
                id="consultation-tax-id"
                v-model="form.taxId"
                maxlength="50"
                class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                placeholder="請輸入統一編號"
              />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-slate-700 mb-1" for="consultation-line-id">
                LINE ID
              </label>
              <input
                type="text"
                id="consultation-line-id"
                v-model="form.lineId"
                maxlength="100"
                class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                placeholder="請輸入 LINE ID"
              />
            </div>

            <div class="md:col-span-2">
              <h3 class="text-sm font-medium text-slate-700 mb-3">
                方便回電時間 <span class="text-amber-500">*</span>
              </h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  v-for="option in CALLBACK_TIME_OPTIONS"
                  :key="option.value"
                  class="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-300 bg-slate-50 cursor-pointer hover:border-blue-400 transition"
                >
                  <input
                    type="checkbox"
                    :checked="form.callbackTimes.includes(option.value)"
                    @change="toggleCallbackTime(option.value)"
                    class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 shrink-0"
                  />
                  <span class="text-base text-slate-700">{{ option.label }}</span>
                </label>
              </div>
            </div>

            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-slate-700 mb-1" for="consultation-message">
                想詢問的問題概述
              </label>
              <textarea
                id="consultation-message"
                v-model="form.message"
                maxlength="1000"
                rows="4"
                class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50"
                placeholder="請簡單描述您想詢問的問題或希望了解的服務內容"
              ></textarea>
            </div>
          </div>

          <p v-if="submitError" class="mt-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {{ submitError }}
          </p>

          <button
            type="submit"
            :disabled="isSubmitting"
            class="w-full mt-8 bg-blue-900 hover:bg-blue-800 text-white font-bold py-4 rounded-lg shadow-lg transition duration-300 transform hover:-translate-y-1 flex justify-center items-center disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <span v-if="isSubmitting">送出中...</span>
            <span v-else class="flex items-center">
              送出免費諮詢 <Icon name="tabler:arrow-right" class="ml-2" size="20" />
            </span>
          </button>
          <p class="text-xs text-slate-500 text-center mt-4">
            提交即表示您同意我們的服務條款與隱私政策。
          </p>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ConsultationApi } from "@/api/consultation";
import { CALLBACK_TIME_OPTIONS, type CallbackTime, type ConsultationCreatePayload } from "@/api/interface/consultation";

function emptyForm(): ConsultationCreatePayload {
  return {
    name: "",
    phone: "",
    companyName: "",
    taxId: "",
    lineId: "",
    callbackTimes: [],
    message: "",
  };
}

const form = ref<ConsultationCreatePayload>(emptyForm());
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);
const submitSuccess = ref(false);

// "隨時都可以" 與其他指定時段互斥：勾選 anytime 會清除其他選項，
// 勾選其他選項會自動取消 anytime。用明確 handler 而非 v-model 陣列綁定，
// 因為互斥規則需要攔截 toggle 行為，不能只是單純新增/移除。
function toggleCallbackTime(value: CallbackTime) {
  const times = form.value.callbackTimes;
  const idx = times.indexOf(value);
  if (idx > -1) {
    times.splice(idx, 1);
    return;
  }
  if (value === "anytime") {
    form.value.callbackTimes = ["anytime"];
  } else {
    form.value.callbackTimes = times.filter((t) => t !== "anytime").concat(value);
  }
}

async function onSubmit() {
  if (form.value.callbackTimes.length === 0) {
    submitError.value = "請至少選擇一個方便回電時間";
    return;
  }

  isSubmitting.value = true;
  submitError.value = null;

  const [err] = await ConsultationApi.submitConsultation({
    ...form.value,
    companyName: form.value.companyName || null,
    taxId: form.value.taxId || null,
    lineId: form.value.lineId || null,
    message: form.value.message || null,
  });

  isSubmitting.value = false;

  if (err) {
    submitError.value = err?.data?.message ?? "送出失敗，請稍後再試";
    return;
  }

  submitSuccess.value = true;
  form.value = emptyForm();
}
</script>
