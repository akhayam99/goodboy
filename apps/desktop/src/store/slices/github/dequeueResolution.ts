import { deletePendingResolution } from '@goodboy/db'
import type { SessionId } from '@goodboy/types'
import { tauriDatabase } from '../../../shared/lib/db'
import type { GetFn, SetFn } from './types'

export const dequeueResolution = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, threadId: string): Promise<void> => {
    await deletePendingResolution(tauriDatabase, sessionId, threadId)
    set((state) => ({
      sessionPendingResolutions: {
        ...state.sessionPendingResolutions,
        [sessionId]: (state.sessionPendingResolutions[sessionId] ?? []).filter(
          (r) => r.threadId !== threadId,
        ),
      },
    }))
  }
}
