<script setup lang="ts">
const tabs = [
  { to: '/today', label: '今天', icon: '☀️' },
  { to: '/tracks', label: '轨迹', icon: '🗺️' },
  { to: '/review', label: '回顾', icon: '📅' },
  { to: '/profile', label: '我的', icon: '👤' },
]
</script>

<template>
  <nav class="tabbar" aria-label="主导航">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="tabbar__link"
      active-class="tabbar__link--active"
    >
      <span class="tabbar__icon" aria-hidden="true">{{ tab.icon }}</span>
      <span>{{ tab.label }}</span>
    </RouterLink>
  </nav>
</template>
