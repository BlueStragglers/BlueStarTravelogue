import type { Day, DaySummary, Location, MapLocationSnapshot, TimelineItem, Visit } from '@/models/types'
import { formatDayTitle, formatDistance, formatDuration, formatTime } from './format'
import { isValidCoordinate } from './geo'

/** 把某天的停留记录组装成时间线 */
export function composeTimeline(
  visits: Visit[],
  locationsById: Map<string, Location>,
): TimelineItem[] {
  return [...visits]
    .sort((a, b) => a.startAt - b.startAt)
    .map((visit) => ({
      id: visit.id,
      kind: 'visit' as const,
      title: locationsById.get(visit.locationId)?.name ?? '未知地点',
      subtitle: `停留 ${formatDuration(visit.duration)}，${visit.note.trim() || '暂无备注'}`,
      timeText: formatTime(visit.startAt),
      photoCount: visit.photoCount,
    }))
}

/** 组装「今天 / 某日」的摘要文案 */
export function composeDaySummary(day: Day | undefined): DaySummary {
  if (!day) {
    return {
      id: '',
      title: '今天',
      subtitle: '还没有记录，准备开始第一段轨迹。',
      visitCountText: '0 个地点',
      photoCountText: '0 张照片',
      distanceText: '0 km',
    }
  }

  return {
    id: day.id,
    title: formatDayTitle(day.date),
    subtitle: day.note.trim() || '今天还没有写下备注。',
    visitCountText: `${day.visitCount} 个地点`,
    photoCountText: `${day.photoCount} 张照片`,
    distanceText: formatDistance(day.totalDistanceMeters),
  }
}

/** 地点 -> 地图快照 */
export function toLocationSnapshots(locations: Location[]): MapLocationSnapshot[] {
  return locations
    .filter((location) => isValidCoordinate(location.latitude, location.longitude))
    .map((location) => ({
      id: location.id,
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      visitCount: location.visitCount,
      photoCount: location.photoCount,
    }))
}

/** 按 id 建 Map，方便快速查找 */
export function mapById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]))
}
