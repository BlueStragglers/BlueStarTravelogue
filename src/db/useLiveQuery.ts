import { onScopeDispose, ref, watch, type Ref } from 'vue'
import { liveQuery } from 'dexie'

/**
 * 把 Dexie 的 liveQuery 封装成 Vue ref。
 * - 数据库任意变更时自动重新查询并更新结果；
 * - deps 变化时（例如当前选中的 id 变化）重新订阅。
 */
export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  initialValue: T,
  deps: Ref<unknown> | Ref<unknown>[] = [],
): Ref<T> {
  const result = ref(initialValue) as Ref<T>
  let subscription: { unsubscribe: () => void } | null = null

  const start = () => {
    subscription?.unsubscribe()
    try {
      subscription = liveQuery(querier).subscribe({
        next: (value) => {
          result.value = value
        },
        error: (error) => {
          console.error('[useLiveQuery]', error)
        },
      })
    } catch (error) {
      console.error('[useLiveQuery] subscribe failed', error)
    }
  }

  start()

  const watched = Array.isArray(deps) ? deps : [deps]
  if (watched.length > 0) {
    watch(watched, start, { deep: false })
  }

  onScopeDispose(() => subscription?.unsubscribe())

  return result
}
