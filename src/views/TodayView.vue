<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { useLiveQuery } from '@/db/useLiveQuery'
import type { Day, Location, MapLocationSnapshot, PhotoMeta, Visit } from '@/models/types'
import { seedDemoData } from '@/services/seed'
import {
  composeDaySummary,
  composeTimeline,
  mapById,
  toLocationSnapshots,
} from '@/services/timeline'
import { useAppStore } from '@/stores/app'
import { usePhotoImport } from '@/composables/usePhotoImport'
import HeroPanel from '@/components/ui/HeroPanel.vue'
import MetricChip from '@/components/ui/MetricChip.vue'
import SurfaceCard from '@/components/ui/SurfaceCard.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import OnboardingStep from '@/components/ui/OnboardingStep.vue'
import PhotoThumb from '@/components/ui/PhotoThumb.vue'
import MapView from '@/components/map/MapView.vue'

const router = useRouter()
const store = useAppStore()
const { fileInput, openPicker, handleFiles } = usePhotoImport()

const days = useLiveQuery(() => db.days.orderBy('date').reverse().toArray(), [] as Day[])
const visits = useLiveQuery(() => db.visits.orderBy('startAt').toArray(), [] as Visit[])
const locations = useLiveQuery(() => db.locations.toArray(), [] as Location[])
const photos = useLiveQuery(() => db.photos.toArray(), [] as PhotoMeta[])

const day = computed(() => days.value[0])
const summary = computed(() => composeDaySummary(day.value))
const locationsById = computed(() => mapById(locations.value))

const todaysVisits = computed(() => {
  const current = day.value
  if (!current) return []
  return visits.value.filter((visit) => visit.dayId === current.id)
})

const todaysLocations = computed(() => {
  const ids = new Set(todaysVisits.value.map((visit) => visit.locationId))
  return locations.value.filter((location) => ids.has(location.id))
})

const mapLocations = computed(() => toLocationSnapshots(todaysLocations.value))
const timelineItems = computed(() => composeTimeline(todaysVisits.value, locationsById.value))

const todaysPhotos = computed(() => {
  const current = day.value
  if (!current) return []
  return photos.value.filter((photo) => photo.dayId === current.id)
})

const selectedLocationId = ref<string | null>(null)

const selectedLocation = computed<Location | null>(() => {
  if (selectedLocationId.value) {
    return (
      todaysLocations.value.find((location) => location.id === selectedLocationId.value) ?? null
    )
  }
  return todaysLocations.value[0] ?? null
})

function onSelectLocation(snapshot: MapLocationSnapshot) {
  selectedLocationId.value = snapshot.id
}

function goDayDetail() {
  if (day.value) router.push(`/day/${day.value.id}`)
}

function goLocationDetail(id: string) {
  router.push(`/location/${id}`)
}

function goTodayPhotos() {
  if (!day.value) return
  router.push({ path: '/photos', query: { scope: 'day', id: day.value.id } })
}

function goEntry() {
  router.push('/entry')
}

async function loadDemo() {
  await seedDemoData()
  store.showToast('已载入示例数据，可以开始探索地图与时间线')
}
</script>

<template>
  <div class="page stack">
    <HeroPanel
      eyebrow="蓝星旅记"
      :title="summary.title"
      :subtitle="summary.subtitle"
    >
      <MetricChip :text="summary.visitCountText" />
      <MetricChip :text="summary.distanceText" />
      <MetricChip :text="summary.photoCountText" />
    </HeroPanel>

    <SurfaceCard v-if="store.lastImportMessage" title="照片导入">
      <div class="row row--between">
        <span class="text-secondary small">{{ store.lastImportMessage }}</span>
        <button class="btn btn--sm btn--ghost" @click="store.lastImportMessage = null">收起</button>
      </div>
      <div v-if="store.importing && store.importProgress" class="stack">
        <div class="progress">
          <div
            class="progress__bar"
            :style="{ width: `${(store.importProgress.done / Math.max(1, store.importProgress.total)) * 100}%` }"
          />
        </div>
        <span class="tiny text-muted">
          正在处理 {{ store.importProgress.done }} / {{ store.importProgress.total }}
        </span>
      </div>
    </SurfaceCard>

    <SurfaceCard v-if="photos.length === 0" title="第一次使用">
      <SectionHeader
        title="把真实照片和地点回忆接起来"
        subtitle="导入带定位的照片后，蓝星旅记会自动把它们归到对应日期、地点和停留上。"
      />
      <OnboardingStep
        :index="1"
        title="导入照片"
        subtitle="选择手机或电脑里的照片，支持一次多选。"
        :done="photos.length > 0"
      />
      <OnboardingStep
        :index="2"
        title="读取定位信息"
        subtitle="App 会从照片 EXIF 中读取 GPS 与拍摄时间。"
        :done="photos.some((photo) => photo.latitude != null)"
      />
      <OnboardingStep
        :index="3"
        title="自动归属"
        subtitle="照片会自动落到日期、最近地点和对应停留上。"
        :done="photos.some((photo) => photo.locationId != null)"
      />
      <div class="row row--wrap">
        <button class="btn btn--primary" :disabled="store.importing" @click="openPicker">
          {{ store.importing ? '正在导入…' : '导入定位照片' }}
        </button>
        <button class="btn btn--ghost" @click="loadDemo">载入示例数据</button>
      </div>
    </SurfaceCard>

    <SurfaceCard title="今日摘要">
      <SectionHeader
        title="把今天走过的路，安静地收好"
        subtitle="地图、停留、照片会在这里汇成一天的回顾。"
      />
      <div class="row row--wrap">
        <MetricChip :text="summary.visitCountText" />
        <MetricChip :text="summary.distanceText" />
        <MetricChip :text="summary.photoCountText" />
      </div>
    </SurfaceCard>

    <SurfaceCard title="今日地图">
      <SectionHeader
        title="点地图上的地点，直接回到今天的片段"
        subtitle="地图会把今天的停留和照片压成几个清晰的入口。"
      />
      <div class="map-wrap">
        <MapView
          v-if="mapLocations.length > 0"
          :locations="mapLocations"
          :height="260"
          :selected-id="selectedLocation?.id ?? null"
          @select="onSelectLocation"
        />
        <EmptyState
          v-else
          icon="🗺️"
          title="今天还没有地点坐标"
          subtitle="补录一段带位置的停留，或导入带定位的照片后，地图就会亮起来。"
        />

        <div v-if="selectedLocation" class="map-overlay-card">
          <div class="row row--between">
            <div>
              <div class="list-row__title">{{ selectedLocation.name }}</div>
              <div class="list-row__sub">
                到访 {{ selectedLocation.visitCount }} 次 · 照片
                {{ selectedLocation.photoCount }} 张
              </div>
            </div>
            <span class="badge">{{ selectedLocation.photoCount > 0 ? '有照片' : '停留点' }}</span>
          </div>
          <div class="row row--wrap" style="margin-top: 10px">
            <button class="btn btn--sm btn--primary" @click="goLocationDetail(selectedLocation.id)">
              地点详情
            </button>
            <button class="btn btn--sm btn--ghost" @click="goLocationDetail(selectedLocation.id)">
              地点照片
            </button>
          </div>
        </div>
      </div>

      <div v-if="todaysLocations.length > 1" class="row row--wrap">
        <button
          v-for="location in todaysLocations"
          :key="location.id"
          class="chip chip--button"
          :class="{ 'chip--active': location.id === selectedLocation?.id }"
          @click="selectedLocationId = location.id"
        >
          {{ location.name }}
        </button>
      </div>
    </SurfaceCard>

    <SurfaceCard title="今日时间线">
      <SectionHeader
        title="从早到晚的停留轨迹"
        subtitle="每个节点都可以继续展开成更完整的一天。"
      />
      <div v-if="timelineItems.length > 0" class="timeline">
        <button
          v-for="(item, index) in timelineItems"
          :key="item.id"
          class="timeline__item"
          @click="goDayDetail"
        >
          <span class="timeline__rail">
            <span class="timeline__dot" />
            <span v-if="index < timelineItems.length - 1" class="timeline__line" />
          </span>
          <span class="timeline__content">
            <span class="timeline__time">{{ item.timeText }}</span>
            <span class="timeline__title">{{ item.title }}</span>
            <span class="timeline__subtitle">{{ item.subtitle }}</span>
          </span>
          <span v-if="item.photoCount > 0" class="chip">{{ item.photoCount }} 张</span>
        </button>
      </div>
      <EmptyState
        v-else
        icon="🕰️"
        title="今天还没有停留记录"
        subtitle="补录一段停留，或导入带定位的照片后，这里会形成时间线。"
      />
    </SurfaceCard>

    <SurfaceCard title="今日照片">
      <SectionHeader
        title="地图上的回忆入口"
        subtitle="定位照片会让地点从坐标变成真正有内容的回忆。"
      />
      <template v-if="todaysPhotos.length > 0">
        <div class="photo-strip">
          <RouterLink
            v-for="photo in todaysPhotos.slice(0, 12)"
            :key="photo.id"
            class="photo-strip__item"
            :to="{ path: `/photo/${photo.id}`, query: { scope: 'day', id: day?.id } }"
          >
            <PhotoThumb :photo-id="photo.id" />
          </RouterLink>
        </div>
        <div class="row row--wrap">
          <button class="btn btn--primary" @click="goTodayPhotos">查看今日照片</button>
          <button class="btn btn--ghost" :disabled="store.importing" @click="openPicker">
            继续导入
          </button>
        </div>
      </template>
      <template v-else>
        <p class="text-secondary small">
          还没有照片。导入带定位的照片后，这里会自动出现今天的回忆。
        </p>
        <div class="row row--wrap">
          <button class="btn btn--primary" :disabled="store.importing" @click="openPicker">
            导入照片
          </button>
          <button class="btn btn--ghost" @click="goTodayPhotos">查看今日照片</button>
        </div>
      </template>
    </SurfaceCard>

    <div class="row row--wrap">
      <button class="btn btn--primary" @click="goEntry">补录一段停留</button>
      <button class="btn btn--ghost" @click="goDayDetail">查看今日详情</button>
    </div>

    <input
      ref="fileInput"
      class="hidden-input"
      type="file"
      accept="image/*"
      multiple
      @change="handleFiles"
    />
  </div>
</template>

<style scoped>
.map-wrap {
  position: relative;
}
</style>
