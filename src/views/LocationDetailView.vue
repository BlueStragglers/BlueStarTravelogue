<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '@/db'
import { useLiveQuery } from '@/db/useLiveQuery'
import type { Day, Location, PhotoMeta, Visit } from '@/models/types'
import { formatDateShort, formatDuration, formatTime } from '@/services/format'
import { deleteLocation, mergeLocations } from '@/services/photoService'
import { toLocationSnapshots } from '@/services/timeline'
import { useAppStore } from '@/stores/app'
import HeroPanel from '@/components/ui/HeroPanel.vue'
import MetricChip from '@/components/ui/MetricChip.vue'
import SurfaceCard from '@/components/ui/SurfaceCard.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import DetailBadge from '@/components/ui/DetailBadge.vue'
import PhotoThumb from '@/components/ui/PhotoThumb.vue'
import MapView from '@/components/map/MapView.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const locationId = computed(() => String(route.params.id))

const locations = useLiveQuery(() => db.locations.toArray(), [] as Location[])
const visits = useLiveQuery(() => db.visits.orderBy('startAt').reverse().toArray(), [] as Visit[])
const days = useLiveQuery(() => db.days.toArray(), [] as Day[])
const photos = useLiveQuery(() => db.photos.toArray(), [] as PhotoMeta[])

const location = computed<Location | null>(
  () => locations.value.find((item) => item.id === locationId.value) ?? null,
)

const daysById = computed(() => new Map(days.value.map((day) => [day.id, day])))

const locationVisits = computed(() =>
  visits.value.filter((visit) => visit.locationId === locationId.value),
)

const locationPhotos = computed(() =>
  photos.value
    .filter((photo) => photo.locationId === locationId.value)
    .sort((a, b) => (b.creationDate ?? 0) - (a.creationDate ?? 0)),
)

const totalStay = computed(() =>
  locationVisits.value.reduce((sum, visit) => sum + visit.duration, 0),
)

const mapLocations = computed(() => (location.value ? toLocationSnapshots([location.value]) : []))

const showMerge = ref(false)
const mergeTargetId = ref('')

const mergeCandidates = computed(() =>
  locations.value.filter((item) => item.id !== locationId.value),
)

async function confirmMerge() {
  if (!mergeTargetId.value || !location.value) return
  const target = locations.value.find((item) => item.id === mergeTargetId.value)
  if (!target) return
  const confirmed = window.confirm(
    `确定把「${location.value.name}」合并到「${target.name}」吗？相关停留和照片归属会一起迁移。`,
  )
  if (!confirmed) return
  await mergeLocations(locationId.value, mergeTargetId.value)
  showMerge.value = false
  store.showToast(`已合并到「${target.name}」`)
  router.replace(`/location/${target.id}`)
}

async function removeLocation() {
  if (!location.value) return
  const confirmed = window.confirm(
    `确定删除「${location.value.name}」吗？相关停留也会一并删除。`,
  )
  if (!confirmed) return
  await deleteLocation(locationId.value)
  store.showToast('地点已删除')
  router.replace('/locations')
}

function goDay(dayId: string) {
  router.push(`/day/${dayId}`)
}

function goGallery() {
  router.push({ path: '/photos', query: { scope: 'location', id: locationId.value } })
}

function goPhoto(photoId: string) {
  router.push({ path: `/photo/${photoId}`, query: { scope: 'location', id: locationId.value } })
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/tracks')
  }
}
</script>

<template>
  <div class="page stack">
    <div class="topbar">
      <button class="topbar__back" @click="goBack">← 返回</button>
      <span class="topbar__title">地点详情</span>
    </div>

    <template v-if="location">
      <HeroPanel
        eyebrow="地点详情"
        :title="location.name"
        :subtitle="location.address || '还没有补充地址。'"
      >
        <MetricChip :text="`到访 ${locationVisits.length} 次`" />
        <MetricChip :text="`累计停留 ${formatDuration(totalStay)}`" />
        <MetricChip :text="`照片 ${locationPhotos.length} 张`" />
      </HeroPanel>

      <SurfaceCard title="地点地图">
        <MapView v-if="mapLocations.length > 0" :locations="mapLocations" :height="230" />
        <EmptyState
          v-else
          icon="🗺️"
          title="这个地点还没有坐标"
          subtitle="在手动补录里为它选一个位置，它就会出现在地图上。"
        />
        <div class="row row--wrap">
          <DetailBadge
            :icon="location.latitude === 0 && location.longitude === 0 ? 'location.slash' : 'mappin.and.ellipse'"
            :text="
              location.latitude === 0 && location.longitude === 0
                ? '暂无坐标'
                : `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
            "
          />
          <DetailBadge icon="target" :text="`匹配半径 ${location.radiusMeters} m`" />
        </div>
      </SurfaceCard>

      <SurfaceCard title="地点照片">
        <template v-if="locationPhotos.length > 0">
          <SectionHeader
            title="在这里留下的画面"
            subtitle="照片按拍摄时间从近到远排列。"
          />
          <div class="photo-grid">
            <button
              v-for="photo in locationPhotos"
              :key="photo.id"
              class="photo-grid__item"
              @click="goPhoto(photo.id)"
            >
              <PhotoThumb :photo-id="photo.id" />
            </button>
          </div>
          <button class="btn btn--primary" @click="goGallery">查看地点全部照片</button>
        </template>
        <EmptyState
          v-else
          icon="🖼️"
          title="这个地点还没有照片"
          subtitle="导入带定位的照片后，符合范围的照片会自动归到这里。"
        />
      </SurfaceCard>

      <SurfaceCard title="最近到访">
        <template v-if="locationVisits.length > 0">
          <div class="list">
            <button
              v-for="visit in locationVisits.slice(0, 10)"
              :key="visit.id"
              class="list-row"
              @click="goDay(visit.dayId)"
            >
              <div class="list-row__main">
                <div class="list-row__title">
                  {{ daysById.get(visit.dayId) ? formatDateShort(daysById.get(visit.dayId)!.date) : '某一天' }}
                </div>
                <div class="list-row__sub">
                  {{ formatTime(visit.startAt) }} - {{ formatTime(visit.endAt) }} ·
                  停留 {{ formatDuration(visit.duration) }}
                  <template v-if="visit.note"> · {{ visit.note }}</template>
                </div>
              </div>
              <span class="list-row__chevron">›</span>
            </button>
          </div>
        </template>
        <EmptyState v-else icon="🕰️" title="还没有到访记录" />
      </SurfaceCard>

      <SurfaceCard title="整理地点">
        <SectionHeader
          title="合并或删除"
          subtitle="如果同一个地方被记录成了多个地点，可以合并它们。"
        />
        <div class="row row--wrap">
          <button class="btn btn--ghost" :disabled="mergeCandidates.length === 0" @click="showMerge = !showMerge">
            {{ showMerge ? '取消合并' : '合并到其他地点' }}
          </button>
          <button class="btn btn--danger" @click="removeLocation">删除这个地点</button>
        </div>

        <div v-if="showMerge" class="stack" style="margin-top: 12px">
          <label class="field">
            <span class="field__label">选择目标地点</span>
            <select v-model="mergeTargetId" class="input">
              <option value="">请选择…</option>
              <option v-for="item in mergeCandidates" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </select>
          </label>
          <button class="btn btn--primary" :disabled="!mergeTargetId" @click="confirmMerge">
            确认合并
          </button>
        </div>
      </SurfaceCard>
    </template>

    <SurfaceCard v-else>
      <EmptyState icon="📍" title="没有找到这个地点" subtitle="它可能已经被合并或删除。" />
      <button class="btn btn--primary" @click="router.push('/locations')">返回地点管理</button>
    </SurfaceCard>
  </div>
</template>
