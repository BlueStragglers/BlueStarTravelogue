<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <span class="chip">{{ text }}</span>
</template>
