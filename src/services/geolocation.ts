/** 浏览器定位封装 */

export interface GeoPosition {
  latitude: number
  longitude: number
  accuracy: number
}

export class GeoError extends Error {
  readonly code: number

  constructor(message: string, code: number) {
    super(message)
    this.name = 'GeoError'
    this.code = code
  }
}

function messageForError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return '定位权限被拒绝，请在浏览器设置中允许本站访问位置'
    case error.POSITION_UNAVAILABLE:
      return '暂时无法获取当前位置，请检查系统定位服务'
    case error.TIMEOUT:
      return '获取定位超时，请稍后重试'
    default:
      return '获取定位失败'
  }
}

/** 单次获取当前位置 */
export function getCurrentPosition(options?: PositionOptions): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new GeoError('当前浏览器不支持定位', -1))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      (error) => reject(new GeoError(messageForError(error), error.code)),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
        ...options,
      },
    )
  })
}

/** 是否支持定位 */
export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

/** 是否在安全上下文（https 或 localhost），定位 API 依赖它 */
export function isSecureContextAvailable(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext
}
