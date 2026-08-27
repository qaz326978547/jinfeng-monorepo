<template>
    <h3 class="mb-4 text-[30px]">新增 FAQ</h3>
    <div class="rounded-md bg-white px-4 pb-[80px] pt-4">
        <ul>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] items-center">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">問題</p>
                    <textarea
                        class="ms-[10px] w-[calc(100%-120px)] rounded-md border-2 px-2"
                        v-model="name"
                        rows="3"
                    ></textarea>
                </div>
            </li>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] items-center">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">回答</p>
                    <textarea
                        class="ms-[10px] w-[calc(100%-120px)] rounded-md border-2 px-2"
                        v-model="info"
                        rows="5"
                    ></textarea>
                </div>
            </li>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] items-center">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">排序</p>
                    <input type="text" class="ms-[10px] w-[calc(100%-120px)]" v-model="no" />
                </div>
            </li>
        </ul>
        <button
            class="btn mx-auto block w-1/2 bg-blue-500 hover:bg-primary sm:max-w-[300px]"
            @click="addFaqData"
        >
            新增資料
        </button>
    </div>
</template>

<script setup lang="ts">
import { FAQInfoApi } from '@/api/faq';
import { ref } from 'vue';

definePageMeta({
    layout: 'admin'
});
useHead({
    meta: [{ name: 'robots', content: 'noindex' }]
});

let name = ref<string>('');
let info = ref<string>('');
let no = ref<number>(0);

const addFaqData = async () => {
    const data = {
        name: name.value,
        info: info.value,
        no: Number(no.value)
    };
    const res = await FAQInfoApi.addFaq(data);
    if (res) {
        alert('新增成功');
        name.value = '';
        info.value = '';
        no.value = 0;
    }
};
</script>
