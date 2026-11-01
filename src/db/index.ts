import Dexie, { type Table } from 'dexie'
import type { Day, Location, Visit, PhotoMeta, PhotoData } from '@/models/types'

/**
 * 本地优先数据库（IndexedDB）。
 * 表结构对应原 SwiftData 的 DayEntity / LocationEntity / VisitEntity / PhotoAssetEntity。
 */
export class TravelDatabase extends Dexie {
  days!: Table<Day, string>
  locations!: Table<Location, string>
  visits!: Table<Visit, string>
  photos!: Table<PhotoMeta, string>
  photoData!: Table<PhotoData, string>

  constructor() {
    super('blue-star-travelogue')

    this.version(1).stores({
      days: 'id, date',
      locations: 'id, name, latitude, longitude',
      visits: 'id, dayId, locationId, startAt, isManual',
      photos: 'id, dayId, locationId, visitId, creationDate, importedAt',
      // 只按主键存，避免把大 Blob 和可索引字段混在一起
      photoData: 'id',
    })
  }
}

export const db = new TravelDatabase()

/** 清空所有业务数据（保留数据库本身） */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.days, db.locations, db.visits, db.photos, db.photoData, async () => {
    await db.days.clear()
    await db.locations.clear()
    await db.visits.clear()
    await db.photos.clear()
    await db.photoData.clear()
  })
}
