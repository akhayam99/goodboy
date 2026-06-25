import type { SessionId } from '@goodboy/types'
import { listTelemetryForSession } from '@goodboy/db'
import { tauriDatabase } from '../../../shared/lib/db'
import type { SetFn } from './types'

export const loadSessionTelemetry = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    const records = await listTelemetryForSession(tauriDatabase, sessionId)
    set((state) => ({
      sessionTelemetry: { ...state.sessionTelemetry, [sessionId]: records },
    }))
  }
}
