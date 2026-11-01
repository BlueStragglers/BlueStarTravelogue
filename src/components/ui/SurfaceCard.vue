<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <section class="card">
    <h2 v-if="title" class="card__title">{{ title }}</h2>
    <div class="card__body">
      <slot />
    </div>
  </section>
</template>
