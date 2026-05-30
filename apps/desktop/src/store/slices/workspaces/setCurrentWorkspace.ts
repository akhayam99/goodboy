import type {
  Agent,
  IsoDateTime,
  ProviderRunId,
  SessionExternalTask,
  TurnState,
  Workflow,
  WorkspaceId,
} from '@goodboy/types';
import {
  listAgentsForSessions,
  listExternalTasksForWorkspace,
  listSessionsForWorkspace,
  listWorktreesForSessions,
  setSetting as dbSetSetting,
  summarizeWorkspaceProviderTelemetry,
  summarizeWorkspaceTelemetry,
  touchWorkspaceLastAccessed,
  updateSessionState,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { invokeBudgetRuleList } from '../../../features/budget/budget';
import { invokeSkillList } from '../../../features/skills/skills';
import {
  invokeWorkflowList,
  invokeWorkflowsForSession,
  invokeStepDefList,
} from '../../../features/workflows/workflows';
import type { AgentKind } from '../../../features/session/agent-kind';
import {
  SETTING_LAST_SESSION_ID,
  SETTING_LAST_WORKSPACE_ID,
} from '../../../features/settings/settings';
import { buildProviderSpendBreakdown } from '../budget';
import type { GetFn, SetFn } from './types';

export function setCurrentWorkspace(set: SetFn, get: GetFn) {
  return async (id: WorkspaceId | null) => {
    // Cancel any running turns before clearing state, orphaned Rust child processes
    // keep emitting turn_events into stale sessionIds if we don't stop them first.
    const runningSessions = get().sessions.filter((s) => s.state.kind === 'running');
    await Promise.all(
      runningSessions.map((s) =>
        cancelTurn((s.state as { kind: 'running'; runId: ProviderRunId }).runId).catch(() => {
          // best-effort: Rust TurnRegistry may have already cleaned up
        }),
      ),
    );

    // Option A: wipe all per-session maps unconditionally. Simpler than filtering by
    // workspaceId (Option B) and correct because setCurrentSession reloads from DB
    // on demand, the cache is cheap to rebuild, stale cross-workspace data is not.
    set({
      currentWorkspaceId: id,
      currentSessionId: null,
      sessions: [],
      // Drop the archived cache: lazy-reloads on next Archived-tab open.
      archivedSessions: {},
      sessionSummary: null,
      workspaceSummary: null,
      transcripts: {},
      messages: {},
      sessionTelemetry: {},
      sessionSlots: {},
      slotHistory: {},
      sessionWorktrees: {},
      sessionBranches: {},
      sessionPhaseRuns: {},
      selectedAgentId: {},
      agentRunHistory: {},
      agentTurnState: {},
      sessionMergeConflicts: {},
      sessionBudgets: {},
      summarizerStatus: {},
      sessionNextActions: {},
      budgetAlerts: [],
      unknownPayloadCounts: {},
      sidebarSessionSearch: '',
      sidebarStateFilter: [],
      sidebarProviderFilter: [],
      sessionLoading: {},
    });
    if (id) {
      const touchNow = new Date().toISOString() as IsoDateTime;
      set((state) => ({
        workspaces: state.workspaces.map((w) =>
          w.id === id ? { ...w, lastAccessedAt: touchNow } : w,
        ),
      }));
      touchWorkspaceLastAccessed(tauriDatabase, id).catch(() => undefined);

      // Critical path = what the sidebar needs to paint: sessions (rail rows),
      // worktrees (branch chip + github polling signature), agents (unread
      // dots). Every other workspace-scoped load (telemetry summary, provider
      // summary, budget rules, skills, phase templates) feeds chips or
      // composer/menu surfaces that the user reaches well after first paint,
      // so we kick them off as fire-and-forget AFTER the sessions render.
      // Each DB call serializes through the Rust `Mutex<Connection>`; trimming
      // the awaited set from 6 to 1 (sessions) cuts the blocking time for
      // n-bro's 7-session workspace switch by ~5× mutex acquisitions.
      const tWsLoad = performance.now();
      const loadedSessions = await listSessionsForWorkspace(tauriDatabase, id);
      // Boot-recovery: a session row in 'running' state is necessarily orphaned
      // here, the Rust TurnRegistry is reset on every app start, so there is
      // no live process to reattach to. Normalize to 'idle' so the UI re-enables
      // the input. Persist the correction back to the DB.
      const recoveryNow = new Date().toISOString() as IsoDateTime;
      const sessions = await Promise.all(
        loadedSessions.map(async (s) => {
          if (s.state.kind !== 'running') return s;
          const idleState: TurnState = { kind: 'idle', lastActivityAt: recoveryNow };
          await updateSessionState(tauriDatabase, s.id, idleState, recoveryNow).catch(
            () => undefined,
          );
          return { ...s, state: idleState, updatedAt: recoveryNow };
        }),
      );
      // Batched per-session fan-out: 2 IN-clause queries instead of 2N round
      // trips through the Rust `Mutex<Connection>`. External-task hydration
      // piggy-backs on the same batch, single query for the whole workspace.
      const sessionIds = sessions.map((s) => s.id);
      const [worktreesBySession, agentsBySession, externalTasks] = await Promise.all([
        listWorktreesForSessions(tauriDatabase, sessionIds),
        // Unread indicators on workspace- and session-rows derive from each
        // agent's `lastFinishedAt` vs `lastViewedAt` columns, so the full
        // agent set has to be in memory before the sidebar can paint dots.
        listAgentsForSessions(tauriDatabase, sessionIds),
        listExternalTasksForWorkspace(tauriDatabase, id),
      ]);
      const sessionWorktrees: Record<string, ReadonlyArray<string>> = {};
      const sessionBranches: Record<string, string> = {};
      const sessionPhaseRuns: Record<string, ReadonlyArray<Agent>> = {};
      const kindOverridesFromDb: Record<string, AgentKind> = {};
      for (const s of sessions) {
        const rows = worktreesBySession.get(s.id) ?? [];
        if (rows.length > 0) {
          sessionWorktrees[s.id] = rows.map((r) => r.worktreePath);
          const primaryRow = rows[0];
          if (primaryRow) sessionBranches[s.id] = primaryRow.branch;
        }
        const runs = agentsBySession.get(s.id) ?? [];
        sessionPhaseRuns[s.id] = runs;
        for (const run of runs) {
          if (run.kind) kindOverridesFromDb[run.id] = run.kind as AgentKind;
        }
      }
      const externalTasksMap: Record<string, SessionExternalTask> = {};
      for (const task of externalTasks) externalTasksMap[task.sessionId] = task;
      // First paint commit, sidebar can render the rail right now.
      set((state) => ({
        sessions,
        sessionWorktrees,
        sessionBranches,
        sessionPhaseRuns,
        agentKindOverride: { ...state.agentKindOverride, ...kindOverridesFromDb },
        sessionExternalTasks: { ...state.sessionExternalTasks, ...externalTasksMap },
      }));
      // eslint-disable-next-line no-console
      console.log(`[perf] workspace:firstPaint ${(performance.now() - tWsLoad).toFixed(0)}ms`);

      // Deferred loads, fire AFTER first paint so the UI is interactive
      // immediately. Each resolves into its own `set` call when ready.
      void (async (): Promise<void> => {
        const tWsDefer = performance.now();
        const [
          workspaceSummary,
          providerSummaries,
          budgetRules,
          skills,
          phaseTemplates,
          stepLibrary,
        ] = await Promise.all([
          summarizeWorkspaceTelemetry(tauriDatabase, id).catch(() => null),
          summarizeWorkspaceProviderTelemetry(tauriDatabase, id).catch(() => []),
          invokeBudgetRuleList().catch(() => []),
          invokeSkillList(id).catch(() => []),
          invokeWorkflowList(id).catch(() => []),
          invokeStepDefList(id).catch(() => []),
        ]);
        // Workspace may have changed under us while these were inflight.
        if (get().currentWorkspaceId !== id) return;
        const workflowById = new Map(phaseTemplates.map((t) => [t.id, t]));
        // Backfill workflows that a session attached but which were later
        // soft-deleted from the preset list: workflow_list excludes them, but
        // the session must keep resolving them. They carry deletedAt so the
        // preset picker still filters them out.
        const extraById = new Map<string, Workflow>();
        const needBackfill = get().sessions.filter((s) =>
          s.workflowIds.some((wid) => !workflowById.has(wid)),
        );
        await Promise.all(
          needBackfill.map(async (s) => {
            const attached = await invokeWorkflowsForSession(s.id).catch(() => []);
            for (const wf of attached) if (!workflowById.has(wf.id)) extraById.set(wf.id, wf);
          }),
        );
        const resolveById = new Map<string, Workflow>([...workflowById, ...extraById]);
        const sessionWorkflows: Record<string, ReadonlyArray<Workflow>> = {};
        for (const s of get().sessions) {
          const attached = s.workflowIds
            .map((wid) => resolveById.get(wid) ?? null)
            .filter((w): w is Workflow => w !== null);
          if (attached.length > 0) sessionWorkflows[s.id] = attached;
        }
        const mergedTemplates = [...phaseTemplates, ...extraById.values()];
        set((state) => ({
          sessionWorkflows,
          workspaceSummary,
          providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules),
          skills: { ...state.skills, [id]: skills },
          phaseTemplates: { ...state.phaseTemplates, [id]: mergedTemplates },
          stepLibrary: { ...state.stepLibrary, [id]: stepLibrary },
        }));
        // eslint-disable-next-line no-console
        console.log(`[perf] workspace:deferred ${(performance.now() - tWsDefer).toFixed(0)}ms`);
      })();
      void get().loadWorkspaceOverrides(id);
    } else {
      set({ providerSpendBreakdown: [] });
    }
    // Settings persistence, survives next launch as "last opened
    // workspace/session". Fire-and-forget: no UI code awaits these, but
    // awaiting used to add 2 more mutex acquisitions to the click handler.
    void dbSetSetting(tauriDatabase, SETTING_LAST_WORKSPACE_ID, id ?? '');
    void dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, '');
    void get().refreshUnreadWorkspaces();
    // Single-session workspaces don't have an activity rail, the user can't
    // pick a session manually. Auto-select so the detail panel renders
    // instead of the empty state.
    const sessionsNow = get().sessions;
    if (sessionsNow.length === 1 && get().currentSessionId === null) {
      await get().setCurrentSession(sessionsNow[0]!.id);
    }
  };
}
