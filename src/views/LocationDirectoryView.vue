<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { useLiveQuery } from '@/db/useLiveQuery'
import type { Location } from '@/models/types'
import { formatCoordinate } from '@/services/format'
import SurfaceCard from '@/components/ui/SurfaceCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'

const router = useRouter()
const search = ref('')

const locations = useLiveQuery(() => db.locations.toArray(), [] as Location[])

const filtered = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  const list = keyword
    ? locations.value.filter((location) => location.name.toLowerCase().includes(keyword))
    : locations.value
  return [...list].sort((a, b) => {
    if (b.photoCount !== a.photoCount) return b.photoCount - a.photoCount
    if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount
    return a.name.localeCompare(b.name, 'zh-CN')
  })
})

function goLocation(id: string) {
  router.push(`/location/${id}`)
}

function goEntry() {
  router.push('/entry')
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/profile')
  }
}
</script>

<template>
  <div class="page stack">
    <div class="topbar">
      <button class="topbar__back" @click="goBack">← 返回</button>
      <span class="topbar__title">地点管理</span>
    </div>

    <SurfaceCard title="全部地点">
      <SectionHeader
        title="地点是回忆的容器"
        subtitle="点进任意地点可以查看地图、照片与到访记录，也可以合并重复地点。"
      />
      <input v-model="search" class="input" placeholder="搜索地点名称" />
      <div class="row row--wrap">
        <span class="chip">共 {{ locations.length }} 个地点</span>
        <span class="chip">{{ locations.filter((l) => l.photoCount > 0).length }} 个有照片</span>
        <button class="btn btn--sm btn--primary" @click="goEntry">新建地点</button>
      </div>
    </SurfaceCard>

    <SurfaceCard v-if="filtered.length > 0">
      <div class="list">
        <button
          v-for="location in filtered"
          :key="location.id"
          class="list-row"
          @click="goLocation(location.id)"
        >
          <div class="list-row__main">
            <div class="list-row__title">{{ location.name }}</div>
            <div class="list-row__sub">
              到访 {{ location.visitCount }} 次 · 照片 {{ location.photoCount }} 张
              <template v-if="location.latitude !== 0 || location.longitude !== 0">
                · {{ formatCoordinate(location.latitude, location.longitude) }}
              </template>
            </div>
          </div>
          <span class="list-row__chevron">›</span>
        </button>
      </div>
    </SurfaceCard>

    <SurfaceCard v-else>
      <EmptyState
        icon="📍"
        title="还没有地点"
        subtitle="补录一段停留，或导入带定位的照片后，地点会自动出现。"
      />
      <button class="btn btn--primary" @click="goEntry">补录一个地点</button>
    </SurfaceCard>
  </div>
</template>
