import type { PhotoMeta } from '@/models/types'

export const DAY_MS = 24 * 60 * 60 * 1000

export function startOfWeek(timestamp: number): number {
  const date = new Date(timestamp)
  const weekday = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - weekday)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export interface PhotoScopeInput {
  scope: string
  id?: string | null
  period?: string
}

function inCurrentPeriod(timestamp: number, period: string | undefined): boolean {
  const now = Date.now()
  if (period === 'month') {
    const current = new Date(now)
    const date = new Date(timestamp)
    return date.getFullYear() === current.getFullYear() && date.getMonth() === current.getMonth()
  }
  const start = startOfWeek(now)
  return timestamp >= start && timestamp < start + 7 * DAY_MS
}

/** 按 photo scope 过滤照片，并按拍摄时间倒序 */
export function filterPhotosByScope(photos: PhotoMeta[], input: PhotoScopeInput): PhotoMeta[] {
  const filtered = photos.filter((photo) => {
    if (input.scope === 'day') {
      return input.id != null && photo.dayId === input.id
    }
    if (input.scope === 'location') {
      return input.id != null && photo.locationId === input.id
    }
    const timestamp = photo.creationDate ?? photo.importedAt
    return inCurrentPeriod(timestamp, input.period)
  })

  return filtered.sort(
    (a, b) => (b.creationDate ?? b.importedAt) - (a.creationDate ?? a.importedAt),
  )
}

/** 解析 YYYY-MM-DD 为本地时间戳 */
export function parseDateKey(key: string): number {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1).getTime()
}
