import { relaunch } from '@tauri-apps/plugin-process'
import { formatError } from '../../../shared/lib/errors'
import { getPendingUpdate } from './pendingUpdate'
import type { GetFn, SetFn } from './types'

export const installUpdate = (set: SetFn, _get: GetFn) => {
  return async (): Promise<void> => {
    const update = getPendingUpdate()
    if (!update) {
      return
    }
    set({ updaterStatus: 'downloading', updateError: null })
    try {
      await update.downloadAndInstall()
      await relaunch()
    } catch (err) {
      set({ updaterStatus: 'error', updateError: formatError(err) })
    }
  }
}
