/**
 * 蓝星旅记 领域模型
 * 从原 iOS (SwiftData) 版本迁移而来，用普通 TS 类型 + Dexie 表存储。
 * 所有涉及时间戳的字段统一使用「毫秒时间戳」。
 * 所有经纬度统一使用 WGS-84（与照片 EXIF / 浏览器 Geolocation 一致）。
 */

export type MovementMode =
  | 'walking'
  | 'cycling'
  | 'driving'
  | 'transit'
  | 'stationary'
  | 'unknown'

export interface MovementModeOption {
  value: MovementMode
  label: string
  icon: string
}

export const MOVEMENT_MODES: MovementModeOption[] = [
  { value: 'walking', label: '步行', icon: '🚶' },
  { value: 'cycling', label: '骑行', icon: '🚴' },
  { value: 'driving', label: '驾车', icon: '🚗' },
  { value: 'transit', label: '公共交通', icon: '🚇' },
  { value: 'stationary', label: '停留', icon: '📍' },
  { value: 'unknown', label: '未知', icon: '❓' },
]

/** 某一天的聚合记录 */
export interface Day {
  id: string
  /** 当天 00:00 的本地时间戳 */
  date: number
  title: string
  note: string
  totalDistanceMeters: number
  totalMovingDuration: number
  totalStayDuration: number
  visitCount: number
  photoCount: number
  createdAt: number
  updatedAt: number
}

/** 一个可复用的地点（不是一次性的 GPS 点） */
export interface Location {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  /** 地点匹配半径（米） */
  radiusMeters: number
  visitCount: number
  photoCount: number
  createdAt: number
  updatedAt: number
}

/** 某次在某地点的停留 */
export interface Visit {
  id: string
  dayId: string
  locationId: string
  startAt: number
  endAt: number
  duration: number
  arrivalMode: MovementMode
  departureMode: MovementMode
  note: string
  photoCount: number
  isManual: boolean
  createdAt: number
  updatedAt: number
}

/** 照片元数据（实际像素数据在 photoData 表） */
export interface PhotoMeta {
  id: string
  fileName: string
  mimeType: string
  /** 拍摄时间（来自 EXIF，可能为空） */
  creationDate: number | null
  latitude: number | null
  longitude: number | null
  width: number | null
  height: number | null
  dayId: string | null
  locationId: string | null
  visitId: string | null
  importedAt: number
}

/** 照片二进制数据 */
export interface PhotoData {
  id: string
  blob: Blob
  thumbnail?: Blob
}

export type PhotoScopeKind = 'day' | 'location' | 'period'

export interface PhotoScope {
  kind: PhotoScopeKind
  id?: string
  period?: string
}

export interface DaySummary {
  id: string
  title: string
  subtitle: string
  visitCountText: string
  photoCountText: string
  distanceText: string
}

export interface TimelineItem {
  id: string
  kind: 'visit' | 'movement'
  title: string
  subtitle: string
  timeText: string
  photoCount: number
}

export interface MapLocationSnapshot {
  id: string
  name: string
  latitude: number
  longitude: number
  visitCount: number
  photoCount: number
}

/** JSON 备份格式 */
export interface BackupPayload {
  app: string
  version: number
  exportedAt: string
  days: Day[]
  locations: Location[]
  visits: Visit[]
  photos: PhotoMeta[]
  /** 可选：照片 id -> base64 data URL */
  photoData?: Record<string, string>
}

export interface ImportResult {
  imported: number
  skipped: number
  withGps: number
  withDate: number
  errors: string[]
}

export interface ImportProgress {
  done: number
  total: number
  current: string
}
