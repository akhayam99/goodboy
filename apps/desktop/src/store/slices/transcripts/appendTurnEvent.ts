import type { AgentId, SessionId, TurnEvent } from '@goodboy/types'
import { invokeAgentSetProviderSessionId } from '../../../features/workflows/workflows'
import { formatError } from '../../../shared/lib/errors'
import { queueTurnEventInsert } from './queue'
import type { SetFn } from './types'

export const appendTurnEvent = (set: SetFn) => {
  return (agentId: AgentId, sessionId: SessionId, event: TurnEvent) => {
    set((state) => {
      const existing = state.transcripts[agentId] ?? []
      const updatedTranscripts = { ...state.transcripts, [agentId]: [...existing, event] }
      if (event.kind === 'unknown_payload') {
        const key = `${event.adapter}:${event.payloadType}`
        return {
          transcripts: updatedTranscripts,
          unknownPayloadCounts: {
            ...state.unknownPayloadCounts,
            [key]: (state.unknownPayloadCounts[key] ?? 0) + 1,
          },
        }
      }
      if (event.kind === 'provider_session_init') {
        const runs = state.sessionPhaseRuns[sessionId] ?? []
        const updatedRuns = runs.map((s) =>
          s.id === agentId ? { ...s, providerSessionId: event.providerSessionId } : s,
        )
        return {
          transcripts: updatedTranscripts,
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: updatedRuns },
        }
      }
      return { transcripts: updatedTranscripts }
    })

    queueTurnEventInsert({
      id: crypto.randomUUID(),
      sessionId,
      agentId,
      event,
    })

    if (event.kind === 'provider_session_init') {
      void invokeAgentSetProviderSessionId(agentId, event.providerSessionId).catch((err) => {
        if (import.meta.env.DEV) {
          const message = formatError(err)
          console.warn(`[turn-events] persist provider_session_id failed: ${message}`)
        }
      })
    }
  }
}
