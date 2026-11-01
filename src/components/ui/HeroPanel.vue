<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  subtitle?: string
}>()
</script>

<template>
  <section class="hero">
    <p class="hero__eyebrow">{{ eyebrow }}</p>
    <h1 class="hero__title">{{ title }}</h1>
    <p v-if="subtitle" class="hero__subtitle">{{ subtitle }}</p>
    <div v-if="$slots.default" class="hero__metrics">
      <slot />
    </div>
  </section>
</template>
