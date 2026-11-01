import { db, clearAllData } from '@/db'
import type { BackupPayload } from '@/models/types'
import { safeJsonParse } from './util'

const APP_ID = 'blue-star-travelogue'
const BACKUP_VERSION = 1

export interface RestoreResult {
  days: number
  locations: number
  visits: number
  photos: number
  withImages: boolean
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = /data:(.*?);base64/.exec(header ?? '')
  const mime = mimeMatch?.[1] || 'image/jpeg'
  const binary = atob(base64 ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mime })
}

/** 组装备份数据 */
export async function buildBackup(includeImages: boolean): Promise<BackupPayload> {
  const [days, locations, visits, photos] = await Promise.all([
    db.days.toArray(),
    db.locations.toArray(),
    db.visits.toArray(),
    db.photos.toArray(),
  ])

  const payload: BackupPayload = {
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    days,
    locations,
    visits,
    photos,
  }

  if (includeImages) {
    const photoData: Record<string, string> = {}
    const rows = await db.photoData.toArray()
    for (const row of rows) {
      photoData[row.id] = await blobToDataUrl(row.blob)
    }
    payload.photoData = photoData
  }

  return payload
}

/** 导出为 JSON 文件并触发下载 */
export async function exportBackup(
  includeImages: boolean,
): Promise<{ filename: string; size: number }> {
  const payload = await buildBackup(includeImages)
  const text = JSON.stringify(payload, null, 2)
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const datePart = new Date().toISOString().slice(0, 10)
  const filename = `blue-star-travelogue-${datePart}${includeImages ? '-full' : ''}.json`

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)

  return { filename, size: blob.size }
}

/** 从 JSON 文本恢复数据（会覆盖现有数据） */
export async function importBackup(text: string): Promise<RestoreResult> {
  const payload = safeJsonParse<BackupPayload>(text)
  if (!payload || payload.app !== APP_ID) {
    throw new Error('不是有效的蓝星旅记备份文件')
  }
  if (
    !Array.isArray(payload.days) ||
    !Array.isArray(payload.locations) ||
    !Array.isArray(payload.visits) ||
    !Array.isArray(payload.photos)
  ) {
    throw new Error('备份文件结构不完整')
  }

  await clearAllData()

  await db.transaction('rw', db.days, db.locations, db.visits, db.photos, db.photoData, async () => {
    await db.days.bulkPut(payload.days)
    await db.locations.bulkPut(payload.locations)
    await db.visits.bulkPut(payload.visits)
    await db.photos.bulkPut(payload.photos)

    if (payload.photoData) {
      const rows = Object.entries(payload.photoData).map(([id, dataUrl]) => ({
        id,
        blob: dataUrlToBlob(dataUrl),
      }))
      if (rows.length > 0) {
        await db.photoData.bulkPut(rows)
      }
    }
  })

  return {
    days: payload.days.length,
    locations: payload.locations.length,
    visits: payload.visits.length,
    photos: payload.photos.length,
    withImages: Boolean(payload.photoData),
  }
}
