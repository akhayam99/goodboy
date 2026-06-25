import type { SessionId } from '@goodboy/types'
import { invokeAgentList } from '../../../features/workflows/workflows'
import type { SetFn } from './types'

export const loadPhaseRunsForSession = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    const runs = await invokeAgentList(sessionId)
    set((state) => ({ sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: runs } }))
  }
}
