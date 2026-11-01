<script setup lang="ts">
defineProps<{
  icon: string
  text: string
}>()
</script>

<template>
  <span class="badge">
    <span aria-hidden="true">{{ icon }}</span>
    <span>{{ text }}</span>
  </span>
</template>
