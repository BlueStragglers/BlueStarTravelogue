<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { useLiveQuery } from '@/db/useLiveQuery'
import type { Day, Location, MovementMode } from '@/models/types'
import { MOVEMENT_MODES } from '@/models/types'
import { getCurrentPosition } from '@/services/geolocation'
import { assignPhotos } from '@/services/photoService'
import { newId, startOfDay } from '@/services/util'
import { useAppStore } from '@/stores/app'
import HeroPanel from '@/components/ui/HeroPanel.vue'
import MetricChip from '@/components/ui/MetricChip.vue'
import SurfaceCard from '@/components/ui/SurfaceCard.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import DetailBadge from '@/components/ui/DetailBadge.vue'
import MapView from '@/components/map/MapView.vue'

const router = useRouter()
const store = useAppStore()

const now = Date.now()

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toDateInput(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toTimeInput(timestamp: number): string {
  const date = new Date(timestamp)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function combine(dateValue: string, timeValue: string): number {
  const [year, month, day] = dateValue.split('-').map(Number)
  const [hour, minute] = timeValue.split(':').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, 0, 0).getTime()
}

const days = useLiveQuery(() => db.days.toArray(), [] as Day[])
const locations = useLiveQuery(() => db.locations.toArray(), [] as Location[])

const dateValue = ref(toDateInput(now))
const startValue = ref(toTimeInput(now))
const endValue = ref(toTimeInput(now + 60 * 60 * 1000))
const locationName = ref('')
const address = ref('')
const note = ref('')
const mode = ref<MovementMode>('walking')
const coordinate = ref<{ latitude: number; longitude: number } | null>(null)
const locating = ref(false)
const saving = ref(false)
const errorMessage = ref('')

const suggestedLocations = computed(() => {
  const keyword = locationName.value.trim().toLowerCase()
  if (!keyword) return locations.value.slice(0, 4)
  return locations.value
    .filter((location) => location.name.toLowerCase().includes(keyword))
    .slice(0, 4)
})

const canSave = computed(
  () => locationName.value.trim().length > 0 && !saving.value,
)

function applySuggestion(location: Location) {
  locationName.value = location.name
  if (location.address) address.value = location.address
  if (location.latitude !== 0 || location.longitude !== 0) {
    coordinate.value = { latitude: location.latitude, longitude: location.longitude }
  }
}

function onPick(point: { latitude: number; longitude: number }) {
  coordinate.value = point
}

async function locate() {
  locating.value = true
  errorMessage.value = ''
  try {
    const position = await getCurrentPosition()
    coordinate.value = { latitude: position.latitude, longitude: position.longitude }
    store.showToast('已定位到当前位置')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    locating.value = false
  }
}

async function save() {
  errorMessage.value = ''
  const name = locationName.value.trim()
  if (!name) {
    errorMessage.value = '请输入地点名称'
    return
  }

  const startAt = combine(dateValue.value, startValue.value)
  const endAt = Math.max(combine(dateValue.value, endValue.value), startAt)
  const dayDate = startOfDay(startAt)

  const existingDay = days.value.find((day) => startOfDay(day.date) === dayDate)
  const existingLocation = locations.value.find(
    (location) => location.name.toLowerCase() === name.toLowerCase(),
  )

  const timestamp = Date.now()
  const dayId = existingDay?.id ?? newId()
  const locationId = existingLocation?.id ?? newId()
  const visitId = newId()

  saving.value = true
  try {
    await db.transaction('rw', db.days, db.locations, db.visits, async () => {
      if (!existingDay) {
        await db.days.add({
          id: dayId,
          date: dayDate,
          title: '',
          note: '',
          totalDistanceMeters: 0,
          totalMovingDuration: 0,
          totalStayDuration: 0,
          visitCount: 0,
          photoCount: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
      }

      if (!existingLocation) {
        await db.locations.add({
          id: locationId,
          name,
          address: address.value.trim(),
          latitude: coordinate.value?.latitude ?? 0,
          longitude: coordinate.value?.longitude ?? 0,
          radiusMeters: 400,
          visitCount: 0,
          photoCount: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
      } else {
        const patch: Partial<Location> = {}
        if (!existingLocation.address && address.value.trim()) {
          patch.address = address.value.trim()
        }
        if (
          existingLocation.latitude === 0 &&
          existingLocation.longitude === 0 &&
          coordinate.value
        ) {
          patch.latitude = coordinate.value.latitude
          patch.longitude = coordinate.value.longitude
        }
        if (Object.keys(patch).length > 0) {
          await db.locations.update(locationId, { ...patch, updatedAt: timestamp })
        }
      }

      await db.visits.add({
        id: visitId,
        dayId,
        locationId,
        startAt,
        endAt,
        duration: Math.max(0, endAt - startAt),
        arrivalMode: mode.value,
        departureMode: mode.value,
        note: note.value.trim(),
        photoCount: 0,
        isManual: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    })

    // 重新归属照片：新地点/停留可能让已有照片匹配上
    await assignPhotos()

    store.showToast(`已补录「${name}」`)
    router.back()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    saving.value = false
  }
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
      <span class="topbar__title">手动补录</span>
    </div>

    <HeroPanel
      eyebrow="补录"
      title="把漏掉的停留补回来"
      subtitle="适合补一个地点、一次停留，或者先把某段回忆记下来，后面再慢慢补充细节。"
    >
      <MetricChip text="手动记录" />
      <MetricChip text="直接写入时间线" />
    </HeroPanel>

    <SurfaceCard title="时间">
      <SectionHeader
        title="先把这段停留放回那一天"
        subtitle="补录会自动归到某一天里，也会出现在地点详情和回顾页。"
      />
      <label class="field">
        <span class="field__label">日期</span>
        <input v-model="dateValue" type="date" class="input" />
      </label>
      <div class="grid-2">
        <label class="field">
          <span class="field__label">开始时间</span>
          <input v-model="startValue" type="time" class="input" />
        </label>
        <label class="field">
          <span class="field__label">结束时间</span>
          <input v-model="endValue" type="time" class="input" />
        </label>
      </div>
    </SurfaceCard>

    <SurfaceCard title="地点">
      <SectionHeader
        title="地点可以新建，也可以沿用已有地点"
        subtitle="名称和已有地点一致时会直接归到那个地点名下；在地图上选点会把这次停留真正放进地图。"
      />
      <label class="field">
        <span class="field__label">地点名称</span>
        <input v-model="locationName" class="input" placeholder="例如：咖啡馆" />
      </label>
      <label class="field">
        <span class="field__label">地址或补充说明（可选）</span>
        <input v-model="address" class="input" placeholder="例如：南锣鼓巷附近" />
      </label>

      <div v-if="suggestedLocations.length > 0" class="row row--wrap">
        <button
          v-for="location in suggestedLocations"
          :key="location.id"
          class="chip chip--button"
          @click="applySuggestion(location)"
        >
          {{ location.name }}
        </button>
      </div>
    </SurfaceCard>

    <SurfaceCard title="地图定位">
      <SectionHeader
        title="在地图上点一下，给这段停留一个真实位置"
        :subtitle="
          coordinate
            ? `已选坐标：${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)}`
            : '如果暂时不确定位置，也可以先保存，后面再补。'
        "
      />
      <MapView
        :locations="[]"
        :height="240"
        :interactive="true"
        pickable
        :picked-coordinate="coordinate"
        @pick="onPick"
      />

      <div class="row row--wrap">
        <DetailBadge
          :icon="coordinate ? 'mappin.and.ellipse' : 'location.slash'"
          :text="coordinate ? '会写入地点坐标' : '可稍后补'"
        />
      </div>

      <div class="row row--wrap">
        <button class="btn btn--primary" :disabled="locating" @click="locate">
          {{ locating ? '定位中…' : '定位到当前位置' }}
        </button>
        <button v-if="coordinate" class="btn btn--ghost" @click="coordinate = null">
          清除定位
        </button>
      </div>

      <p class="tiny text-muted">提示：地图上的坐标是 WGS-84（与照片 EXIF 一致），无需纠偏。</p>
    </SurfaceCard>

    <SurfaceCard title="备注">
      <SectionHeader
        title="写一点当时发生了什么"
        subtitle="这段文字会显示在时间线和地点详情里。"
      />
      <label class="field">
        <span class="field__label">停留方式</span>
        <select v-model="mode" class="input">
          <option v-for="option in MOVEMENT_MODES" :key="option.value" :value="option.value">
            {{ option.icon }} {{ option.label }}
          </option>
        </select>
      </label>
      <label class="field">
        <span class="field__label">备注</span>
        <textarea
          v-model="note"
          class="textarea"
          placeholder="记录一点感受或当时在做什么"
        />
      </label>
    </SurfaceCard>

    <div v-if="errorMessage" class="notice notice--danger">{{ errorMessage }}</div>

    <button class="btn btn--primary btn--block" :disabled="!canSave" @click="save">
      {{ saving ? '正在保存…' : '保存补录' }}
    </button>
  </div>
</template>
