/**
 * 地理计算工具。
 *
 * 坐标约定：全项目统一使用 WGS-84（照片 EXIF 与浏览器 Geolocation 的原始坐标）。
 * 本 PWA 默认使用 OSM / Carto 等 WGS-84 对齐的瓦片，因此地图上直接显示原始坐标即可，
 * 不需要 GCJ-02 纠偏。
 *
 * 下面仍保留 GCJ-02 转换（移植自 iOS 版 GeoCoordinateHelper），
 * 以便将来切换到高德/腾讯等国内 GCJ-02 瓦片时使用。
 */

export interface LatLng {
  latitude: number
  longitude: number
}

const EARTH_RADIUS = 6378245.0
const EE = 0.00669342162296594323

/** 是否位于中国大陆（粗略矩形 + 港澳台剔除） */
export function isInMainlandChina(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
  if (longitude < 73.66 || longitude > 135.05) return false
  if (latitude < 3.86 || latitude > 53.55) return false

  // 香港 / 澳门
  if (latitude >= 22.0 && latitude <= 23.9 && longitude >= 113.825 && longitude <= 114.425) {
    return false
  }
  // 台湾
  if (latitude >= 21.8 && latitude <= 25.5 && longitude >= 119.3 && longitude <= 122.1) {
    return false
  }

  return true
}

function transformLatitude(x: number, y: number): number {
  let result =
    -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  result +=
    ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0
  result += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0
  result +=
    ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) /
    3.0
  return result
}

function transformLongitude(x: number, y: number): number {
  let result =
    300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  result +=
    ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0
  result += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0
  result +=
    ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) /
    3.0
  return result
}

function offset(latitude: number, longitude: number): { dLat: number; dLng: number } {
  let deltaLatitude = transformLatitude(longitude - 105.0, latitude - 35.0)
  let deltaLongitude = transformLongitude(longitude - 105.0, latitude - 35.0)
  const radians = (latitude / 180.0) * Math.PI
  let magic = Math.sin(radians)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  deltaLatitude = (deltaLatitude * 180.0) / (((EARTH_RADIUS * (1 - EE)) / (magic * sqrtMagic)) * Math.PI)
  deltaLongitude = (deltaLongitude * 180.0) / ((EARTH_RADIUS / sqrtMagic) * Math.cos(radians) * Math.PI)
  return { dLat: deltaLatitude, dLng: deltaLongitude }
}

/** WGS-84 -> GCJ-02 */
export function wgs84ToGcj02(latitude: number, longitude: number): LatLng {
  if (!isInMainlandChina(latitude, longitude)) return { latitude, longitude }
  const { dLat, dLng } = offset(latitude, longitude)
  return { latitude: latitude + dLat, longitude: longitude + dLng }
}

/** GCJ-02 -> WGS-84（迭代反解） */
export function gcj02ToWgs84(latitude: number, longitude: number): LatLng {
  if (!isInMainlandChina(latitude, longitude)) return { latitude, longitude }
  let correctedLat = latitude
  let correctedLng = longitude
  for (let i = 0; i < 2; i += 1) {
    const gcj = wgs84ToGcj02(correctedLat, correctedLng)
    const dLat = gcj.latitude - latitude
    const dLng = gcj.longitude - longitude
    correctedLat -= dLat
    correctedLng -= dLng
  }
  return { latitude: correctedLat, longitude: correctedLng }
}

const MEAN_EARTH_RADIUS = 6371008.8

/** 两点间球面距离（米，Haversine） */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * MEAN_EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 是否为有效坐标 */
export function isValidCoordinate(latitude: number | null, longitude: number | null): boolean {
  if (latitude == null || longitude == null) return false
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false
  return !(latitude === 0 && longitude === 0)
}
