import { clearAllNotifications } from '@goodboy/db'
import { tauriDatabase } from '../../../shared/lib/db'
import type { SetFn } from './types'

export const clearNotifications = (set: SetFn) => {
  return async () => {
    await clearAllNotifications(tauriDatabase)
    set({ notifications: [] })
  }
}
