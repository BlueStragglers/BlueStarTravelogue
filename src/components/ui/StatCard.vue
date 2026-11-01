<script setup lang="ts">
defineProps<{
  value: string
  label: string
  icon?: string
}>()
</script>

<template>
  <div class="stat">
    <span v-if="icon" class="stat__icon" aria-hidden="true">{{ icon }}</span>
    <span class="stat__value">{{ value }}</span>
    <span class="stat__label">{{ label }}</span>
  </div>
</template>

<style scoped>
.stat__icon {
  font-size: 15px;
}
</style>
