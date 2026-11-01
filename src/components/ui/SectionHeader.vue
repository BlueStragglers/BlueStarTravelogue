<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div>
    <h3 class="section-title">{{ title }}</h3>
    <p v-if="subtitle" class="section-sub">{{ subtitle }}</p>
  </div>
</template>
