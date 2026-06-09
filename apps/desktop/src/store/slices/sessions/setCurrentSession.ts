import type {
  IsoDateTime,
  Message,
  PlanWithCount,
  ProviderRunId,
  SessionId,
  TurnState,
} from '@goodboy/types';
import {
  listContextSlotsForSession,
  listAgentRunIdsForSession,
  listOpenQuestionsForSession,
  listTelemetryForSession,
  setSetting as dbSetSetting,
  summarizeSessionTelemetry,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { listPlansForSession as invokeListPlansForSession } from '../../../features/plans/plans';
import type { AgentKind } from '../../../features/session/agent-kind';
import { SETTING_LAST_SESSION_ID } from '../../../features/settings/settings';
import { EMPTY_LOADING } from '../../session-mutators';
import type { SessionLoadingFlags } from '../../store';
import type { GetFn, SetFn } from './types';

export const setCurrentSession = (set: SetFn, get: GetFn) => {
  return async (id: SessionId | null) => {
    // No-op when the click lands on the already-current session. Pulled into
    // the action so callers can pass the action ref directly (stable ref
    // helps memoized rows skip re-renders on session-switch clicks).
    if (get().currentSessionId === id) return;
    // Immediately swap the visible session so the UI doesn't freeze while
    // heavy per-session data loads. Each block (agents/transcript/telemetry/
    // slots/plans/summary) loads independently and flips its own loading flag
    // off when done, see SessionLoadingFlags. We intentionally do NOT await
    // these loaders here; the chat view and context panel render skeletons in
    // the meantime.
    const tSwitch = performance.now();
    // Cache check up-front: any slice already loaded for this task skips its
    // refetch. With the LRU keep-alive five sessions stay hot in the store,
    // so revisiting them is a near-zero-cost flag flip instead of 5 round
    // trips through Tauri IPC. Mutations refresh slices directly, so the
    // in-memory cache stays consistent until a process outside the app
    // touches the SQLite file.
    const stateNow = get();
    const cached = id
      ? {
          telemetry: stateNow.sessionTelemetry[id] !== undefined,
          slots: stateNow.sessionSlots[id] !== undefined,
          plans: stateNow.sessionPlans[id] !== undefined,
          agents: stateNow.sessionPhaseRuns[id] !== undefined,
        }
      : null;
    // Transcript flag is tricky on revisit: if agents are cached but the
    // session has no agents we never get a selectAgent call to clear it; if
    // the selected agent's transcript is already cached we shouldn't show a
    // skeleton at all.
    const cachedSelectedAgentId =
      id && cached?.agents ? (stateNow.selectedAgentId[id] ?? null) : null;
    const transcriptReady =
      id && cached?.agents
        ? cachedSelectedAgentId === null
          ? true // empty session
          : stateNow.transcripts[cachedSelectedAgentId] !== undefined
        : false;
    const initialLoading: SessionLoadingFlags = id
      ? {
          agents: cached ? !cached.agents : true,
          transcript: !transcriptReady,
          telemetry: cached ? !cached.telemetry : true,
          slots: cached ? !cached.slots : true,
          plans: cached ? !cached.plans : true,
          summary: true,
        }
      : EMPTY_LOADING;
    set((state) => ({
      currentSessionId: id,
      sessionSummary: null,
      sessionLoading: id ? { ...state.sessionLoading, [id]: initialLoading } : state.sessionLoading,
    }));
    // Fire-and-forget the persisted setting. Awaiting it here delayed every
    // downstream parallel fetch by the IPC round-trip (~5-50ms of dead time).
    void dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, id ?? '');
    if (!id) return;
    void get().loadSessionOverrides(id);
    const perf = (op: string) => {
      const t0 = performance.now();
      return () => {
        // eslint-disable-next-line no-console
        console.log(`[perf] session:${op} ${(performance.now() - t0).toFixed(0)}ms`);
      };
    };
    // eslint-disable-next-line no-console
    console.log(`[perf] session:switchSync ${(performance.now() - tSwitch).toFixed(0)}ms`);

    const markDone = (key: keyof SessionLoadingFlags): void => {
      set((state) => {
        if (state.currentSessionId !== id) return {};
        const current = state.sessionLoading[id] ?? EMPTY_LOADING;
        return {
          sessionLoading: { ...state.sessionLoading, [id]: { ...current, [key]: false } },
        };
      });
    };

    // Summary
    const endSummary = perf('summary');
    void summarizeSessionTelemetry(tauriDatabase, id)
      .then((summary) => {
        set((state) => (state.currentSessionId === id ? { sessionSummary: summary } : {}));
      })
      .catch(() => {})
      .finally(() => {
        endSummary();
        markDone('summary');
      });

    // GitHub PR: refresh head + detail for the opened session so its context
    // panel shows fresh CI / review state on every visit. No `force`, the
    // 60s/30s caches dedupe rapid back-and-forth between sessions.
    if (get().sessionBranches[id]) {
      void get()
        .refreshSessionPr(id)
        .then(() => get().refreshSessionPrDetail(id));
    }

    // Telemetry
    if (!cached?.telemetry) {
      const endTelemetry = perf('telemetry');
      void listTelemetryForSession(tauriDatabase, id)
        .then((telemetry) => {
          set((state) => ({
            sessionTelemetry: { ...state.sessionTelemetry, [id]: telemetry },
          }));
        })
        .catch(() => {})
        .finally(() => {
          endTelemetry();
          markDone('telemetry');
        });
    }

    // Context slots
    if (!cached?.slots) {
      const endSlots = perf('slots');
      void listContextSlotsForSession(tauriDatabase, id)
        .then((slots) => {
          set((state) => ({
            sessionSlots: { ...state.sessionSlots, [id]: slots },
          }));
        })
        .catch(() => {})
        .finally(() => {
          endSlots();
          markDone('slots');
        });
    }

    // Open questions: hydrate alongside slots so the sidebar gates
    // (PlanReadySuggestion + per-workflow NextStep CTA) can resolve their
    // block state for the just-loaded session without an extra round-trip.
    void listOpenQuestionsForSession(tauriDatabase, id, 'open')
      .then((qs) => {
        set((state) => ({
          sessionOpenQuestions: { ...state.sessionOpenQuestions, [id]: qs },
        }));
      })
      .catch(() => {});

    // Plans
    if (!cached?.plans) {
      const endPlans = perf('plans');
      void (async (): Promise<ReadonlyArray<PlanWithCount>> => {
        try {
          return await invokeListPlansForSession(id);
        } catch {
          return [];
        }
      })()
        .then((plans) => {
          set((state) => ({
            sessionPlans: { ...state.sessionPlans, [id]: plans },
          }));
        })
        .catch(() => {})
        .finally(() => {
          endPlans();
          markDone('plans');
        });
    }

    // Agents only: transcript is loaded lazily by ChatView when an agent is
    // selected (via selectAgent). Keeps session switch fast, no per-agent
    // history fetch blocks the UI.
    if (cached?.agents) {
      // Cached: phase runs + selected agent are already in store. transcript
      // flag still gets cleared by ChatView's selectAgent effect (cached or
      // fresh). Nothing else to do.
    } else {
      const endAgents = perf('agents+runIds');
      const endPhaseRunList = perf('agents:phaseRunList');
      const endRunIds = perf('agents:runIds');
      void Promise.all([
        invokeAgentList(id).finally(() => endPhaseRunList()),
        listAgentRunIdsForSession(tauriDatabase, id).finally(() => endRunIds()),
      ])
        .then(([agents, agentRunIds]) => {
          const previouslySelected = get().selectedAgentId[id] ?? null;
          const sortedAgents = [...agents].sort((a, b) => a.ordinal - b.ordinal);
          // Fresh entry defaults to the most recently created agent (highest
          // ordinal). Chronologically the latest is the one the user is most
          // likely returning to. Previous selection still wins on revisit.
          const fallbackAgent = sortedAgents[sortedAgents.length - 1] ?? null;
          const selectedAgent =
            (previouslySelected && agents.find((a) => a.id === previouslySelected)) ||
            fallbackAgent;

          // Seed agentRunHistory with EVERY provider run an agent ever spawned,
          // not just its latest. Recovered from turn_events (single source of
          // truth post restart) so aggregate token/cost counters in the sidebar
          // reflect the full agent lifetime, birth to death, instead of the
          // last turn.
          const seededHistory: Record<string, ReadonlyArray<ProviderRunId>> = {};
          const seededTurnState: Record<string, TurnState> = {};
          const session = get().sessions.find((s) => s.id === id);
          const sessionState =
            session?.state ??
            ({ kind: 'idle', lastActivityAt: new Date().toISOString() } as TurnState);
          for (const agent of agents) {
            const historical = agentRunIds.get(agent.id) ?? [];
            const merged: ProviderRunId[] = [...historical];
            if (agent.runId && !merged.includes(agent.runId)) merged.push(agent.runId);
            if (merged.length > 0) {
              seededHistory[agent.id] = merged;
            }
            if (agent.status === 'running' && agent.runId) {
              seededTurnState[agent.id] = {
                kind: 'running',
                runId: agent.runId,
                startedAt: agent.startedAt ?? (new Date().toISOString() as IsoDateTime),
              };
            } else if (agent.status === 'failed') {
              seededTurnState[agent.id] = {
                kind: 'error',
                message: 'agent failed',
                failedAt: agent.completedAt ?? (new Date().toISOString() as IsoDateTime),
              };
            } else {
              seededTurnState[agent.id] =
                sessionState.kind === 'ended'
                  ? sessionState
                  : { kind: 'idle', lastActivityAt: new Date().toISOString() as IsoDateTime };
            }
          }

          const kindOverridesFromDb: Record<string, AgentKind> = {};
          for (const agent of agents) {
            if (agent.kind) kindOverridesFromDb[agent.id] = agent.kind as AgentKind;
          }
          set((state) => ({
            sessionPhaseRuns: { ...state.sessionPhaseRuns, [id]: agents },
            selectedAgentId: {
              ...state.selectedAgentId,
              [id]: selectedAgent?.id ?? null,
            },
            agentRunHistory: { ...state.agentRunHistory, ...seededHistory },
            agentTurnState: { ...state.agentTurnState, ...seededTurnState },
            agentKindOverride: { ...state.agentKindOverride, ...kindOverridesFromDb },
          }));
          markDone('agents');

          // No selected agent → no chat to render → drop transcript flag now.
          // With a selected agent, ChatView's effect calls selectAgent which
          // owns the flag lifecycle from there.
          if (!selectedAgent) {
            set((state) => ({
              messages: { ...state.messages, [id]: [] as ReadonlyArray<Message> },
            }));
            markDone('transcript');
          }
        })
        .catch(() => {
          markDone('agents');
          markDone('transcript');
        })
        .finally(() => endAgents());
    }
  };
};
