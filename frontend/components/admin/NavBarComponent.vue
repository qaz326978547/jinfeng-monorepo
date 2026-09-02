<template>
    <div
        class="fixed bottom-0 left-0 top-0 z-50 w-[200px] bg-gradient-to-r from-gradient-left to-gradient-right px-4 py-5 transition-transform duration-500 ease-in-out"
        :class="showNavBar ? 'translate-x-0' : '-translate-x-full'"
    >
        <h2 class="mb-[48px] text-center text-[36px] font-bold text-white">
            <nuxt-link to="/"> JINFENG </nuxt-link>
        </h2>

        <ul>
            <li class="rounded-3xl text-center">
                <p class="rounded-t-md bg-admin-primary p-2 text-white">課程報名</p>
                <ul class="rounded-b-md bg-white p-2 text-admin-content">
                    <li class="my-2">
                        <nuxt-link class="py-2" to="/admin/contact"> 報名資料 </nuxt-link>
                    </li>
                    <li class="my-2">
                        <nuxt-link class="py-2" to="/admin/contact/contact_class"> 課程管理 </nuxt-link>
                    </li>
                    <li class="my-2">
                        <nuxt-link class="py-2" to="/admin/contact/contact_quest"> 問題管理 </nuxt-link>
                    </li>
                </ul>
            </li>
            <li class="mt-4 rounded-3xl text-center">
                <p class="rounded-t-md bg-admin-primary p-2 text-white">首頁設定</p>
                <ul class="rounded-b-md bg-white p-2 text-admin-content">
                    <li class="my-2">
                        <nuxt-link class="py-2" to="/admin/carousel"> 輪播圖管理 </nuxt-link>
                    </li>
                    <li class="my-2">
                        <nuxt-link class="py-2" to="/admin/labor-news"> 勞資 News 管理 </nuxt-link>
                    </li>
                </ul>
            </li>
        </ul>
        <button type="button" class="mt-4 w-full rounded-md bg-white py-2 text-admin-content" @click="logout">
            登出
        </button>
        <button
            @click="toggleModal"
            class="absolute right-[-40px] top-[40%] h-[40px] w-[40px] rounded-full bg-admin-primary text-[30px]"
        >
            <Icon class="text-white" name="ph:caret-left-fill" width="20" height="20" v-show="showNavBar === true" />
            <Icon class="text-white" name="ph:caret-right-fill" width="20" height="20" v-show="showNavBar === false" />
        </button>
    </div>
</template>

<script setup lang="ts">
import { AuthApi } from '@/api/auth';
import { useAuthStore } from '@/store/useAuthStore';

const showNavBar = ref(false);
const authStore = useAuthStore();

const emit = defineEmits(['update:showNavBar']);

watchEffect(() => {
    emit('update:showNavBar', showNavBar.value);
});

const toggleModal = () => {
    showNavBar.value = !showNavBar.value;
};

const logout = async () => {
    try {
        await AuthApi.logout();
    } finally {
        // Stateless JWT: the backend request above is best-effort. The real logout is
        // clearing the local token, and it must happen whether that request succeeded,
        // failed, or errored out entirely.
        authStore.setToken(null);
        await navigateTo('/auth');
    }
};
</script>

<style scoped>
.router-link-active {
    color: red;
}
</style>

