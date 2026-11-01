import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ImportProgress } from '@/models/types'

export const useAppStore = defineStore('app', () => {
  const toast = ref<string | null>(null)
  const importing = ref(false)
  const importProgress = ref<ImportProgress | null>(null)
  const lastImportMessage = ref<string | null>(null)

  let toastTimer: number | undefined

  function showToast(message: string, duration = 3400) {
    toast.value = message
    if (toastTimer) window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      if (toast.value === message) toast.value = null
    }, duration)
  }

  return {
    toast,
    importing,
    importProgress,
    lastImportMessage,
    showToast,
  }
})
