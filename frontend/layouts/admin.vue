<template>
    <div class="min-h-[100vh] bg-[#dae3f5]">
        <NavBarComponent v-model:showNavBar="showNavBar" />
        <div
            :class="showNavBar ? 'ml-0 w-full sm:ml-[200px] sm:w-[calc(100%-200px)]' : 'ml-0 w-full'"
            class="p-1 pb-[150px] sm:p-6"
        >
            <slot />
        </div>
        <LoadingComponet v-if="isLoading"></LoadingComponet>
    </div>
</template>

<script setup lang="ts">
import NavBarComponent from '~/components/admin/NavBarComponent.vue';
import { usePublicStore } from '~/store/usePublicStore';
const showNavBar = ref(true);
const { isLoading } = usePublicStore();
</script>

