<template>
    <h3 class="mb-4 text-[30px]">報名資料</h3>
    <div class="rounded-md bg-white px-4 pb-[80px] pt-4">
        <ul>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] items-center">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">報名課程</p>
                    <p class="ms-[10px] w-[calc(100%-120px)]" v-html="contactListData?.class"></p>
                </div>
            </li>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] items-center">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">公司名稱</p>
                    <p class="ms-[10px] w-[calc(100%-120px)]">{{ contactListData?.company }}</p>
                </div>
            </li>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] items-center">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">公司電話</p>
                    <p class="ms-[10px] w-[calc(100%-120px)]">{{ contactListData?.tel }}</p>
                </div>
            </li>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] items-center">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">主要問題</p>
                    <p class="ms-[10px] w-[calc(100%-120px)]">{{ contactListData?.quest }}</p>
                </div>
            </li>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] items-center">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">報名人數</p>
                    <p class="ms-[10px] w-[calc(100%-120px)]">{{ contactListData?.num }}</p>
                </div>
            </li>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] w-full items-center justify-between">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">參加人員名單</p>
                    <ul class="ms-[10px] w-[calc(100%-130px)] overflow-x-auto">
                        <li class="w-full">
                            <ul class="flex border-collapse text-center">
                                <li class="w-[10%] min-w-[30px] border-[1px] border-[#ccc] bg-[#eee]">編號</li>
                                <li class="w-[15%] min-w-[60px] border-[1px] border-[#ccc] bg-[#eee]">姓名</li>
                                <li class="w-[20%] min-w-[150px] border-[1px] border-[#ccc] bg-[#eee]">手機</li>
                                <li class="w-[15%] min-w-[120px] border-[1px] border-[#ccc] bg-[#eee]">職稱</li>
                                <li class="w-[40%] min-w-[250px] border-[1px] border-[#ccc] bg-[#eee]">e-mail</li>
                            </ul>
                        </li>
                        <li>
                            <ul
                                class="flex min-h-[40px] w-full text-center"
                                v-for="(info, idx) in contactListData?.contact_list"
                                :key="idx"
                            >
                                <li class="w-[10%] min-w-[30px] border-[1px] border-[#ccc]">
                                    {{ idx + 1 }}
                                </li>
                                <li class="w-[15%] min-w-[60px] border-[1px] border-[#ccc]">
                                    {{ info.name }}
                                </li>
                                <li class="w-[20%] min-w-[150px] border-[1px] border-[#ccc]">
                                    {{ info.cel }}
                                </li>
                                <li class="w-[15%] min-w-[120px] border-[1px] border-[#ccc]">
                                    {{ info.job }}
                                </li>
                                <li class="w-[40%] min-w-[250px] break-all border-[1px] border-[#ccc]">
                                    {{ info.email }}
                                </li>
                            </ul>
                        </li>
                    </ul>
                </div>
            </li>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] items-center">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">匯款後五碼</p>
                    <p class="ms-[10px] w-[calc(100%-120px)]">{{ contactListData?.last5 }}</p>
                </div>
            </li>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] items-center">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">發票種類</p>
                    <p class="ms-[10px] w-[calc(100%-120px)]">
                        {{ contactListData?.ticket == '2' ? '二聯式' : '三聯式' }}
                    </p>
                </div>
            </li>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] items-center">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">發票抬頭</p>
                    <p class="ms-[10px] w-[calc(100%-120px)]">
                        {{ contactListData?.ticket_name }}
                    </p>
                </div>
            </li>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] items-center">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">統一編號</p>
                    <p class="ms-[10px] w-[calc(100%-120px)]">{{ contactListData?.ticket_no }}</p>
                </div>
            </li>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] items-center">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">發票寄送地址</p>
                    <p class="ms-[10px] w-[calc(100%-120px)]">
                        {{ contactListData?.ticket_address }}
                    </p>
                </div>
            </li>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] items-center">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">得知講座管道</p>
                    <p class="ms-[10px] w-[calc(100%-120px)]">{{ contactListData?.from }}</p>
                </div>
            </li>
            <li class="rounded-t-md p-1">
                <div class="flex min-h-[40px] items-center">
                    <p class="w-[120px] border-r-2 border-[#AAA] pe-[10px] text-right">推薦人姓名</p>
                    <p class="ms-[10px] w-[calc(100%-120px)]">
                        {{ contactListData?.suggest_name }}
                    </p>
                </div>
            </li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import { SignedUpClassInfoApi } from '@/api/signedUpClass';
import { useAuthStore } from '@/store/useAuthStore';
import type { ContactListData } from '@/api/interface/signedUpClass';
definePageMeta({
    layout: 'admin'
});
useHead({
    meta: [{ name: 'robots', content: 'noindex' }]
});

const { token } = storeToRefs(useAuthStore());
const route = useRoute();

const contactListData = ref<ContactListData | null>(null);

const getContactListData = async () => {
    const res = await SignedUpClassInfoApi.getSingleContact(Number(route.params.id));
    if (res) {
        const formattedRes = res.class.replace(/,/g, '<br>');
        contactListData.value = { ...res, class: formattedRes };
    }
};

onMounted(() => {
    getContactListData();
});

//SSR
// const { data: contactData, refresh, error } = await useFetch<ContactData>(
//   "/admin/contact",
//   {
//     method: "GET",
//     query: { page: currentPage.value },
//     baseURL: apiBaseUrl.value,
//     headers: {
//       "Content-Type": "application/json",
//       "X-Requested-With": "XMLHttpRequest",
//       Authorization: "Bearer " + token.value || "",
//     },
//   }
// );
</script>

