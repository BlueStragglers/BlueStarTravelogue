<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { useLiveQuery } from '@/db/useLiveQuery'
import type { Day, Location, MapLocationSnapshot } from '@/models/types'
import { composeDaySummary, toLocationSnapshots } from '@/services/timeline'
import HeroPanel from '@/components/ui/HeroPanel.vue'
import MetricChip from '@/components/ui/MetricChip.vue'
import SurfaceCard from '@/components/ui/SurfaceCard.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MapView from '@/components/map/MapView.vue'

const router = useRouter()

const locations = useLiveQuery(() => db.locations.toArray(), [] as Location[])
const days = useLiveQuery(() => db.days.orderBy('date').reverse().toArray(), [] as Day[])

const today = computed(() => days.value[0])
const summary = computed(() => composeDaySummary(today.value))

const sortedLocations = computed(() =>
  [...locations.value].sort((a, b) => {
    if (b.photoCount !== a.photoCount) return b.photoCount - a.photoCount
    return b.visitCount - a.visitCount
  }),
)

const mapLocations = computed(() => toLocationSnapshots(sortedLocations.value))

const selectedLocationId = ref<string | null>(null)

const selectedLocation = computed<Location | null>(() => {
  if (selectedLocationId.value) {
    return (
      sortedLocations.value.find((location) => location.id === selectedLocationId.value) ?? null
    )
  }
  return sortedLocations.value[0] ?? null
})

function onSelect(snapshot: MapLocationSnapshot) {
  selectedLocationId.value = snapshot.id
}

function goLocation(id: string) {
  router.push(`/location/${id}`)
}

function goGallery(id: string) {
  router.push({ path: '/photos', query: { scope: 'location', id } })
}

function goDay() {
  if (today.value) router.push(`/day/${today.value.id}`)
}
</script>

<template>
  <div class="page stack">
    <HeroPanel
      eyebrow="轨迹地图"
      title="把最近常去的地方摊开"
      subtitle="点地图上的地点标记，下面的卡片会切到对应位置，你就能从地图直接进入地点回忆。"
    >
      <MetricChip :text="`${locations.length} 个地点`" />
      <MetricChip :text="summary.distanceText" />
      <MetricChip :text="summary.photoCountText" />
    </HeroPanel>

    <div v-if="mapLocations.length > 0" class="map-wrap">
      <MapView
        :locations="mapLocations"
        :height="460"
        :selected-id="selectedLocation?.id ?? null"
        @select="onSelect"
      />
      <div v-if="selectedLocation" class="map-overlay-card">
        <div class="row row--between">
          <div>
            <div class="list-row__title">{{ selectedLocation.name }}</div>
            <div class="list-row__sub">
              到访 {{ selectedLocation.visitCount }} 次 · 照片 {{ selectedLocation.photoCount }} 张
            </div>
          </div>
          <span class="badge">{{ selectedLocation.photoCount > 0 ? '有照片' : '无照片' }}</span>
        </div>
        <div class="row row--wrap" style="margin-top: 10px">
          <button class="btn btn--sm btn--primary" @click="goLocation(selectedLocation.id)">
            查看地点详情
          </button>
          <button
            class="btn btn--sm btn--ghost"
            :disabled="selectedLocation.photoCount === 0"
            @click="goGallery(selectedLocation.id)"
          >
            查看地点照片
          </button>
        </div>
      </div>
    </div>
    <SurfaceCard v-else>
      <EmptyState
        icon="🗺️"
        title="还没有可显示的地点"
        subtitle="补录带位置的停留，或导入带定位的照片后，地图会自动出现。"
      />
    </SurfaceCard>

    <SurfaceCard title="地图切换">
      <SectionHeader
        title="快速切到别的地点"
        subtitle="如果地图上的点比较密，可以直接从这里换一个地点查看。"
      />
      <div v-if="sortedLocations.length > 0" class="row row--wrap">
        <button
          v-for="location in sortedLocations"
          :key="location.id"
          class="chip chip--button"
          :class="{ 'chip--active': location.id === selectedLocation?.id }"
          @click="selectedLocationId = location.id"
        >
          {{ location.name }}
        </button>
      </div>
      <p v-else class="text-secondary small">还没有地点记录。</p>
    </SurfaceCard>

    <SurfaceCard title="今日摘要">
      <div class="row row--wrap">
        <MetricChip :text="summary.visitCountText" />
        <MetricChip :text="summary.distanceText" />
        <MetricChip :text="summary.photoCountText" />
      </div>
      <p class="text-secondary small">
        地图主视图负责帮你找到地点，按进去之后就回到某个地点自己的地图、到访记录和照片。
      </p>
      <button class="btn btn--ghost" @click="goDay">查看今日详情</button>
    </SurfaceCard>
  </div>
</template>

<style scoped>
.map-wrap {
  position: relative;
}
</style>
