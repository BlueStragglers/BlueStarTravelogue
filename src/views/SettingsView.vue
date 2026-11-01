<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '@/db'
import { useLiveQuery } from '@/db/useLiveQuery'
import type { Day, Location, PhotoMeta, Visit } from '@/models/types'
import { formatBytes } from '@/services/format'
import { exportBackup, importBackup } from '@/services/backup'
import {
  isGeolocationSupported,
  isSecureContextAvailable,
} from '@/services/geolocation'
import { useAppStore } from '@/stores/app'
import SurfaceCard from '@/components/ui/SurfaceCard.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const section = computed(() => String(route.params.section ?? 'about'))

const days = useLiveQuery(() => db.days.toArray(), [] as Day[])
const visits = useLiveQuery(() => db.visits.toArray(), [] as Visit[])
const locations = useLiveQuery(() => db.locations.toArray(), [] as Location[])
const photos = useLiveQuery(() => db.photos.toArray(), [] as PhotoMeta[])

const title = computed(() => {
  switch (section.value) {
    case 'permissions':
      return '权限与隐私'
    case 'export':
      return '导出数据'
    case 'tags':
      return '标签管理'
    default:
      return '关于蓝星旅记'
  }
})

const includeImages = ref(false)
const exporting = ref(false)
const importing = ref(false)
const lastExport = ref<string | null>(null)
const importInput = ref<HTMLInputElement | null>(null)

const photoWithGps = computed(
  () => photos.value.filter((photo) => photo.latitude != null).length,
)

const secureContext = isSecureContextAvailable()
const geoSupported = isGeolocationSupported()

async function runExport() {
  exporting.value = true
  lastExport.value = null
  try {
    const result = await exportBackup(includeImages.value)
    lastExport.value = `已导出 ${result.filename}（${formatBytes(result.size)}）`
    store.showToast(lastExport.value)
  } catch (error) {
    store.showToast(`导出失败：${String(error)}`)
  } finally {
    exporting.value = false
  }
}

function pickImportFile() {
  importInput.value?.click()
}

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const confirmed = window.confirm(
    '导入备份会覆盖当前浏览器里的全部数据，确定继续吗？',
  )
  if (!confirmed) return

  importing.value = true
  try {
    const text = await file.text()
    const result = await importBackup(text)
    store.showToast(
      `已恢复 ${result.days} 天、${result.visits} 段停留、${result.photos} 张照片`,
    )
  } catch (error) {
    store.showToast(`导入失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    importing.value = false
  }
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
      <span class="topbar__title">{{ title }}</span>
    </div>

    <!-- 权限与隐私 -->
    <template v-if="section === 'permissions'">
      <SurfaceCard title="定位">
        <SectionHeader
          title="定位只在你主动操作时使用"
          subtitle="网页版没有后台持续定位能力，只有在你点「定位到当前位置」或在地图上选点时才读取位置。"
        />
        <div class="list">
          <div class="list-row" style="cursor: default">
            <div class="list-row__main">
              <div class="list-row__title">浏览器定位能力</div>
              <div class="list-row__sub">{{ geoSupported ? '当前浏览器支持定位' : '当前浏览器不支持定位' }}</div>
            </div>
          </div>
          <div class="list-row" style="cursor: default">
            <div class="list-row__main">
              <div class="list-row__title">安全上下文</div>
              <div class="list-row__sub">
                {{ secureContext ? '当前页面处于安全上下文（HTTPS 或 localhost），定位可用' : '当前不是安全上下文，浏览器会拒绝定位；请用 HTTPS 或 localhost 访问' }}
              </div>
            </div>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard title="照片">
        <SectionHeader
          title="照片由你主动选择"
          subtitle="网页版无法像原生 App 那样扫描整个相册。只有你在文件选择器里选中的照片会被读取。"
        />
        <p class="text-secondary small">
          已导入 {{ photos.length }} 张照片，其中 {{ photoWithGps }} 张带 GPS。
          照片文件保存在当前浏览器的 IndexedDB 中，不会上传到任何服务器。
        </p>
      </SurfaceCard>

      <SurfaceCard title="数据存储">
        <div class="notice">
          所有数据（日期、地点、停留、照片）默认只保存在当前浏览器的 IndexedDB 里。
          清除浏览器数据、卸载站点或更换设备都会导致本地数据丢失，请定期使用「导出数据」备份。
        </div>
        <div class="row row--wrap">
          <button class="btn btn--primary" @click="router.push('/settings/export')">
            去导出备份
          </button>
        </div>
      </SurfaceCard>
    </template>

    <!-- 导出数据 -->
    <template v-else-if="section === 'export'">
      <SurfaceCard title="导出备份">
        <SectionHeader
          title="把数据带走或存起来"
          subtitle="导出为 JSON 文件，可以随时导入回其他浏览器或设备。"
        />
        <div class="grid-3">
          <div class="stat">
            <span class="stat__value">{{ days.length }}</span>
            <span class="stat__label">记录天数</span>
          </div>
          <div class="stat">
            <span class="stat__value">{{ visits.length }}</span>
            <span class="stat__label">停留记录</span>
          </div>
          <div class="stat">
            <span class="stat__value">{{ photos.length }}</span>
            <span class="stat__label">照片</span>
          </div>
        </div>

        <label class="row" style="cursor: pointer">
          <input v-model="includeImages" type="checkbox" />
          <span class="small">同时导出照片文件（会把图片转成 base64，文件会显著变大）</span>
        </label>

        <div class="row row--wrap">
          <button class="btn btn--primary" :disabled="exporting" @click="runExport">
            {{ exporting ? '正在导出…' : '导出 JSON 备份' }}
          </button>
        </div>

        <div v-if="lastExport" class="notice">{{ lastExport }}</div>

        <div class="notice notice--warn">
          提示：无损导出后的文件可以重新导入；如果勾选「同时导出照片」，文件体积可能是几十到几百 MB，建议先在电脑上操作。
        </div>
      </SurfaceCard>

      <SurfaceCard title="导入备份">
        <SectionHeader
          title="恢复之前的记录"
          subtitle="导入会覆盖当前浏览器里的全部数据，请先确认已经导出备份。"
        />
        <div class="row row--wrap">
          <button class="btn btn--ghost" :disabled="importing" @click="pickImportFile">
            {{ importing ? '正在导入…' : '选择备份文件' }}
          </button>
        </div>
        <input
          ref="importInput"
          class="hidden-input"
          type="file"
          accept="application/json,.json"
          @change="onImportFile"
        />
        <div class="notice">
          支持两种备份：只含元数据的 JSON，以及包含照片文件的完整 JSON。
        </div>
      </SurfaceCard>
    </template>

    <!-- 标签管理 -->
    <template v-else-if="section === 'tags'">
      <SurfaceCard title="标签管理">
        <EmptyState
          icon="🏷️"
          title="标签功能规划中"
          subtitle="未来可以给地点和停留打标签，例如「工作」「朋友」「放松」，并在回顾页按标签筛选。"
        />
        <p class="text-secondary small">
          当前版本已把标签能力预留为独立的数据层，后续会以「地点标签 / 停留标签」两级方式接入，
          不做复杂继承，保持轻量。
        </p>
      </SurfaceCard>
    </template>

    <!-- 关于 -->
    <template v-else>
      <SurfaceCard title="关于">
        <SectionHeader
          title="蓝星旅记 · BlueStarTravelogue"
          subtitle="以个人行动轨迹、地点停留和带定位照片回顾为核心的旅行记录工具。"
        />
        <div class="list">
          <div class="list-row" style="cursor: default">
            <div class="list-row__main">
              <div class="list-row__title">版本</div>
              <div class="list-row__sub">0.1.0 · PWA 预览版</div>
            </div>
          </div>
          <div class="list-row" style="cursor: default">
            <div class="list-row__main">
              <div class="list-row__title">技术栈</div>
              <div class="list-row__sub">Vue 3 · Vite · TypeScript · MapLibre GL JS · Dexie (IndexedDB)</div>
            </div>
          </div>
          <div class="list-row" style="cursor: default">
            <div class="list-row__main">
              <div class="list-row__title">地图与坐标</div>
              <div class="list-row__sub">使用 Carto / OSM 的 WGS-84 瓦片，与照片 EXIF 坐标一致，无需 GCJ-02 纠偏</div>
            </div>
          </div>
          <div class="list-row" style="cursor: default">
            <div class="list-row__main">
              <div class="list-row__title">与 iOS 版的关系</div>
              <div class="list-row__sub">本 PWA 是原 SwiftUI 应用的网页迁移版，专注本地记录与隐私</div>
            </div>
          </div>
        </div>
        <div class="row row--wrap">
          <button class="btn btn--ghost" @click="router.push('/profile')">回到我的</button>
        </div>
      </SurfaceCard>

      <SurfaceCard title="安装为应用">
        <SectionHeader
          title="像 App 一样使用"
          subtitle="在浏览器菜单里选择「添加到主屏幕 / 安装应用」，即可全屏运行并离线打开。"
        />
        <div class="notice">
          地图瓦片需要联网加载；其余页面与本地数据可离线浏览。
        </div>
      </SurfaceCard>
    </template>
  </div>
</template>
