<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import type {
  LngLatBoundsLike,
  Map as MapLibreMap,
  Marker,
  StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { MapLocationSnapshot } from '@/models/types'

const props = withDefaults(
  defineProps<{
    locations: MapLocationSnapshot[]
    height?: number
    interactive?: boolean
    selectedId?: string | null
    pickable?: boolean
    pickedCoordinate?: { latitude: number; longitude: number } | null
  }>(),
  {
    height: 280,
    interactive: true,
    selectedId: null,
    pickable: false,
    pickedCoordinate: null,
  },
)

const emit = defineEmits<{
  (event: 'select', snapshot: MapLocationSnapshot): void
  (event: 'pick', coordinate: { latitude: number; longitude: number }): void
}>()

const container = ref<HTMLDivElement | null>(null)
let map: MapLibreMap | null = null
let markers: Marker[] = []
let pickMarker: Marker | null = null
let resizeObserver: ResizeObserver | null = null

/** 默认视角：北京 */
const DEFAULT_CENTER: [number, number] = [116.3975, 39.9087]

/**
 * 使用 Carto Positron 瓦片（WGS-84 对齐），与照片 EXIF / 浏览器定位坐标一致，
 * 因此这里不需要做 GCJ-02 纠偏。
 */
const styleSpec: StyleSpecification = {
  version: 8,
  sources: {
    basemap: {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
}

function boundsFor(locations: MapLocationSnapshot[]): LngLatBoundsLike {
  const longitudes = locations.map((location) => location.longitude)
  const latitudes = locations.map((location) => location.latitude)
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ]
}

function initialView(): { center: [number, number]; zoom: number } {
  if (props.pickedCoordinate) {
    return {
      center: [props.pickedCoordinate.longitude, props.pickedCoordinate.latitude],
      zoom: 12,
    }
  }
  if (props.locations.length === 1) {
    const only = props.locations[0]!
    return { center: [only.longitude, only.latitude], zoom: 13 }
  }
  if (props.locations.length === 0) {
    return { center: DEFAULT_CENTER, zoom: props.pickable ? 10 : 4 }
  }
  return { center: DEFAULT_CENTER, zoom: 11 }
}

function createMarkerElement(snapshot: MapLocationSnapshot): HTMLElement {
  const element = document.createElement('button')
  element.type = 'button'
  element.className = 'map-pin'
  if (snapshot.id === props.selectedId) {
    element.classList.add('map-pin--active')
  }

  if (snapshot.photoCount > 0) {
    const count = document.createElement('span')
    count.className = 'map-pin__count'
    count.textContent = String(snapshot.photoCount)
    element.appendChild(count)
  }

  const dot = document.createElement('span')
  dot.className = 'map-pin__dot'
  element.appendChild(dot)

  element.addEventListener('click', (event) => {
    event.stopPropagation()
    emit('select', snapshot)
  })

  return element
}

function syncMarkers() {
  if (!map) return
  for (const marker of markers) marker.remove()
  markers = []

  for (const snapshot of props.locations) {
    const marker = new maplibregl.Marker({
      element: createMarkerElement(snapshot),
      anchor: 'bottom',
    })
      .setLngLat([snapshot.longitude, snapshot.latitude])
      .addTo(map)
    markers.push(marker)
  }

  syncPickMarker()
}

function syncPickMarker() {
  if (!map) return
  pickMarker?.remove()
  pickMarker = null

  if (!props.pickedCoordinate) return

  const element = document.createElement('div')
  element.className = 'map-pin map-pin--active'
  const dot = document.createElement('span')
  dot.className = 'map-pin__dot'
  element.appendChild(dot)

  pickMarker = new maplibregl.Marker({ element, anchor: 'bottom' })
    .setLngLat([props.pickedCoordinate.longitude, props.pickedCoordinate.latitude])
    .addTo(map)
}

onMounted(() => {
  if (!container.value) return
  const view = initialView()

  map = new maplibregl.Map({
    container: container.value,
    style: styleSpec,
    center: view.center,
    zoom: view.zoom,
    interactive: props.interactive,
    attributionControl: false,
  })

  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

  if (props.interactive) {
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  }

  map.on('load', () => {
    if (props.locations.length > 1) {
      map?.fitBounds(boundsFor(props.locations), { padding: 46, maxZoom: 15, duration: 0 })
    }
    syncMarkers()
  })

  if (props.pickable) {
    map.on('click', (event) => {
      emit('pick', { latitude: event.lngLat.lat, longitude: event.lngLat.lng })
    })
  }

  if (container.value) {
    resizeObserver = new ResizeObserver(() => map?.resize())
    resizeObserver.observe(container.value)
  }
})

watch(
  () => props.locations,
  () => {
    syncMarkers()
  },
)

watch(
  () => props.selectedId,
  () => {
    syncMarkers()
  },
)

watch(
  () => props.pickedCoordinate,
  (coordinate) => {
    if (!map) return
    syncPickMarker()
    if (coordinate) {
      map.jumpTo({ center: [coordinate.longitude, coordinate.latitude], zoom: Math.max(map.getZoom(), 12) })
    }
  },
  { deep: true },
)

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  for (const marker of markers) marker.remove()
  markers = []
  pickMarker?.remove()
  pickMarker = null
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="container" class="map-shell" :style="{ height: `${height}px` }" />
</template>
