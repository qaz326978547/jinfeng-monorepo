<template>
  <div class="min-h-screen bg-slate-50">
    <SignUpClassForm />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "default",
});

usePageSeo({
  title: "勞動法務速成講座報名｜金豐集團",
  description:
    "立即報名金豐集團勞動法務速成講座，協助企業老闆與人資主管掌握勞資爭議預防、工時工資認定與職業災害處理重點，請選擇場次並填寫報名資料。",
  path: "/labor-law-seminar",
});

useSchemaOrg(
  buildBreadcrumbSchema([
    { name: "首頁", path: "/" },
    { name: "勞動法務速成講座報名", path: "/labor-law-seminar" },
  ])
);
</script>
