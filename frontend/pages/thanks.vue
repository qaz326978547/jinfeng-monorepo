<template>
    <div class="flex flex-col items-center justify-center py-[80px]">
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24">
            <g fill="black">
                <path d="M10.243 16.314L6 12.07l1.414-1.414l2.829 2.828l5.656-5.657l1.415 1.415z" />
                <path
                    fill-rule="evenodd"
                    d="M1 12C1 5.925 5.925 1 12 1s11 4.925 11 11s-4.925 11-11 11S1 18.075 1 12m11 9a9 9 0 1 1 0-18a9 9 0 0 1 0 18"
                    clip-rule="evenodd"
                />
            </g>
        </svg>
        <h1 class="my-[20px] text-[30px]">我已收到您的報名資訊</h1>
        <p class="text-[30px]">感謝您的報名 !!</p>
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    layout: 'default'
});

useHead({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }]
});
</script>

