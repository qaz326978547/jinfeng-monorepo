<template>
    <NuxtLayout>
        <div class="flex h-[60vh] flex-col items-center justify-center">
            <!-- 根据错误状态码显示不同内容 -->
            <template v-if="error.statusCode === 404">
                <h1 class="text-[48px] text-red-500">404!</h1>
                <p class="my-5">抱歉 找不到此頁面 請點選返回按鈕!</p>
                <!-- 返回首页按钮 -->
                <button @click="goHome" class="rounded-lg bg-red-500 px-3 py-2 text-white">返回首頁</button>
            </template>
            <template v-else>
                <h1>Oops!</h1>
                <p>
                    <strong>{{ error.message }}</strong>
                </p>
                <p>看起來好像出了點問題</p>
                <p>很抱歉!造成您的不便!</p>
                <!-- 返回首页按钮 -->
                <button @click="goHome" class="rounded-lg bg-red-500 px-3 py-2 text-white">返回首頁</button>
            </template>
        </div>
    </NuxtLayout>
</template>

<script setup>
const error = useError(); // 获取错误信息

const goHome = () => {
    clearError({
        // 清除错误并重定向到首页
        redirect: '/'
    });
};

defineProps({
    error: {
        type: Object,
        required: true
    }
});

definePageMeta({
    layout: ''
});
</script>

