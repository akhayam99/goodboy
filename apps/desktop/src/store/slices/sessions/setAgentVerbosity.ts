import type { AgentId, SessionId, VerbosityLevel } from '@goodboy/types'
import { invokeAgentSetVerbosity } from '../../../features/workflows/workflows'
import type { SetFn } from './types'

export const setAgentVerbosity = (set: SetFn) => {
  return async (sessionId: SessionId, agentId: AgentId, level: VerbosityLevel) => {
    await invokeAgentSetVerbosity(agentId, level)
    set((state) => {
      const runs = state.sessionPhaseRuns[sessionId] ?? []
      return {
        sessionPhaseRuns: {
          ...state.sessionPhaseRuns,
          [sessionId]: runs.map((r) => (r.id === agentId ? { ...r, verbosity: level } : r)),
        },
      }
    })
  }
}
