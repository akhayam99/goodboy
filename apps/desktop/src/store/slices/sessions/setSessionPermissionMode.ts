import type { ClaudePermissionMode, IsoDateTime, SessionId } from '@goodboy/types'
import { updateSessionPermissionMode } from '@goodboy/db'
import { tauriDatabase } from '../../../shared/lib/db'
import type { SetFn } from './types'

export const setSessionPermissionMode = (set: SetFn) => {
  return async (sessionId: SessionId, mode: ClaudePermissionMode) => {
    const now = new Date().toISOString() as IsoDateTime
    await updateSessionPermissionMode(tauriDatabase, sessionId, mode, now)
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, permissionMode: mode, updatedAt: now } : s,
      ),
    }))
  }
}
