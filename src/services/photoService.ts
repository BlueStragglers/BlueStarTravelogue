import * as exifr from 'exifr'
import { db } from '@/db'
import type { Day, ImportProgress, ImportResult, Location, PhotoMeta, Visit } from '@/models/types'
import { distanceMeters, isValidCoordinate } from './geo'
import { isSameDay, newId } from './util'

const DEFAULT_RADIUS_METERS = 400
const VISIT_TOLERANCE_MS = 15 * 60 * 1000

interface ThumbResult {
  thumbnail?: Blob
  width: number | null
  height: number | null
}

/** 生成缩略图（同时拿到原始宽高） */
async function makeThumbnail(file: File, maxSize = 720): Promise<ThumbResult> {
  try {
    if (typeof createImageBitmap !== 'function') {
      return { width: null, height: null }
    }
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      const dimensions = { width: bitmap.width, height: bitmap.height }
      bitmap.close?.()
      return dimensions
    }
    context.drawImage(bitmap, 0, 0, width, height)

    const thumbnail = await new Promise<Blob | undefined>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ?? undefined), 'image/jpeg', 0.82)
    })

    const dimensions = { width: bitmap.width, height: bitmap.height }
    bitmap.close?.()
    return { thumbnail, ...dimensions }
  } catch {
    return { width: null, height: null }
  }
}

function pickCreationDate(meta: Record<string, unknown> | undefined): number | null {
  if (!meta) return null
  const raw = meta.DateTimeOriginal ?? meta.CreateDate
  if (!raw) return null
  if (raw instanceof Date) {
    return Number.isFinite(raw.getTime()) ? raw.getTime() : null
  }
  const parsed = new Date(String(raw)).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 导入照片：读取 EXIF、生成缩略图、写入 IndexedDB，然后自动归属到日期/地点/停留。
 */
export async function importPhotoFiles(
  files: File[],
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    withGps: 0,
    withDate: 0,
    errors: [],
  }
  const total = files.length

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]!
    onProgress?.({ done: index, total, current: file.name })

    if (!file.type.startsWith('image/')) {
      result.skipped += 1
      continue
    }

    try {
      const gps = await exifr.gps(file).catch(() => undefined)
      const meta = (await exifr
        .parse(file, { pick: ['DateTimeOriginal', 'CreateDate'] })
        .catch(() => undefined)) as Record<string, unknown> | undefined

      const creationDate = pickCreationDate(meta)
      const thumb = await makeThumbnail(file)

      const hasGps = Boolean(
        gps &&
          Number.isFinite(gps.latitude) &&
          Number.isFinite(gps.longitude) &&
          isValidCoordinate(gps.latitude, gps.longitude),
      )

      const photo: PhotoMeta = {
        id: newId(),
        fileName: file.name,
        mimeType: file.type || 'image/jpeg',
        creationDate,
        latitude: hasGps ? (gps as { latitude: number }).latitude : null,
        longitude: hasGps ? (gps as { longitude: number }).longitude : null,
        width: thumb.width,
        height: thumb.height,
        dayId: null,
        locationId: null,
        visitId: null,
        importedAt: Date.now(),
      }

      await db.transaction('rw', db.photos, db.photoData, async () => {
        await db.photoData.put({ id: photo.id, blob: file, thumbnail: thumb.thumbnail })
        await db.photos.put(photo)
      })

      result.imported += 1
      if (hasGps) result.withGps += 1
      if (creationDate != null) result.withDate += 1
    } catch (error) {
      result.errors.push(`${file.name}: ${String(error)}`)
    }

    onProgress?.({ done: index + 1, total, current: file.name })
  }

  await assignPhotos()
  return result
}

/** 删除一张照片（含二进制数据） */
export async function deletePhoto(photoId: string): Promise<void> {
  await db.transaction('rw', db.photos, db.photoData, async () => {
    await db.photos.delete(photoId)
    await db.photoData.delete(photoId)
  })
  await recomputeCounters()
}

/**
 * 重新计算照片归属：
 * 1. 按拍摄时间匹配自然日
 * 2. 按经纬度匹配最近地点（半径内）
 * 3. 若拍摄时间落在某次停留范围内（±15 分钟），关联到该停留
 */
export async function assignPhotos(): Promise<void> {
  const [days, locations, visits, photos] = await Promise.all([
    db.days.toArray(),
    db.locations.toArray(),
    db.visits.toArray(),
    db.photos.toArray(),
  ])

  const updates: PhotoMeta[] = []

  for (const photo of photos) {
    const day = photo.creationDate != null ? findDay(days, photo.creationDate) : undefined
    const location =
      photo.latitude != null && photo.longitude != null
        ? findNearestLocation(locations, photo.latitude, photo.longitude)
        : undefined
    const visit =
      photo.creationDate != null && location
        ? findMatchingVisit(visits, photo.creationDate, location.id)
        : undefined

    const dayId = day?.id ?? null
    const locationId = location?.id ?? null
    const visitId = visit?.id ?? null

    if (photo.dayId !== dayId || photo.locationId !== locationId || photo.visitId !== visitId) {
      updates.push({ ...photo, dayId, locationId, visitId })
    }
  }

  if (updates.length > 0) {
    await db.photos.bulkPut(updates)
  }

  await recomputeCounters()
}

function findDay(days: Day[], timestamp: number): Day | undefined {
  return days.find((day) => isSameDay(day.date, timestamp))
}

function findNearestLocation(
  locations: Location[],
  latitude: number,
  longitude: number,
): Location | undefined {
  let best: Location | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  const point = { latitude, longitude }

  for (const location of locations) {
    if (location.latitude === 0 && location.longitude === 0) continue
    if (!isValidCoordinate(location.latitude, location.longitude)) continue

    const radius =
      location.radiusMeters > 0 ? location.radiusMeters : DEFAULT_RADIUS_METERS
    const distance = distanceMeters(point, {
      latitude: location.latitude,
      longitude: location.longitude,
    })

    if (distance <= radius && distance < bestDistance) {
      best = location
      bestDistance = distance
    }
  }

  return best
}

function findMatchingVisit(
  visits: Visit[],
  timestamp: number,
  locationId: string,
): Visit | undefined {
  return visits.find(
    (visit) =>
      visit.locationId === locationId &&
      timestamp >= visit.startAt - VISIT_TOLERANCE_MS &&
      timestamp <= visit.endAt + VISIT_TOLERANCE_MS,
  )
}

/**
 * 重算所有派生计数：照片数、到访数、停留总时长。
 * 派生字段永远由明细数据推导，避免多处手动维护导致不一致。
 */
export async function recomputeCounters(): Promise<void> {
  const [days, locations, visits, photos] = await Promise.all([
    db.days.toArray(),
    db.locations.toArray(),
    db.visits.toArray(),
    db.photos.toArray(),
  ])

  const photoCountByDay = new Map<string, number>()
  const photoCountByLocation = new Map<string, number>()
  const photoCountByVisit = new Map<string, number>()

  for (const photo of photos) {
    if (photo.dayId) {
      photoCountByDay.set(photo.dayId, (photoCountByDay.get(photo.dayId) ?? 0) + 1)
    }
    if (photo.locationId) {
      photoCountByLocation.set(
        photo.locationId,
        (photoCountByLocation.get(photo.locationId) ?? 0) + 1,
      )
    }
    if (photo.visitId) {
      photoCountByVisit.set(photo.visitId, (photoCountByVisit.get(photo.visitId) ?? 0) + 1)
    }
  }

  const visitsByDay = groupBy(visits, (visit) => visit.dayId)
  const visitsByLocation = groupBy(visits, (visit) => visit.locationId)
  const now = Date.now()

  await db.transaction('rw', db.days, db.locations, db.visits, async () => {
    for (const day of days) {
      const dayVisits = visitsByDay.get(day.id) ?? []
      const photoCount = photoCountByDay.get(day.id) ?? 0
      const visitCount = dayVisits.length
      const totalStayDuration = dayVisits.reduce((sum, visit) => sum + visit.duration, 0)

      if (
        day.photoCount !== photoCount ||
        day.visitCount !== visitCount ||
        day.totalStayDuration !== totalStayDuration
      ) {
        await db.days.update(day.id, {
          photoCount,
          visitCount,
          totalStayDuration,
          updatedAt: now,
        })
      }
    }

    for (const location of locations) {
      const locationVisits = visitsByLocation.get(location.id) ?? []
      const photoCount = photoCountByLocation.get(location.id) ?? 0
      const visitCount = locationVisits.length

      if (location.photoCount !== photoCount || location.visitCount !== visitCount) {
        await db.locations.update(location.id, { photoCount, visitCount, updatedAt: now })
      }
    }

    for (const visit of visits) {
      const photoCount = photoCountByVisit.get(visit.id) ?? 0
      if (visit.photoCount !== photoCount) {
        await db.visits.update(visit.id, { photoCount, updatedAt: now })
      }
    }
  })
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const bucket = map.get(key)
    if (bucket) {
      bucket.push(item)
    } else {
      map.set(key, [item])
    }
  }
  return map
}

/** 把一个地点合并到另一个地点 */
export async function mergeLocations(sourceId: string, targetId: string): Promise<void> {
  if (sourceId === targetId) return

  const source = await db.locations.get(sourceId)
  const target = await db.locations.get(targetId)
  if (!source || !target) return

  await db.transaction('rw', db.locations, db.visits, db.photos, async () => {
    await db.visits.where('locationId').equals(sourceId).modify({ locationId: targetId })
    await db.photos.where('locationId').equals(sourceId).modify({ locationId: targetId })

    const patch: Partial<Location> = {}
    if (!target.address && source.address) patch.address = source.address
    if (target.latitude === 0 && target.longitude === 0 && !(source.latitude === 0 && source.longitude === 0)) {
      patch.latitude = source.latitude
      patch.longitude = source.longitude
    }
    if (Object.keys(patch).length > 0) {
      await db.locations.update(targetId, { ...patch, updatedAt: Date.now() })
    }

    await db.locations.delete(sourceId)
  })

  await assignPhotos()
  await recomputeCounters()
}

/** 删除地点（相关停留与照片归属会被解除） */
export async function deleteLocation(locationId: string): Promise<void> {
  await db.transaction('rw', db.locations, db.visits, db.photos, async () => {
    const relatedVisitIds = (await db.visits.where('locationId').equals(locationId).toArray()).map(
      (visit) => visit.id,
    )
    if (relatedVisitIds.length > 0) {
      await db.visits.bulkDelete(relatedVisitIds)
    }
    await db.photos
      .where('locationId')
      .equals(locationId)
      .modify({ locationId: null, visitId: null })
    await db.locations.delete(locationId)
  })
  await recomputeCounters()
}
