import type { WorkspaceId } from '@goodboy/types'
import { listSessionsForWorkspace } from '@goodboy/db'
import { tauriDatabase } from '../../../shared/lib/db'
import type { SetFn } from './types'

export const refreshSessions = (set: SetFn) => {
  return async (workspaceId: WorkspaceId) => {
    const sessions = await listSessionsForWorkspace(tauriDatabase, workspaceId)
    set({ sessions })
  }
}
