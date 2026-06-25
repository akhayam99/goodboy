import type { AgentId, SessionId } from '@goodboy/types'
import { listMessagesForAgent, listTurnEventsForAgent } from '@goodboy/db'
import { tauriDatabase } from '../../../shared/lib/db'
import type { SetFn } from './types'

export const loadTranscript = (set: SetFn) => {
  return async (agentId: AgentId, sessionId: SessionId) => {
    const [messages, events] = await Promise.all([
      listMessagesForAgent(tauriDatabase, agentId),
      listTurnEventsForAgent(tauriDatabase, agentId),
    ])
    set((state) => ({
      messages: { ...state.messages, [sessionId]: messages },
      transcripts: { ...state.transcripts, [agentId]: events },
    }))
  }
}
