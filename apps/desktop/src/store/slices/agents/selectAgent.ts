import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import {
  listMessagesForAgent,
  listTurnEventEntriesForAgent,
  listTurnEventsForAgent,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { isWindowInFront } from '../../../shared/lib/isWindowInFront';
import { invokeAgentMarkViewed } from '../../../features/workflows/workflows';
import { workSurfaceFocus } from '../session-view/workSurfaceFocus';
import { EMPTY_LOADING, purgedAgentIds } from '../sessions/sessionMutators';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { flushTurnEvents } from '../transcripts/buffer';
import { mergeTranscript } from '../transcripts/mergeTranscript';
import { STREAM_BUDGETS } from '../transcripts/streamBudgets';
import type { GetFn, SetFn } from './types';
import { stampAgentSubtreeViewed } from './stampAgentSubtreeViewed';
import { unseenBoundariesOf } from './unseenBoundariesOf';

const TRANSCRIPT_READS = createLatestOnly();

type SelectOptions = {
  readonly isSelecting?: boolean;
};

export const selectAgent = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, agentId: AgentId, options: SelectOptions = {}) => {
    const isSelecting = options.isSelecting ?? true;
    const stampedAt = new Date().toISOString() as IsoDateTime;
    const prevAgentId = get().selectedAgentId[sessionId] ?? null;
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const additionalAgentIds =
      isSelecting && prevAgentId != null && prevAgentId !== agentId ? [prevAgentId] : [];
    const selection = (state: ReturnType<GetFn>) =>
      isSelecting ? { selectedAgentId: { ...state.selectedAgentId, [sessionId]: agentId } } : {};
    const stamp = stampAgentSubtreeViewed({
      runs,
      rootAgentId: agentId,
      stampedAt,
      additionalAgentIds,
    });

    let isSeen = false;

    const markViewed = (): Promise<void> => {
      if (!isSeen) {
        return Promise.resolve();
      }
      return Promise.all(
        [...stamp.agentIds].map((id) =>
          invokeAgentMarkViewed(id, stampedAt).catch(() => undefined),
        ),
      ).then(() => undefined);
    };

    const stampRuns = (runs: ReadonlyArray<Agent>): ReadonlyArray<Agent> => {
      if (!isSeen) {
        return runs;
      }
      return stampAgentSubtreeViewed({
        runs,
        rootAgentId: agentId,
        stampedAt,
        additionalAgentIds,
      }).runs;
    };

    if (isSelecting) {
      set((state) => ({
        ...workSurfaceFocus({
          sessionId,
          focus: { kind: 'agent', agentId },
          activeLens: state.activeLens,
          selectedAgentId: state.selectedAgentId,
        }),
        agentUnseenSince: unseenBoundariesOf({
          boundaries: state.agentUnseenSince,
          agent: runs.find((candidate) => candidate.id === agentId),
          leftAgentId: prevAgentId,
          agentId,
        }),
      }));
    }

    const claim = TRANSCRIPT_READS.claim({ key: agentId });
    const cached = get().transcripts[agentId];
    if (cached) {
      if (import.meta.env.DEV) {
        console.log(`[perf] selectAgent:${agentId} cached`);
      }
      isSeen = isWindowInFront();
      set((state) => {
        const current = state.sessionLoading[sessionId] ?? EMPTY_LOADING;
        return {
          ...selection(state),
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
        ...selection(state),
        sessionLoading: {
          ...state.sessionLoading,
          [sessionId]: { ...current, transcript: true },
        },
      };
    });
    const INITIAL_LIMIT = STREAM_BUDGETS.initialTranscriptRows;
    const tInitial = performance.now();
    flushTurnEvents();
    const liveLengthAtInitialRead = get().transcripts[agentId]?.length ?? null;
    let isLiveTailOnly = false;
    try {
      const [messages, events] = await Promise.all([
        listMessagesForAgent(tauriDatabase, agentId, { limit: INITIAL_LIMIT }),
        listTurnEventsForAgent(tauriDatabase, agentId, { limit: INITIAL_LIMIT }),
      ]);
      if (!claim.isCurrent()) {
        return;
      }
      if (import.meta.env.DEV) {
        console.log(
          `[perf] selectAgent:initial ${(performance.now() - tInitial).toFixed(0)}ms (${events.length} events)`,
        );
      }
      isSeen = isWindowInFront();
      set((state) => {
        const current = state.sessionLoading[sessionId] ?? EMPTY_LOADING;
        const hasLiveAppend =
          (state.transcripts[agentId]?.length ?? null) !== liveLengthAtInitialRead;
        isLiveTailOnly = hasLiveAppend;
        return {
          ...(hasLiveAppend ? {} : { transcripts: { ...state.transcripts, [agentId]: events } }),
          ...(isSelecting ? { messages: { ...state.messages, [sessionId]: messages } } : {}),
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
      if (events.length === INITIAL_LIMIT || isLiveTailOnly) {
        const tFull = performance.now();
        flushTurnEvents();
        void Promise.all([
          listMessagesForAgent(tauriDatabase, agentId),
          listTurnEventEntriesForAgent({ db: tauriDatabase, agentId }),
        ])
          .then(([fullMessages, stored]) => {
            if (!claim.isCurrent() || purgedAgentIds.has(agentId)) {
              return;
            }
            if (import.meta.env.DEV) {
              console.log(
                `[perf] selectAgent:full ${(performance.now() - tFull).toFixed(0)}ms (${stored.length} events)`,
              );
            }
            set((state) => ({
              transcripts: {
                ...state.transcripts,
                [agentId]: mergeTranscript({ stored, live: state.transcripts[agentId] ?? [] }),
              },
              ...(isSelecting
                ? { messages: { ...state.messages, [sessionId]: fullMessages } }
                : {}),
            }));
          })
          .catch(() => {});
      }
    } catch (err) {
      if (!claim.isCurrent()) {
        return;
      }
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
