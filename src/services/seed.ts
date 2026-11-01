import { db, clearAllData } from '@/db'
import type { Day, Location, MovementMode, Visit } from '@/models/types'
import { recomputeCounters } from './photoService'
import { newId, startOfDay } from './util'

const DAY_MS = 24 * 60 * 60 * 1000

interface LocationSpec {
  name: string
  address: string
  latitude: number
  longitude: number
}

/** 示例地点（WGS-84 坐标，与 OSM / Carto 瓦片对齐） */
const LOCATION_SPECS: LocationSpec[] = [
  { name: '家', address: '朝阳区某小区', latitude: 39.9755, longitude: 116.33 },
  { name: '办公室', address: '建国路 88 号', latitude: 39.9087, longitude: 116.3975 },
  { name: '咖啡馆', address: '南锣鼓巷附近', latitude: 39.9155, longitude: 116.4035 },
  { name: '奥林匹克森林公园', address: '朝阳区科荟路', latitude: 39.942, longitude: 116.31 },
  { name: '书店', address: '三里屯路 19 号', latitude: 39.92, longitude: 116.43 },
]

/**
 * 载入示例数据：3 天、5 个地点、若干停留记录。
 * 用于第一次打开时快速体验地图、时间线与回顾。
 */
export async function seedDemoData(): Promise<void> {
  await clearAllData()

  const now = Date.now()
  const todayStart = startOfDay(now)

  const locations: Location[] = LOCATION_SPECS.map((spec) => ({
    id: newId(),
    name: spec.name,
    address: spec.address,
    latitude: spec.latitude,
    longitude: spec.longitude,
    radiusMeters: 400,
    visitCount: 0,
    photoCount: 0,
    createdAt: now,
    updatedAt: now,
  }))
  const locationByName = new Map(locations.map((location) => [location.name, location]))

  const days: Day[] = []
  const visits: Visit[] = []

  const addDay = (offsetDays: number, note: string, distanceMeters: number): Day => {
    const date = todayStart - offsetDays * DAY_MS
    const day: Day = {
      id: newId(),
      date,
      title: '',
      note,
      totalDistanceMeters: distanceMeters,
      totalMovingDuration: 0,
      totalStayDuration: 0,
      visitCount: 0,
      photoCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    days.push(day)
    return day
  }

  const addVisit = (
    day: Day,
    locationName: string,
    startHour: number,
    endHour: number,
    note: string,
    mode: MovementMode = 'walking',
  ) => {
    const location = locationByName.get(locationName)
    if (!location) return
    const startAt = day.date + startHour * 60 * 60 * 1000
    const endAt = day.date + endHour * 60 * 60 * 1000
    visits.push({
      id: newId(),
      dayId: day.id,
      locationId: location.id,
      startAt,
      endAt,
      duration: Math.max(0, endAt - startAt),
      arrivalMode: mode,
      departureMode: mode,
      note,
      photoCount: 0,
      isManual: false,
      createdAt: now,
      updatedAt: now,
    })
  }

  const today = addDay(0, '今天把常走的路重新走了一遍，晚上和朋友聊了很久。', 12400)
  addVisit(today, '家', 7.5, 8.17, '出门上班')
  addVisit(today, '办公室', 9, 18.5, '工作')
  addVisit(today, '咖啡馆', 19, 19.83, '和朋友聊天', 'transit')

  const yesterday = addDay(1, '周末的节奏慢一些，公园里的树已经开始变色了。', 8600)
  addVisit(yesterday, '家', 10, 11, '周末慢慢起床')
  addVisit(yesterday, '奥林匹克森林公园', 11.5, 13, '在公园散步')
  addVisit(yesterday, '书店', 15, 16.17, '逛书店', 'transit')

  const twoDaysAgo = addDay(2, '把项目里积压的事情整理了一遍。', 6200)
  addVisit(twoDaysAgo, '办公室', 9, 17, '整理项目')
  addVisit(twoDaysAgo, '咖啡馆', 17.67, 18.5, '写点东西')

  await db.transaction('rw', db.days, db.locations, db.visits, async () => {
    await db.locations.bulkAdd(locations)
    await db.days.bulkAdd(days)
    await db.visits.bulkAdd(visits)
  })

  await recomputeCounters()
}
