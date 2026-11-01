<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '@/db'
import { useLiveQuery } from '@/db/useLiveQuery'
import type { Day, Location, PhotoMeta } from '@/models/types'
import { formatDateShort, formatDayTitle } from '@/services/format'
import { filterPhotosByScope, parseDateKey } from '@/services/photoScope'
import { dateKey } from '@/services/util'
import SurfaceCard from '@/components/ui/SurfaceCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PhotoThumb from '@/components/ui/PhotoThumb.vue'

const route = useRoute()
const router = useRouter()

const scope = computed(() => String(route.query.scope ?? 'period'))
const scopeId = computed(() => (route.query.id ? String(route.query.id) : null))
const period = computed(() => String(route.query.period ?? 'week'))

const photos = useLiveQuery(() => db.photos.toArray(), [] as PhotoMeta[])
const days = useLiveQuery(() => db.days.toArray(), [] as Day[])
const locations = useLiveQuery(() => db.locations.toArray(), [] as Location[])

const filteredPhotos = computed(() =>
  filterPhotosByScope(photos.value, {
    scope: scope.value,
    id: scopeId.value,
    period: period.value,
  }),
)

const day = computed<Day | null>(() =>
  scopeId.value ? (days.value.find((item) => item.id === scopeId.value) ?? null) : null,
)

const location = computed<Location | null>(() =>
  scopeId.value ? (locations.value.find((item) => item.id === scopeId.value) ?? null) : null,
)

const titleText = computed(() => {
  if (scope.value === 'day') {
    return day.value ? `${formatDateShort(day.value.date)} 的照片` : '当天照片'
  }
  if (scope.value === 'location') {
    return location.value ? `${location.value.name} · 照片` : '地点照片'
  }
  return period.value === 'month' ? '本月照片' : '本周照片'
})

const subtitleText = computed(() => {
  if (scope.value === 'day' && day.value) return formatDayTitle(day.value.date)
  if (scope.value === 'location' && location.value) {
    return location.value.address || '按拍摄时间分组'
  }
  return '按拍摄日期分组，点开可查看大图'
})

interface PhotoGroup {
  key: string
  label: string
  photos: PhotoMeta[]
}

const groups = computed<PhotoGroup[]>(() => {
  const buckets = new Map<string, PhotoMeta[]>()
  for (const photo of filteredPhotos.value) {
    const timestamp = photo.creationDate ?? photo.importedAt
    const key = dateKey(timestamp)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.push(photo)
    } else {
      buckets.set(key, [photo])
    }
  }

  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, items]) => ({
      key,
      label: formatDateShort(parseDateKey(key)),
      photos: items,
    }))
})

function goPhoto(photoId: string) {
  router.push({ path: `/photo/${photoId}`, query: route.query })
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
      <span class="topbar__title">照片</span>
    </div>

    <SurfaceCard>
      <div class="row row--between">
        <div>
          <h1 class="section-title">{{ titleText }}</h1>
          <p class="section-sub">{{ subtitleText }}</p>
        </div>
        <span class="chip">共 {{ filteredPhotos.length }} 张</span>
      </div>
    </SurfaceCard>

    <template v-if="groups.length > 0">
      <SurfaceCard v-for="group in groups" :key="group.key" :title="group.label">
        <div class="photo-grid">
          <button
            v-for="photo in group.photos"
            :key="photo.id"
            class="photo-grid__item"
            @click="goPhoto(photo.id)"
          >
            <PhotoThumb :photo-id="photo.id" :alt="photo.fileName" />
          </button>
        </div>
      </SurfaceCard>
    </template>

    <SurfaceCard v-else>
      <EmptyState
        icon="🖼️"
        title="这个范围里还没有照片"
        subtitle="导入带定位的照片后，它们会按拍摄日期自动分组显示。"
      />
    </SurfaceCard>
  </div>
</template>
