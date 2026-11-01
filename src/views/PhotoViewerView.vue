<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '@/db'
import { useLiveQuery } from '@/db/useLiveQuery'
import type { Day, Location, PhotoMeta } from '@/models/types'
import { formatCoordinate, formatDateFull, formatTime } from '@/services/format'
import { deletePhoto } from '@/services/photoService'
import { filterPhotosByScope } from '@/services/photoScope'
import { useAppStore } from '@/stores/app'
import SurfaceCard from '@/components/ui/SurfaceCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import DetailBadge from '@/components/ui/DetailBadge.vue'
import PhotoThumb from '@/components/ui/PhotoThumb.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const photoId = computed(() => String(route.params.id))
const scope = computed(() => String(route.query.scope ?? 'period'))
const scopeId = computed(() => (route.query.id ? String(route.query.id) : null))
const period = computed(() => String(route.query.period ?? 'week'))

const photos = useLiveQuery(() => db.photos.toArray(), [] as PhotoMeta[])
const days = useLiveQuery(() => db.days.toArray(), [] as Day[])
const locations = useLiveQuery(() => db.locations.toArray(), [] as Location[])

const photo = computed<PhotoMeta | null>(
  () => photos.value.find((item) => item.id === photoId.value) ?? null,
)

const scopePhotos = computed(() =>
  filterPhotosByScope(photos.value, {
    scope: scope.value,
    id: scopeId.value,
    period: period.value,
  }),
)

const currentIndex = computed(() =>
  scopePhotos.value.findIndex((item) => item.id === photoId.value),
)

const prevPhoto = computed(() =>
  currentIndex.value > 0 ? scopePhotos.value[currentIndex.value - 1] : undefined,
)
const nextPhoto = computed(() =>
  currentIndex.value >= 0 && currentIndex.value < scopePhotos.value.length - 1
    ? scopePhotos.value[currentIndex.value + 1]
    : undefined,
)

const day = computed<Day | null>(() => {
  if (!photo.value?.dayId) return null
  return days.value.find((item) => item.id === photo.value?.dayId) ?? null
})

const location = computed<Location | null>(() => {
  if (!photo.value?.locationId) return null
  return locations.value.find((item) => item.id === photo.value?.locationId) ?? null
})

function goPhoto(nextId: string) {
  router.replace({ path: `/photo/${nextId}`, query: route.query })
}

function goBack() {
  router.push({ path: '/photos', query: route.query })
}

function goDay() {
  if (day.value) router.push(`/day/${day.value.id}`)
}

function goLocation() {
  if (location.value) router.push(`/location/${location.value.id}`)
}

async function removePhoto() {
  if (!photo.value) return
  const confirmed = window.confirm('确定要删除这张照片吗？')
  if (!confirmed) return
  await deletePhoto(photo.value.id)
  store.showToast('照片已删除')
  if (nextPhoto.value || prevPhoto.value) {
    goPhoto((nextPhoto.value ?? prevPhoto.value)!.id)
  } else {
    goBack()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft' && prevPhoto.value) goPhoto(prevPhoto.value.id)
  if (event.key === 'ArrowRight' && nextPhoto.value) goPhoto(nextPhoto.value.id)
  if (event.key === 'Escape') goBack()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="page stack">
    <div class="topbar">
      <button class="topbar__back" @click="goBack">← 照片列表</button>
      <span class="topbar__title">
        {{ currentIndex >= 0 ? `${currentIndex + 1} / ${scopePhotos.length}` : '照片' }}
      </span>
    </div>

    <template v-if="photo">
      <div class="viewer">
        <PhotoThumb :photo-id="photo.id" :alt="photo.fileName" full />
      </div>

      <div class="row row--between">
        <button class="btn btn--ghost" :disabled="!prevPhoto" @click="prevPhoto && goPhoto(prevPhoto.id)">
          ← 上一张
        </button>
        <button class="btn btn--ghost" :disabled="!nextPhoto" @click="nextPhoto && goPhoto(nextPhoto.id)">
          下一张 →
        </button>
      </div>

      <SurfaceCard title="照片信息">
        <div class="list">
          <div class="list-row" style="cursor: default">
            <div class="list-row__main">
              <div class="list-row__title">{{ photo.fileName }}</div>
              <div class="list-row__sub">
                {{ photo.width && photo.height ? `${photo.width} × ${photo.height}` : '尺寸未知' }}
                · {{ photo.mimeType }}
              </div>
            </div>
          </div>

          <div class="list-row" style="cursor: default">
            <div class="list-row__main">
              <div class="list-row__title">拍摄时间</div>
              <div class="list-row__sub">
                <template v-if="photo.creationDate">
                  {{ formatDateFull(photo.creationDate) }} {{ formatTime(photo.creationDate) }}
                </template>
                <template v-else>没有读取到拍摄时间</template>
              </div>
            </div>
          </div>

          <div class="list-row" style="cursor: default">
            <div class="list-row__main">
              <div class="list-row__title">定位</div>
              <div class="list-row__sub">
                <template v-if="photo.latitude != null && photo.longitude != null">
                  {{ formatCoordinate(photo.latitude, photo.longitude) }}
                </template>
                <template v-else>这张照片没有 GPS 信息</template>
              </div>
            </div>
          </div>
        </div>

        <div class="row row--wrap">
          <DetailBadge
            :icon="photo.latitude != null ? 'mappin.and.ellipse' : 'location.slash'"
            :text="photo.latitude != null ? '带定位' : '无定位'"
          />
          <button v-if="location" class="btn btn--sm btn--soft" @click="goLocation">
            {{ location.name }}
          </button>
          <button v-if="day" class="btn btn--sm btn--soft" @click="goDay">查看那一天</button>
        </div>
      </SurfaceCard>

      <button class="btn btn--danger" @click="removePhoto">删除这张照片</button>
    </template>

    <SurfaceCard v-else>
      <EmptyState icon="🖼️" title="照片不存在" subtitle="它可能已经被删除。" />
      <button class="btn btn--primary" @click="goBack">返回照片列表</button>
    </SurfaceCard>
  </div>
</template>

<style scoped>
.viewer {
  border-radius: 18px;
  overflow: hidden;
  background: #0b1727;
  border: 1px solid rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  max-height: 68vh;
}

.viewer :deep(.photo-thumb) {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 68vh;
  object-fit: contain;
}
</style>
