import { listDiffCommentsForSession } from '@goodboy/db'
import type { SessionId } from '@goodboy/types'
import { tauriDatabase } from '../../../shared/lib/db'
import { diffCommentsInFlight, type GetFn, type SetFn } from './types'

export const loadDiffComments = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId) => {
    if (get().diffComments[sessionId] !== undefined) {
      return
    }
    if (diffCommentsInFlight.has(sessionId)) {
      return
    }
    diffCommentsInFlight.add(sessionId)
    try {
      const comments = await listDiffCommentsForSession(tauriDatabase, sessionId)
      set((state) => ({
        diffComments: { ...state.diffComments, [sessionId]: comments },
      }))
    } finally {
      diffCommentsInFlight.delete(sessionId)
    }
  }
}
