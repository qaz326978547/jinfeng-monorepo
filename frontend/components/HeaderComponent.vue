<template>
  <PrivacyModel v-model="showModel"></PrivacyModel>
  <header
    :class="showModel ? 'sm:bg-transparent' : 'sm:bg-white'"
    class="fixed left-0 right-0 top-0 z-50 bg-white py-6 transition-all duration-300 ease-linear shadow-md"
  >
    <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative" aria-label="主導覽">
      <div class="flex justify-between items-center">
        <!-- Logo -->
        <div class="flex-shrink-0">
          <nuxt-link
            to="/"
            class="text-xl md:text-2xl font-bold text-blue-900 tracking-wider"
          >
            金豐集團<span class="text-amber-500">.</span>
          </nuxt-link>
        </div>

        <!-- Desktop Menu -->
        <div class="hidden lg:flex space-x-6 items-center">
          <nuxt-link
            class="text-sm font-medium text-slate-600 hover:text-blue-900 transition duration-300"
            to="/#register"
          >
            勞動法務速成講座報名
          </nuxt-link>
          <nuxt-link
            class="text-sm font-medium text-slate-600 hover:text-blue-900 transition duration-300"
            to="/#services"
          >
            服務項目
          </nuxt-link>
          <nuxt-link
            class="text-sm font-medium text-slate-600 hover:text-blue-900 transition duration-300"
            to="/about"
          >
            關於我們
          </nuxt-link>
          <nuxt-link
            class="text-sm font-medium text-slate-600 hover:text-blue-900 transition duration-300"
            to="/labor-info"
          >
            勞資說明
          </nuxt-link>
          <nuxt-link
            class="text-sm font-medium text-slate-600 hover:text-blue-900 transition duration-300"
            to="/faq"
          >
            常見問題
          </nuxt-link>
          <button
            class="text-sm font-medium text-slate-600 hover:text-blue-900 transition duration-300"
            @click="openModel"
          >
            隱私政策
          </button>
          <nuxt-link
            to="/#register"
            class="bg-amber-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-amber-600 transition duration-300 shadow-md"
          >
            免費諮詢
          </nuxt-link>
        </div>

        <!-- Mobile Menu Button -->
        <div class="lg:hidden flex items-center">
          <button
            :aria-label="navToggle ? '關閉選單' : '開啟選單'"
            class="text-slate-600 hover:text-blue-900 focus:outline-none"
            @click="navToggle = !navToggle"
          >
            <Icon v-if="!navToggle" name="tabler:menu-2" width="28" height="28" />
            <Icon v-else name="tabler:x" width="28" height="28" />
          </button>
        </div>
      </div>

      <!-- Mobile Menu Dropdown -->
      <transition name="slide">
        <div
          v-if="navToggle"
          class="lg:hidden absolute top-full left-0 right-0 bg-white border-t border-slate-100 shadow-xl mt-2 rounded-b-lg"
        >
          <div class="px-4 py-3 space-y-1">
            <nuxt-link
              @click="navToggle = false"
              class="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-900 hover:bg-slate-50"
              to="/#register"
            >
              勞動法務速成講座報名
            </nuxt-link>
            <nuxt-link
              @click="navToggle = false"
              class="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-900 hover:bg-slate-50"
              to="/#services"
            >
              服務項目
            </nuxt-link>
            <nuxt-link
              @click="navToggle = false"
              class="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-900 hover:bg-slate-50"
              to="/about"
            >
              關於我們
            </nuxt-link>
            <nuxt-link
              @click="navToggle = false"
              class="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-900 hover:bg-slate-50"
              to="/labor-info"
            >
              勞資說明
            </nuxt-link>
            <nuxt-link
              @click="navToggle = false"
              class="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-900 hover:bg-slate-50"
              to="/faq"
            >
              F&Q
            </nuxt-link>
            <button
              @click="openModel"
              class="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-900 hover:bg-slate-50"
            >
              隱私政策
            </button>
            <nuxt-link
              @click="navToggle = false"
              class="block px-3 py-2 rounded-md text-base font-medium text-white bg-amber-500 hover:bg-amber-600 text-center"
              to="/#register"
            >
              免費諮詢
            </nuxt-link>
          </div>
        </div>
      </transition>
    </nav>
  </header>
</template>

<script setup lang="ts">
const navToggle = ref(false);

const route = useRoute();
const showModel = ref(false);

const openModel = () => {
  showModel.value = true;
  navToggle.value = false;
};

watch(
  () => route.fullPath,
  () => {
    navToggle.value = false;
  }
);
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}

.slide-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}
</style>
