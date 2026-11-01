<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '@/db'
import { useLiveQuery } from '@/db/useLiveQuery'
import type { Day, Location, PhotoMeta, Visit } from '@/models/types'
import { formatDayTitle, formatDistance, formatDuration, formatTime } from '@/services/format'
import { mapById, toLocationSnapshots } from '@/services/timeline'
import HeroPanel from '@/components/ui/HeroPanel.vue'
import MetricChip from '@/components/ui/MetricChip.vue'
import SurfaceCard from '@/components/ui/SurfaceCard.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PhotoThumb from '@/components/ui/PhotoThumb.vue'
import MapView from '@/components/map/MapView.vue'

const route = useRoute()
const router = useRouter()

const dayId = computed(() => String(route.params.id))

const days = useLiveQuery(() => db.days.toArray(), [] as Day[])
const visits = useLiveQuery(() => db.visits.orderBy('startAt').toArray(), [] as Visit[])
const locations = useLiveQuery(() => db.locations.toArray(), [] as Location[])
const photos = useLiveQuery(() => db.photos.toArray(), [] as PhotoMeta[])

const day = computed<Day | null>(() => days.value.find((item) => item.id === dayId.value) ?? null)
const locationsById = computed(() => mapById(locations.value))

const dayVisits = computed(() =>
  visits.value.filter((visit) => visit.dayId === dayId.value).sort((a, b) => a.startAt - b.startAt),
)

const dayLocations = computed(() => {
  const ids = new Set(dayVisits.value.map((visit) => visit.locationId))
  return locations.value.filter((location) => ids.has(location.id))
})

const mapLocations = computed(() => toLocationSnapshots(dayLocations.value))

const dayPhotos = computed(() =>
  photos.value
    .filter((photo) => photo.dayId === dayId.value)
    .sort((a, b) => (b.creationDate ?? 0) - (a.creationDate ?? 0)),
)

function locationName(locationId: string): string {
  return locationsById.value.get(locationId)?.name ?? '未知地点'
}

function goLocation(id: string) {
  router.push(`/location/${id}`)
}

function goGallery() {
  router.push({ path: '/photos', query: { scope: 'day', id: dayId.value } })
}

function goPhoto(photoId: string) {
  router.push({ path: `/photo/${photoId}`, query: { scope: 'day', id: dayId.value } })
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/today')
  }
}
</script>

<template>
  <div class="page stack">
    <div class="topbar">
      <button class="topbar__back" @click="goBack">← 返回</button>
      <span class="topbar__title">某日详情</span>
    </div>

    <template v-if="day">
      <HeroPanel
        eyebrow="某日详情"
        :title="formatDayTitle(day.date)"
        :subtitle="day.note || '这一天还没有写下备注。'"
      >
        <MetricChip :text="`${day.visitCount} 个地点`" />
        <MetricChip :text="formatDistance(day.totalDistanceMeters)" />
        <MetricChip :text="`${day.photoCount} 张照片`" />
      </HeroPanel>

      <SurfaceCard title="路线总览">
        <SectionHeader
          title="把当天的移动范围压进一张地图"
          subtitle="停留点和照片会沿着这条路线慢慢展开。"
        />
        <MapView v-if="mapLocations.length > 0" :locations="mapLocations" :height="220" />
        <EmptyState
          v-else
          icon="🗺️"
          title="当天还没有地图坐标"
          subtitle="补录带位置的停留后，这里会出现当天的地图。"
        />
      </SurfaceCard>

      <SurfaceCard title="时间线">
        <template v-if="dayVisits.length > 0">
          <SectionHeader
            title="一天的停留顺序"
            subtitle="每个节点都保留了地点、时长和照片数量。"
          />
          <div class="timeline">
            <button
              v-for="(visit, index) in dayVisits"
              :key="visit.id"
              class="timeline__item"
              @click="goLocation(visit.locationId)"
            >
              <span class="timeline__rail">
                <span class="timeline__dot" />
                <span v-if="index < dayVisits.length - 1" class="timeline__line" />
              </span>
              <span class="timeline__content">
                <span class="timeline__time">
                  {{ formatTime(visit.startAt) }} - {{ formatTime(visit.endAt) }}
                </span>
                <span class="timeline__title">{{ locationName(visit.locationId) }}</span>
                <span class="timeline__subtitle">
                  停留 {{ formatDuration(visit.duration) }}，{{ visit.note || '暂无备注' }}
                </span>
              </span>
              <span v-if="visit.photoCount > 0" class="chip">{{ visit.photoCount }} 张</span>
            </button>
          </div>
        </template>
        <EmptyState
          v-else
          icon="🕰️"
          title="当天还没有停留记录"
          subtitle="手动补录一段停留后，这里会展示真实时间线。"
        />
      </SurfaceCard>

      <SurfaceCard title="当天照片">
        <template v-if="dayPhotos.length > 0">
          <SectionHeader
            title="这一天留下来的画面"
            subtitle="带定位的照片会成为地图和回忆之间的桥。"
          />
          <div class="row row--wrap">
            <MetricChip :text="`共 ${dayPhotos.length} 张`" />
            <MetricChip text="按时间排序" />
          </div>
          <div class="photo-grid">
            <button
              v-for="photo in dayPhotos"
              :key="photo.id"
              class="photo-grid__item"
              @click="goPhoto(photo.id)"
            >
              <PhotoThumb :photo-id="photo.id" />
            </button>
          </div>
          <button class="btn btn--primary" @click="goGallery">查看全部当天照片</button>
        </template>
        <EmptyState
          v-else
          icon="🖼️"
          title="没有找到定位照片"
          subtitle="导入带定位的照片后，这里会展示当天关联的照片。"
        />
      </SurfaceCard>
    </template>

    <SurfaceCard v-else>
      <EmptyState
        icon="📅"
        title="没有找到这一天"
        subtitle="它可能已经被删除，或者链接不完整。"
      />
      <button class="btn btn--primary" @click="router.push('/today')">回到今天</button>
    </SurfaceCard>
  </div>
</template>
