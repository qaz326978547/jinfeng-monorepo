<template>
    <h3 class="mb-4 text-[30px]">報名資料</h3>
    <div class="rounded-md bg-white px-4 pb-[80px] pt-4">
        <ul>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] items-center">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">標題</p>
                    <textarea
                        class="ms-[10px] w-[calc(100%-120px)] rounded-md border-2 px-2"
                        v-model="name"
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
            @click="updateContactClassData"
        >
            更新資料
        </button>
    </div>
</template>

<script setup lang="ts">
import { SignedUpClassInfoApi } from '@/api/signedUpClass';
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import type { ContactClass } from '@/api/interface/signedUpClass';

definePageMeta({
    layout: 'admin'
});
useHead({
    meta: [{ name: 'robots', content: 'noindex' }]
});
const route = useRoute();

let name = ref<string>('');
let no = ref<number>(0);

const singleContactClass = ref<ContactClass | null>(null);

const getContactClassData = async () => {
    const res = await SignedUpClassInfoApi.getSingleContactClass(Number(route.params.id));
    if (res) {
        singleContactClass.value = res;
        name.value = res.name;
        no.value = res.no;
    }
};

const updateContactClassData = async () => {
    const data = {
        name: name.value,
        no: no.value
    };
    const res = await SignedUpClassInfoApi.UpdateContactClass(Number(route.params.id), data);
    if (res) {
        alert('更新成功');
    }
};

onMounted(() => {
    getContactClassData();
});
</script>

