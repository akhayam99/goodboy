import type { AgentId, SessionId, TurnEvent } from '@goodboy/types';
import { invokeAgentSetProviderSessionId } from '../../../features/workflows/workflows';
import { formatError } from '../../../shared/lib/errors';
import { queueTurnEventInsert } from './queue';
import type { SetFn } from './types';

export const appendTurnEvent = (set: SetFn) => {
  return (agentId: AgentId, sessionId: SessionId, event: TurnEvent) => {
    // The set updater stays PURE — it only derives next state. The side effects
    // (DB queue + provider-session-id persist) run after, never inside the
    // updater: Zustand updaters can be re-invoked (React strict mode), and
    // queueing inside one used to double-insert the row.
    set((state) => {
      const existing = state.transcripts[agentId] ?? [];
      const updatedTranscripts = { ...state.transcripts, [agentId]: [...existing, event] };
      if (event.kind === 'unknown_payload') {
        const key = `${event.adapter}:${event.payloadType}`;
        return {
          transcripts: updatedTranscripts,
          unknownPayloadCounts: {
            ...state.unknownPayloadCounts,
            [key]: (state.unknownPayloadCounts[key] ?? 0) + 1,
          },
        };
      }
      // M1: capture claude's session id from the `system` init event so the
      // next turn for this agent can pass `--resume <id>`.
      if (event.kind === 'provider_session_init') {
        const runs = state.sessionPhaseRuns[sessionId] ?? [];
        const updatedRuns = runs.map((s) =>
          s.id === agentId ? { ...s, providerSessionId: event.providerSessionId } : s,
        );
        return {
          transcripts: updatedTranscripts,
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: updatedRuns },
        };
      }
      return { transcripts: updatedTranscripts };
    });

    queueTurnEventInsert({
      id: crypto.randomUUID(),
      sessionId,
      agentId,
      event,
    });

    // Persist the provider session id so the next turn can `--resume`. Tolerate
    // transient DB failures (worst case: next turn starts fresh, no data loss).
    if (event.kind === 'provider_session_init') {
      void invokeAgentSetProviderSessionId(agentId, event.providerSessionId).catch((err) => {
        if (import.meta.env.DEV) {
          const message = formatError(err);
          console.warn(`[turn-events] persist provider_session_id failed: ${message}`);
        }
      });
    }
  };
};
