import { listNotifications } from '@goodboy/db'
import { tauriDatabase } from '../../../shared/lib/db'
import type { SetFn } from './types'

export const loadNotifications = (set: SetFn) => {
  return async () => {
    const notifications = await listNotifications(tauriDatabase)
    set({ notifications })
  }
}
