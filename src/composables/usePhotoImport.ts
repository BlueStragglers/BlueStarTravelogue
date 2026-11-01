import { ref } from 'vue'
import { importPhotoFiles } from '@/services/photoService'
import { useAppStore } from '@/stores/app'

/**
 * 照片导入的通用逻辑（文件选择 + 进度 + 结果提示）。
 * 在「今天」和「我的」页面复用。
 */
export function usePhotoImport() {
  const store = useAppStore()
  const fileInput = ref<HTMLInputElement | null>(null)

  function openPicker() {
    fileInput.value?.click()
  }

  async function handleFiles(event: Event) {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    input.value = ''
    if (files.length === 0) return

    store.importing = true
    store.importProgress = { done: 0, total: files.length, current: '' }

    try {
      const result = await importPhotoFiles(files, (progress) => {
        store.importProgress = progress
      })

      const parts = [`导入 ${result.imported} 张`]
      if (result.withGps > 0) parts.push(`${result.withGps} 张带定位`)
      if (result.skipped > 0) parts.push(`跳过 ${result.skipped} 个非图片文件`)
      if (result.errors.length > 0) parts.push(`${result.errors.length} 张失败`)

      store.lastImportMessage = parts.join('，')
      store.showToast(store.lastImportMessage)
    } catch (error) {
      store.showToast(`导入失败：${String(error)}`)
    } finally {
      store.importing = false
      store.importProgress = null
    }
  }

  return { fileInput, openPicker, handleFiles }
}
