import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { listMessagesForAgent, listTurnEventsForAgent } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentMarkViewed } from '../../../features/workflows/workflows';
import { EMPTY_LOADING } from '../../session-mutators';
import type { GetFn, SetFn } from './types';

export const selectAgent = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, agentId: AgentId) => {
    const stampedAt = new Date().toISOString() as IsoDateTime;
    const prevAgentId = get().selectedAgentId[sessionId] ?? null;
    const stampAgents = new Set<AgentId>([agentId]);
    if (prevAgentId && prevAgentId !== agentId) stampAgents.add(prevAgentId);

    for (const id of stampAgents) {
      void invokeAgentMarkViewed(id, stampedAt).catch(() => undefined);
    }

    const stampRuns = (runs: ReadonlyArray<Agent>): ReadonlyArray<Agent> =>
      runs.map((s) => (stampAgents.has(s.id) ? { ...s, lastViewedAt: stampedAt } : s));

    const cached = get().transcripts[agentId];
    if (cached) {
      // eslint-disable-next-line no-console
      console.log(`[perf] selectAgent:${agentId} cached`);
      set((state) => {
        const current = state.sessionLoading[sessionId] ?? EMPTY_LOADING;
        return {
          selectedAgentId: { ...state.selectedAgentId, [sessionId]: agentId },
          sessionLoading: {
            ...state.sessionLoading,
            [sessionId]: { ...current, transcript: false },
          },
          sessionPhaseRuns: {
            ...state.sessionPhaseRuns,
            [sessionId]: stampRuns(state.sessionPhaseRuns[sessionId] ?? []),
          },
        };
      });
      void get().refreshUnreadWorkspaces();
      return;
    }
    set((state) => {
      const current = state.sessionLoading[sessionId] ?? EMPTY_LOADING;
      return {
        selectedAgentId: { ...state.selectedAgentId, [sessionId]: agentId },
        sessionLoading: {
          ...state.sessionLoading,
          [sessionId]: { ...current, transcript: true },
        },
      };
    });
    const INITIAL_LIMIT = 50;
    const tInitial = performance.now();
    try {
      const [messages, events] = await Promise.all([
        listMessagesForAgent(tauriDatabase, agentId, { limit: INITIAL_LIMIT }),
        listTurnEventsForAgent(tauriDatabase, agentId, { limit: INITIAL_LIMIT }),
      ]);
      // eslint-disable-next-line no-console
      console.log(
        `[perf] selectAgent:initial ${(performance.now() - tInitial).toFixed(0)}ms (${events.length} events)`,
      );
      set((state) => {
        const current = state.sessionLoading[sessionId] ?? EMPTY_LOADING;
        return {
          transcripts: { ...state.transcripts, [agentId]: events },
          messages: { ...state.messages, [sessionId]: messages },
          sessionLoading: {
            ...state.sessionLoading,
            [sessionId]: { ...current, transcript: false },
          },
          sessionPhaseRuns: {
            ...state.sessionPhaseRuns,
            [sessionId]: stampRuns(state.sessionPhaseRuns[sessionId] ?? []),
          },
        };
      });
      void get().refreshUnreadWorkspaces();
      if (events.length === INITIAL_LIMIT) {
        const tFull = performance.now();
        void Promise.all([
          listMessagesForAgent(tauriDatabase, agentId),
          listTurnEventsForAgent(tauriDatabase, agentId),
        ])
          .then(([fullMessages, fullEvents]) => {
            // eslint-disable-next-line no-console
            console.log(
              `[perf] selectAgent:full ${(performance.now() - tFull).toFixed(0)}ms (${fullEvents.length} events)`,
            );
            set((state) => {
              const current = state.transcripts[agentId];
              if (current && current.length > fullEvents.length) return {};
              return {
                transcripts: { ...state.transcripts, [agentId]: fullEvents },
                messages: { ...state.messages, [sessionId]: fullMessages },
              };
            });
          })
          .catch(() => {});
      }
    } catch (err) {
      set((state) => {
        const current = state.sessionLoading[sessionId] ?? EMPTY_LOADING;
        return {
          sessionLoading: {
            ...state.sessionLoading,
            [sessionId]: { ...current, transcript: false },
          },
        };
      });
      throw err;
    }
  };
};
