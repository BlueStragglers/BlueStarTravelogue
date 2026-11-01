<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { clearAllData, db } from '@/db'
import { useLiveQuery } from '@/db/useLiveQuery'
import type { Day, Location, PhotoMeta, Visit } from '@/models/types'
import { seedDemoData } from '@/services/seed'
import { isGeolocationSupported, isSecureContextAvailable } from '@/services/geolocation'
import { useAppStore } from '@/stores/app'
import { usePhotoImport } from '@/composables/usePhotoImport'
import HeroPanel from '@/components/ui/HeroPanel.vue'
import MetricChip from '@/components/ui/MetricChip.vue'
import SurfaceCard from '@/components/ui/SurfaceCard.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import OnboardingStep from '@/components/ui/OnboardingStep.vue'
import StatCard from '@/components/ui/StatCard.vue'

const router = useRouter()
const store = useAppStore()
const { fileInput, openPicker, handleFiles } = usePhotoImport()

const days = useLiveQuery(() => db.days.toArray(), [] as Day[])
const visits = useLiveQuery(() => db.visits.toArray(), [] as Visit[])
const locations = useLiveQuery(() => db.locations.toArray(), [] as Location[])
const photos = useLiveQuery(() => db.photos.toArray(), [] as PhotoMeta[])

const geoPermission = ref<'granted' | 'denied' | 'prompt' | 'unsupported'>('unsupported')

onMounted(async () => {
  if (!isGeolocationSupported()) {
    geoPermission.value = 'unsupported'
    return
  }
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    geoPermission.value = status.state as 'granted' | 'denied' | 'prompt'
    status.onchange = () => {
      geoPermission.value = status.state as 'granted' | 'denied' | 'prompt'
    }
  } catch {
    geoPermission.value = 'unsupported'
  }
})

const geoPermissionText = computed(() => {
  switch (geoPermission.value) {
    case 'granted':
      return '已允许定位'
    case 'denied':
      return '定位已被拒绝'
    case 'prompt':
      return '尚未授权定位'
    default:
      return '当前浏览器不支持定位'
  }
})

const photoWithGps = computed(
  () => photos.value.filter((photo) => photo.latitude != null && photo.longitude != null).length,
)

const needsSetup = computed(() => photos.value.length === 0)

async function loadDemo() {
  await seedDemoData()
  store.showToast('已载入示例数据')
}

async function clearData() {
  const confirmed = window.confirm('确定要清空全部本地数据吗？此操作不可撤销。')
  if (!confirmed) return
  await clearAllData()
  store.showToast('已清空全部数据')
}

function go(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="page stack">
    <HeroPanel
      eyebrow="我的"
      title="把记录系统调到刚刚好"
      subtitle="这里负责权限、照片导入和数据备份。第一次用时，把照片和地点连接好，后面的地图与回顾才会越来越完整。"
    >
      <MetricChip :text="geoPermissionText" />
      <MetricChip :text="`${photos.length} 张照片`" />
      <MetricChip :text="isSecureContextAvailable() ? '安全上下文正常' : '非安全上下文' " />
    </HeroPanel>

    <SurfaceCard v-if="needsSetup" title="初始化进度">
      <SectionHeader
        title="先把真实内容接进来"
        subtitle="完成下面三步后，蓝星旅记会只基于你的照片和地点生成地图日记。"
      />
      <OnboardingStep
        :index="1"
        title="导入照片"
        subtitle="支持一次多选，照片会保存在当前浏览器本地。"
        :done="photos.length > 0"
      />
      <OnboardingStep
        :index="2"
        title="读取定位信息"
        subtitle="从照片 EXIF 中读取 GPS 和拍摄时间。"
        :done="photoWithGps > 0"
      />
      <OnboardingStep
        :index="3"
        title="自动归属到地点"
        subtitle="照片会匹配到最近地点和对应停留。"
        :done="photos.some((photo) => photo.locationId != null)"
      />
      <div class="row row--wrap">
        <button class="btn btn--primary" :disabled="store.importing" @click="openPicker">
          {{ store.importing ? '正在导入…' : '导入照片' }}
        </button>
        <button class="btn btn--ghost" @click="loadDemo">载入示例数据</button>
      </div>
    </SurfaceCard>

    <SurfaceCard title="数据概览">
      <div class="grid-3">
        <StatCard :value="String(days.length)" label="记录天数" icon="📅" />
        <StatCard :value="String(locations.length)" label="地点" icon="📍" />
        <StatCard :value="String(visits.length)" label="停留" icon="🧭" />
      </div>
      <div class="grid-3">
        <StatCard :value="String(photos.length)" label="照片" icon="🖼️" />
        <StatCard :value="String(photoWithGps)" label="带定位" icon="🛰️" />
        <StatCard :value="String(locations.filter((l) => l.photoCount > 0).length)" label="有照片地点" icon="✨" />
      </div>
    </SurfaceCard>

    <SurfaceCard title="记录状态">
      <div class="list">
        <div class="list-row" style="cursor: default">
          <span class="badge">🛰️</span>
          <div class="list-row__main">
            <div class="list-row__title">定位权限</div>
            <div class="list-row__sub">{{ geoPermissionText }}</div>
          </div>
        </div>
        <div class="list-row" style="cursor: default">
          <span class="badge">🖼️</span>
          <div class="list-row__main">
            <div class="list-row__title">照片存储</div>
            <div class="list-row__sub">
              共 {{ photos.length }} 张，全部保存在当前浏览器的 IndexedDB 中
            </div>
          </div>
        </div>
        <div class="list-row" style="cursor: default">
          <span class="badge">🔒</span>
          <div class="list-row__main">
            <div class="list-row__title">隐私</div>
            <div class="list-row__sub">不上传服务器，数据只在本地，可随时导出备份</div>
          </div>
        </div>
      </div>
    </SurfaceCard>

    <SurfaceCard title="操作">
      <div class="row row--wrap">
        <button class="btn btn--primary" :disabled="store.importing" @click="openPicker">
          导入照片
        </button>
        <button class="btn btn--ghost" @click="loadDemo">重新载入示例数据</button>
        <button class="btn btn--danger" @click="clearData">清空全部数据</button>
      </div>
    </SurfaceCard>

    <SurfaceCard title="更多">
      <div class="list">
        <button class="list-row" @click="go('/locations')">
          <div class="list-row__main">
            <div class="list-row__title">地点管理</div>
            <div class="list-row__sub">查看、合并和删除地点</div>
          </div>
          <span class="list-row__chevron">›</span>
        </button>
        <button class="list-row" @click="go('/settings/permissions')">
          <div class="list-row__main">
            <div class="list-row__title">权限与隐私</div>
            <div class="list-row__sub">定位、照片与本地存储说明</div>
          </div>
          <span class="list-row__chevron">›</span>
        </button>
        <button class="list-row" @click="go('/settings/export')">
          <div class="list-row__main">
            <div class="list-row__title">导出数据</div>
            <div class="list-row__sub">导出 / 导入 JSON 备份</div>
          </div>
          <span class="list-row__chevron">›</span>
        </button>
        <button class="list-row" @click="go('/settings/tags')">
          <div class="list-row__main">
            <div class="list-row__title">标签管理</div>
            <div class="list-row__sub">为地点与停留打标签（规划中）</div>
          </div>
          <span class="list-row__chevron">›</span>
        </button>
        <button class="list-row" @click="go('/settings/about')">
          <div class="list-row__main">
            <div class="list-row__title">关于蓝星旅记</div>
            <div class="list-row__sub">版本信息与技术说明</div>
          </div>
          <span class="list-row__chevron">›</span>
        </button>
      </div>
    </SurfaceCard>

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
