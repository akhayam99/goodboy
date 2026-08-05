import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { listMessagesForAgent, listTurnEventsForAgent } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentMarkViewed } from '../../../features/workflows/workflows';
import { workSurfaceFocus } from '../session-view/workSurfaceFocus';
import { EMPTY_LOADING } from '../../session-mutators';
import { flushTurnEvents } from '../transcripts/buffer';
import type { GetFn, SetFn } from './types';
import { stampAgentSubtreeViewed } from './stampAgentSubtreeViewed';

export const selectAgent = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, agentId: AgentId) => {
    const stampedAt = new Date().toISOString() as IsoDateTime;
    const prevAgentId = get().selectedAgentId[sessionId] ?? null;
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const additionalAgentIds = prevAgentId != null && prevAgentId !== agentId ? [prevAgentId] : [];
    const stamp = stampAgentSubtreeViewed({
      runs,
      rootAgentId: agentId,
      stampedAt,
      additionalAgentIds,
    });

    const markViewed = (): Promise<void> =>
      Promise.all(
        [...stamp.agentIds].map((id) =>
          invokeAgentMarkViewed(id, stampedAt).catch(() => undefined),
        ),
      ).then(() => undefined);

    const stampRuns = (runs: ReadonlyArray<Agent>): ReadonlyArray<Agent> =>
      stampAgentSubtreeViewed({
        runs,
        rootAgentId: agentId,
        stampedAt,
        additionalAgentIds,
      }).runs;

    set((state) =>
      workSurfaceFocus({
        sessionId,
        focus: { kind: 'agent', agentId },
        activeLens: state.activeLens,
        sessionStudio: state.sessionStudio,
        selectedAgentId: state.selectedAgentId,
      }),
    );

    const cached = get().transcripts[agentId];
    if (cached) {
      if (import.meta.env.DEV) {
        console.log(`[perf] selectAgent:${agentId} cached`);
      }
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
      await markViewed();
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
    flushTurnEvents();
    const liveLengthAtInitialRead = get().transcripts[agentId]?.length ?? null;
    try {
      const [messages, events] = await Promise.all([
        listMessagesForAgent(tauriDatabase, agentId, { limit: INITIAL_LIMIT }),
        listTurnEventsForAgent(tauriDatabase, agentId, { limit: INITIAL_LIMIT }),
      ]);
      if (import.meta.env.DEV) {
        console.log(
          `[perf] selectAgent:initial ${(performance.now() - tInitial).toFixed(0)}ms (${events.length} events)`,
        );
      }
      set((state) => {
        const current = state.sessionLoading[sessionId] ?? EMPTY_LOADING;
        const hasLiveAppend =
          (state.transcripts[agentId]?.length ?? null) !== liveLengthAtInitialRead;
        return {
          ...(hasLiveAppend ? {} : { transcripts: { ...state.transcripts, [agentId]: events } }),
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
      await markViewed();
      void get().refreshUnreadWorkspaces();
      if (events.length === INITIAL_LIMIT) {
        const tFull = performance.now();
        flushTurnEvents();
        const liveLengthAtFullRead = get().transcripts[agentId]?.length ?? null;
        void Promise.all([
          listMessagesForAgent(tauriDatabase, agentId),
          listTurnEventsForAgent(tauriDatabase, agentId),
        ])
          .then(([fullMessages, fullEvents]) => {
            if (import.meta.env.DEV) {
              console.log(
                `[perf] selectAgent:full ${(performance.now() - tFull).toFixed(0)}ms (${fullEvents.length} events)`,
              );
            }
            set((state) => {
              const current = state.transcripts[agentId];
              if ((current?.length ?? null) !== liveLengthAtFullRead) {
                return {};
              }
              if (current && current.length > fullEvents.length) {
                return {};
              }
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
