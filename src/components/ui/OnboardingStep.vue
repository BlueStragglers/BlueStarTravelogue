<script setup lang="ts">
defineProps<{
  index: number
  title: string
  subtitle: string
  done: boolean
}>()
</script>

<template>
  <div class="step">
    <span class="step__index" :class="{ 'step__index--done': done }" aria-hidden="true">
      {{ done ? '✓' : index }}
    </span>
    <div class="step__main">
      <div class="step__title">{{ title }}</div>
      <div class="step__sub">{{ subtitle }}</div>
    </div>
  </div>
</template>

<style scoped>
.step {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 18px;
  background: var(--surface-soft);
  border: 1px solid var(--stroke-card);
}

.step__index {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-muted);
  color: var(--accent-strong);
  font-size: 13px;
  font-weight: 700;
}

.step__index--done {
  background: var(--accent);
  color: #fff;
}

.step__main {
  min-width: 0;
}

.step__title {
  font-size: 14px;
  font-weight: 700;
}

.step__sub {
  margin-top: 3px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
}
</style>
