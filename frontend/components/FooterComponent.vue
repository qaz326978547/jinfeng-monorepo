<template>
  <footer class="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <!-- 公司資訊 -->
        <div>
          <h2 class="text-2xl font-bold text-white mb-4">
            金豐集團<span class="text-amber-500">.</span>
          </h2>
          <p class="text-sm mb-6">協助兩岸企業降低人事成本,創造勞資雙贏</p>

          <div class="mb-6">
            <p class="text-lg font-bold text-white mb-3 flex items-center">
              <Icon name="tabler:credit-card" class="mr-2" size="20" /> 轉帳繳款資訊
            </p>
            <ul class="space-y-2 text-sm">
              <li>匯款資訊：玉山銀行-北高雄分行</li>
              <li class="font-mono">帳號：0347-440-029556</li>
              <li>戶名：金豐企業管理顧問股份有限公司</li>
            </ul>
            <p class="text-xs text-slate-500 mt-3">
              ◎我們將提供金豐企業管理顧問股份有限公司發票
            </p>
          </div>

          <div class="text-xs text-slate-500">
            <p>*報名截止日期為講座前一週</p>
            <p>*報名截止日後不能退費，若要延期需加收延期費500/台北場需重新報名無法延期</p>
          </div>
        </div>

        <!-- 聯絡資訊 -->
        <div>
          <p class="text-lg font-bold text-white mb-3 flex items-center">
            <Icon name="tabler:phone" class="mr-2" size="20" /> 說明會報名表 - 報名專線
          </p>
          <ul class="space-y-2 text-sm">
            <li>聯絡人 : 吳冠璋 經理</li>
            <li class="flex gap-2">
              電話 :
              <a
                href="tel:0930532215"
                title="報名專線"
                target="_blank"
                class="hover:text-white transition"
                >0930532215</a
              >
              、
              <a
                href="tel:0916834966"
                title="報名專線"
                target="_blank"
                class="hover:text-white transition"
                >0916834966</a
              >
            </li>
            <li>
              電子信箱 :
              <a
                href="mailto:a0930532215@gmail.com"
                title="聯絡信箱:a0930532215@gmail.com"
                target="_blank"
                class="hover:text-white transition"
                >a0930532215@gmail.com</a
              >
            </li>
            <li>
              LINE :
              <a href="https://lin.ee/9MI6Yao" class="hover:text-white transition"
                >https://lin.ee/9MI6Yao</a
              >
            </li>
          </ul>
          <a
            href="https://lin.ee/9MI6Yao"
            title="掃描qrcode加入Line官方帳號"
            target="_blank"
            class="block mt-4"
          >
            <img
              class="h-32 w-32 rounded-lg"
              src="~/assets/img/QRcode.webp"
              alt="掃描qrcode加入Line官方帳號"
              width="200"
              height="200"
              loading="lazy"
            />
          </a>
        </div>
      </div>

      <!-- 底部版權 -->
      <div
        class="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center"
      >
        <div class="text-center md:text-left mb-4 md:mb-0">
          <p class="text-xs text-slate-600">
            &copy; {{ new Date().getFullYear() }} LaborService5690.com All rights
            reserved.
          </p>
        </div>
        <div class="flex space-x-6 text-sm">
          <a href="#" class="hover:text-white transition">隱私權政策</a>
          <a href="#" class="hover:text-white transition">服務條款</a>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts"></script>
