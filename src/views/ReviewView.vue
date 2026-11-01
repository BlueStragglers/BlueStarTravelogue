<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { useLiveQuery } from '@/db/useLiveQuery'
import type { Day, Location, PhotoMeta } from '@/models/types'
import { formatDateShort, formatDistance } from '@/services/format'
import { startOfDay } from '@/services/util'
import HeroPanel from '@/components/ui/HeroPanel.vue'
import MetricChip from '@/components/ui/MetricChip.vue'
import SurfaceCard from '@/components/ui/SurfaceCard.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PhotoThumb from '@/components/ui/PhotoThumb.vue'

const DAY_MS = 24 * 60 * 60 * 1000

const router = useRouter()

const days = useLiveQuery(() => db.days.orderBy('date').reverse().toArray(), [] as Day[])
const locations = useLiveQuery(() => db.locations.toArray(), [] as Location[])
const photos = useLiveQuery(() => db.photos.toArray(), [] as PhotoMeta[])

const selection = ref(1)

function startOfWeek(timestamp: number): number {
  const date = new Date(timestamp)
  const day = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const filteredDays = computed(() => {
  const now = Date.now()
  if (selection.value === 0) {
    return days.value.slice(0, 1)
  }
  if (selection.value === 1) {
    const weekStart = startOfWeek(now)
    return days.value.filter((day) => day.date >= weekStart && day.date < weekStart + 7 * DAY_MS)
  }
  const current = new Date(now)
  return days.value.filter((day) => {
    const date = new Date(day.date)
    return date.getFullYear() === current.getFullYear() && date.getMonth() === current.getMonth()
  })
})

const scopeTitle = computed(() => {
  if (selection.value === 0) return '今日'
  if (selection.value === 1) return '本周'
  return '本月'
})

const heroTitle = computed(() => {
  if (selection.value === 0) return '把今天压成一页地图日记'
  if (selection.value === 1) return '这一周，走过的地方开始有了纹理'
  return '这个月的活动范围，像一张慢慢展开的地图'
})

const heroSubtitle = computed(() => {
  if (selection.value === 0) return '适合回看今天去了哪里，也适合检查照片和地点是否已经关联起来。'
  if (selection.value === 1) return '从常去地点到照片回忆，这里会慢慢形成你的生活节奏。'
  return '月视角更适合看行动范围、常去地点和带定位照片的积累。'
})

const totalDistance = computed(() =>
  filteredDays.value.reduce((sum, day) => sum + day.totalDistanceMeters, 0),
)

const totalPhotos = computed(() => filteredDays.value.reduce((sum, day) => sum + day.photoCount, 0))

const topLocations = computed(() =>
  [...locations.value]
    .filter((location) => location.visitCount > 0 || location.photoCount > 0)
    .sort((a, b) => {
      if (b.photoCount !== a.photoCount) return b.photoCount - a.photoCount
      return b.visitCount - a.visitCount
    })
    .slice(0, 5),
)

const scopeDayIds = computed(() => new Set(filteredDays.value.map((day) => day.id)))

const recentPhotos = computed(() =>
  photos.value.filter((photo) => photo.dayId != null && scopeDayIds.value.has(photo.dayId)),
)

const uniquePhotoDays = computed(
  () => new Set(recentPhotos.value.map((photo) => photo.dayId)).size,
)

const latestDay = computed(() => filteredDays.value[0])

function dayNumber(day: Day): number {
  return new Date(day.date).getDate()
}

function heatIntensity(day: Day): number {
  return Math.max(day.photoCount, day.visitCount)
}

function heatColor(day: Day): string {
  const intensity = heatIntensity(day)
  if (intensity <= 0) return 'rgba(140, 176, 201, 0.14)'
  if (intensity <= 2) return 'rgba(140, 176, 201, 0.28)'
  if (intensity <= 5) return 'rgba(140, 176, 201, 0.44)'
  return 'rgba(26, 82, 135, 0.56)'
}

const galleryQuery = computed(() => {
  if (selection.value === 0 && latestDay.value) {
    return { scope: 'day', id: latestDay.value.id }
  }
  return { scope: 'period', period: selection.value === 1 ? 'week' : 'month' }
})

function goDay(id: string) {
  router.push(`/day/${id}`)
}

function goLocation(id: string) {
  router.push(`/location/${id}`)
}

function goGallery() {
  router.push({ path: '/photos', query: galleryQuery.value })
}

function goPhoto(photoId: string) {
  router.push({ path: `/photo/${photoId}`, query: galleryQuery.value })
}
</script>

<template>
  <div class="page stack">
    <HeroPanel eyebrow="回顾" :title="heroTitle" :subtitle="heroSubtitle">
      <div class="segmented">
        <button
          class="segmented__btn"
          :class="{ 'segmented__btn--active': selection === 0 }"
          @click="selection = 0"
        >
          日
        </button>
        <button
          class="segmented__btn"
          :class="{ 'segmented__btn--active': selection === 1 }"
          @click="selection = 1"
        >
          周
        </button>
        <button
          class="segmented__btn"
          :class="{ 'segmented__btn--active': selection === 2 }"
          @click="selection = 2"
        >
          月
        </button>
      </div>
    </HeroPanel>

    <SurfaceCard title="记录热力">
      <template v-if="filteredDays.length > 0">
        <p class="text-secondary small">{{ scopeTitle }}的记录强度和照片数量</p>
        <div class="heatmap">
          <button
            v-for="day in filteredDays.slice(0, 21)"
            :key="day.id"
            class="heatmap__cell"
            :style="{ background: heatColor(day) }"
            @click="goDay(day.id)"
          >
            <span class="heatmap__day">{{ dayNumber(day) }}</span>
            <span class="heatmap__count">{{ heatIntensity(day) }}</span>
          </button>
        </div>
      </template>
      <EmptyState
        v-else
        icon="📅"
        title="这一段时间还没有记录"
        subtitle="同步照片或补录停留后，这里会形成连续的回顾视图。"
      />
    </SurfaceCard>

    <SurfaceCard :title="`${scopeTitle}摘要`">
      <div class="row row--wrap">
        <MetricChip :text="`活动 ${filteredDays.length} 天`" />
        <MetricChip :text="formatDistance(totalDistance)" />
        <MetricChip :text="`${totalPhotos} 张照片`" />
      </div>
    </SurfaceCard>

    <SurfaceCard title="常去地点">
      <template v-if="topLocations.length > 0">
        <div class="list">
          <button
            v-for="location in topLocations"
            :key="location.id"
            class="list-row"
            @click="goLocation(location.id)"
          >
            <div class="list-row__main">
              <div class="list-row__title">{{ location.name }}</div>
              <div class="list-row__sub">
                到访 {{ location.visitCount }} 次，照片 {{ location.photoCount }} 张
              </div>
            </div>
            <span class="list-row__chevron">›</span>
          </button>
        </div>
      </template>
      <EmptyState
        v-else
        icon="📍"
        title="还没有地点数据"
        subtitle="导入照片或补录停留后，这里会显示你最近常去的地点。"
      />
    </SurfaceCard>

    <SurfaceCard title="照片回忆">
      <template v-if="recentPhotos.length > 0">
        <p class="text-secondary small">
          最近 {{ recentPhotos.length }} 张定位照片来自 {{ uniquePhotoDays }} 天。
        </p>
        <div class="photo-strip">
          <button
            v-for="photo in recentPhotos.slice(0, 10)"
            :key="photo.id"
            class="photo-strip__item"
            @click="goPhoto(photo.id)"
          >
            <PhotoThumb :photo-id="photo.id" />
          </button>
        </div>
        <button class="btn btn--primary" @click="goGallery">查看这一周期的全部照片</button>
      </template>
      <EmptyState
        v-else
        icon="🖼️"
        title="这个周期还没有照片回忆"
        subtitle="导入带定位的照片后，这里会挑出最近的回忆入口。"
      />
    </SurfaceCard>

    <SurfaceCard title="精选日期">
      <template v-if="filteredDays.length > 0">
        <div class="list">
          <button
            v-for="day in filteredDays.slice(0, 5)"
            :key="day.id"
            class="list-row"
            @click="goDay(day.id)"
          >
            <div class="list-row__main">
              <div class="list-row__title">{{ formatDateShort(day.date) }}</div>
              <div class="list-row__sub">
                地点 {{ day.visitCount }} 个，照片 {{ day.photoCount }} 张
              </div>
            </div>
            <span class="list-row__chevron">→</span>
          </button>
        </div>
      </template>
      <EmptyState
        v-else
        icon="✨"
        title="还没有可回顾日期"
        subtitle="未来这里会成为你查看某一天行动轨迹的入口。"
      />
    </SurfaceCard>
  </div>
</template>
