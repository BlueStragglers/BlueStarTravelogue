<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TabBar from '@/components/ui/TabBar.vue'
import { useAppStore } from '@/stores/app'

const route = useRoute()
const store = useAppStore()

const showTabs = computed(() =>
  ['today', 'tracks', 'review', 'profile'].includes(String(route.name)),
)
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--with-tabs': showTabs }">
    <div class="page-bg" aria-hidden="true" />

    <main>
      <router-view v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </main>

    <TabBar v-if="showTabs" />

    <Transition name="toast">
      <div v-if="store.toast" class="toast" role="status">{{ store.toast }}</div>
    </Transition>
  </div>
</template>
