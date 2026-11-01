<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    icon?: string
  }>(),
  { icon: '✨' },
)
</script>

<template>
  <div class="empty">
    <div class="empty__icon" aria-hidden="true">{{ icon }}</div>
    <div class="empty__title">{{ title }}</div>
    <div v-if="subtitle" class="empty__sub">{{ subtitle }}</div>
  </div>
</template>
