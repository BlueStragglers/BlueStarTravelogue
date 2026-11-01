<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { db } from '@/db'

const props = withDefaults(
  defineProps<{
    photoId: string
    alt?: string
    full?: boolean
  }>(),
  { alt: '照片', full: false },
)

const url = ref<string | null>(null)
const failed = ref(false)
let objectUrl: string | null = null

function release() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
  url.value = null
}

async function load() {
  release()
  failed.value = false
  try {
    const row = await db.photoData.get(props.photoId)
    if (!row) {
      failed.value = true
      return
    }
    const blob = props.full ? row.blob : (row.thumbnail ?? row.blob)
    objectUrl = URL.createObjectURL(blob)
    url.value = objectUrl
  } catch {
    failed.value = true
  }
}

watch(() => props.photoId, load, { immediate: true })
onUnmounted(release)
</script>

<template>
  <img v-if="url" :src="url" :alt="alt" class="photo-thumb" loading="lazy" />
  <div v-else class="thumb-fallback" aria-hidden="true">{{ failed ? '🖼️' : '…' }}</div>
</template>
