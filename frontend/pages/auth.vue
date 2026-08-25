<template>
    <div class="mx-[auto] my-[40px] w-[90%] max-w-[800px] rounded-xl border-2 border-[#ccc] text-center shadow-xl">
        <div class="mx-auto w-[80%] px-[20px] py-[40px]">
            <h2 class="mb-[48px] text-center text-[40px] font-bold text-black">
                <nuxt-link to="/"> JINFENG </nuxt-link>
            </h2>
            <div class="mb-[30px] flex items-center justify-center text-[20px]">
                <Icon name="octicon:person-24" class="text-[24px]" />
                <label class="me-4 whitespace-nowrap" for="account">帳號</label>
                <input class="mb-0 h-[35px] w-[300px] text-[14px]" type="text" id="account" v-model="loginData.email" />
            </div>
            <div class="mb-[30px] flex items-center justify-center text-[20px]">
                <Icon name="ph:lock-key-fill" class="text-[24px]" />
                <label class="me-4 whitespace-nowrap" for="password">密碼</label>
                <input class="mb-0 h-[35px] w-[300px] text-[14px]" type="text" id="password"
                    v-model="loginData.password" />
            </div>
            <button type="button" class="btn ml-[36px] w-[200px] bg-admin-primary py-2 text-white" @click="login">
                登入後台
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { AuthApi } from "@/api/auth";
import { useAuthStore } from "@/store/useAuthStore";
const router = useRouter();

const loginData = ref({
    email: "",
    password: "",
});

const login = async () => {
    try {
        console.log("嘗試登入...", loginData.value);
        const res = await AuthApi.login(loginData.value);
        console.log("登入回應:", res);

        if (res && res.token) {
            console.log("登入成功，正在導向 /admin/contact");
            // 確保 token 有設置到 store
            const authStore = useAuthStore();
            authStore.setToken(res.token);

            // 使用 nextTick 確保狀態更新後再導向
            await nextTick();
            await router.push("/admin/contact");
        } else {
            console.error("登入失敗：沒有收到有效的回應或 token");
            alert("登入失敗，請檢查帳號密碼");
        }
    } catch (error) {
        console.error("登入過程中發生錯誤:", error);
        alert("登入時發生錯誤，請稍後再試");
    }
};

definePageMeta({
    layout: false,
});

useHead({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }]
});
</script>
