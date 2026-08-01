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
  updateAgentStatus,
  updateSessionActiveMount,
  updateSessionState,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn, listLiveRunIds } from '../../../features/chat/turn';
import { isMainWindow } from '../../../features/workspace/window';
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
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { relinkSimpleSessionDirectories } from './relinkSimpleSessionDirectories';
import { buildSessionMounts } from '../worktrees/buildSessionMounts';
import type { GetFn, SetFn } from './types';

export const setCurrentWorkspace = (set: SetFn, get: GetFn) => {
  return async (id: WorkspaceId | null) => {
    const runningSessions = get().sessions.filter((s) => s.state.kind === 'running');
    await Promise.all(
      runningSessions.map((s) =>
        cancelTurn((s.state as { kind: 'running'; runId: ProviderRunId }).runId).catch(() => {}),
      ),
    );

    set({
      currentWorkspaceId: id,
      currentSessionId: null,
      sessions: [],
      archivedSessions: {},
      sessionSummary: null,
      workspaceSummary: null,
      transcripts: {},
      messages: {},
      sessionTelemetry: {},
      sessionSlots: {},
      slotHistory: {},
      sessionWorktrees: {},
      sessionMounts: {},
      sessionActiveMount: {},
      sessionBranches: {},
      sessionExternalTasks: {},
      sessionPhaseRuns: {},
      selectedAgentId: {},
      agentRunHistory: {},
      agentTurnState: {},
      sessionMergeConflicts: {},
      sessionBudgets: {},
      summarizerStatus: {},
      budgetAlerts: [],
      unknownPayloadCounts: {},
      sidebarSessionSearch: '',
      sidebarStateFilter: [],
      sidebarProviderFilter: [],
      sessionLoading: {},
      boardReady: false,
    });
    if (id) {
      const workspace = get().workspaces.find((candidate) => candidate.id === id) ?? null;
      const touchNow = new Date().toISOString() as IsoDateTime;
      set((state) => ({
        workspaces: state.workspaces.map((w) =>
          w.id === id ? { ...w, lastAccessedAt: touchNow } : w,
        ),
      }));
      touchWorkspaceLastAccessed(tauriDatabase, id).catch(() => undefined);

      const tWsLoad = performance.now();
      const loadedSessions = await listSessionsForWorkspace(tauriDatabase, id);
      const liveRunIds = await listLiveRunIds();
      const recoveryNow = new Date().toISOString() as IsoDateTime;
      const sessions = await Promise.all(
        loadedSessions.map(async (s) => {
          if (s.state.kind !== 'running') {
            return s;
          }
          if (liveRunIds.has(s.state.runId)) {
            await cancelTurn(s.state.runId).catch(() => undefined);
          }
          const idleState: TurnState = { kind: 'idle', lastActivityAt: recoveryNow };
          await updateSessionState(tauriDatabase, s.id, idleState, recoveryNow).catch(
            () => undefined,
          );
          return { ...s, state: idleState, updatedAt: recoveryNow };
        }),
      );
      const recoverOrphanAgent = async (run: Agent): Promise<Agent> => {
        if (run.status !== 'running') {
          return run;
        }
        if (run.runId && liveRunIds.has(run.runId)) {
          await cancelTurn(run.runId).catch(() => undefined);
        }
        await updateAgentStatus(tauriDatabase, run.id, { status: 'pending' }).catch(
          () => undefined,
        );
        return { ...run, status: 'pending' };
      };
      const sessionIds = sessions.map((s) => s.id);
      const [loadedWorktreesBySession, agentsBySession, externalTasks] = await Promise.all([
        listWorktreesForSessions(tauriDatabase, sessionIds),
        listAgentsForSessions(tauriDatabase, sessionIds),
        listExternalTasksForWorkspace({ db: tauriDatabase, workspaceId: id }),
      ]);
      const hasPlainSessionDir = [...loadedWorktreesBySession.values()].some((rows) =>
        rows.some((row) =>
          isBranchlessSession({ workspaceKind: workspace?.kind, branch: row.branch }),
        ),
      );
      const worktreesBySession =
        workspace != null && hasPlainSessionDir
          ? await relinkSimpleSessionDirectories({
              rootPath: workspace.rootPath,
              workspaceId: id,
              workspaceKind: workspace.kind,
              worktreesBySession: loadedWorktreesBySession,
            })
          : loadedWorktreesBySession;
      const sessionWorktrees: Record<string, ReadonlyArray<string>> = {};
      const sessionMounts: Record<string, ReturnType<typeof buildSessionMounts>> = {};
      const sessionActiveMount: Record<string, WorkspaceId> = {};
      const sessionBranches: Record<string, string> = {};
      const sessionPhaseRuns: Record<string, ReadonlyArray<Agent>> = {};
      const kindOverridesFromDb: Record<string, AgentKind> = {};
      const invalidActiveMountSessionIds = new Set<string>();
      for (const s of sessions) {
        const rows = worktreesBySession.get(s.id) ?? [];
        const mounts = buildSessionMounts({ workspace, rows });
        sessionMounts[s.id] = mounts;
        if (
          s.activeMountWorkspaceId != null &&
          mounts.some((mount) => mount.workspaceId === s.activeMountWorkspaceId)
        ) {
          sessionActiveMount[s.id] = s.activeMountWorkspaceId;
        }
        if (
          s.activeMountWorkspaceId != null &&
          mounts.every((mount) => mount.workspaceId !== s.activeMountWorkspaceId)
        ) {
          invalidActiveMountSessionIds.add(s.id);
          await updateSessionActiveMount({
            db: tauriDatabase,
            id: s.id,
            workspaceId: null,
          });
        }
        if (rows.length > 0) {
          sessionWorktrees[s.id] = rows.map((r) => r.worktreePath);
          const primaryRow = rows[0];
          if (primaryRow) {
            sessionBranches[s.id] = primaryRow.branch;
          }
        }
        const runs = await Promise.all((agentsBySession.get(s.id) ?? []).map(recoverOrphanAgent));
        sessionPhaseRuns[s.id] = runs;
        for (const run of runs) {
          if (run.kind) {
            kindOverridesFromDb[run.id] = run.kind as AgentKind;
          }
        }
      }
      const sessionsWithValidActiveMounts = sessions.map((session) => {
        if (!invalidActiveMountSessionIds.has(session.id)) {
          return session;
        }
        const { activeMountWorkspaceId: _drop, ...validSession } = session;
        return validSession;
      });
      const externalTasksMap: Record<string, SessionExternalTask[]> = {};
      for (const task of externalTasks) {
        externalTasksMap[task.sessionId] = [...(externalTasksMap[task.sessionId] ?? []), task];
      }
      set((state) => ({
        sessions: sessionsWithValidActiveMounts,
        sessionWorktrees,
        sessionMounts,
        sessionActiveMount,
        sessionBranches,
        sessionPhaseRuns,
        agentKindOverride: { ...state.agentKindOverride, ...kindOverridesFromDb },
        sessionExternalTasks: { ...state.sessionExternalTasks, ...externalTasksMap },
      }));
      if (get().currentWorkspaceId === id && Object.keys(sessionBranches).length === 0) {
        set({ boardReady: true });
      }
      // eslint-disable-next-line no-console
      console.log(`[perf] workspace:firstPaint ${(performance.now() - tWsLoad).toFixed(0)}ms`);

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
        if (get().currentWorkspaceId !== id) {
          return;
        }
        const workflowById = new Map(phaseTemplates.map((t) => [t.id, t]));
        const extraById = new Map<string, Workflow>();
        const needBackfill = get().sessions.filter((s) =>
          s.workflowRuns.some((r) => !workflowById.has(r.workflowId)),
        );
        await Promise.all(
          needBackfill.map(async (s) => {
            const attached = await invokeWorkflowsForSession(s.id).catch(() => []);
            for (const wf of attached)
              if (!workflowById.has(wf.id)) {
                extraById.set(wf.id, wf);
              }
          }),
        );
        const resolveById = new Map<string, Workflow>([...workflowById, ...extraById]);
        const sessionWorkflows: Record<string, ReadonlyArray<Workflow>> = {};
        for (const s of get().sessions) {
          const attached = [...new Set(s.workflowRuns.map((r) => r.workflowId))]
            .map((wid) => resolveById.get(wid) ?? null)
            .filter((w): w is Workflow => w !== null);
          if (attached.length > 0) {
            sessionWorkflows[s.id] = attached;
          }
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
    if (isMainWindow()) {
      void dbSetSetting(tauriDatabase, SETTING_LAST_WORKSPACE_ID, id ?? '');
      void dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, '');
    }
    void get().refreshUnreadWorkspaces();
    const sessionsNow = get().sessions;
    if (sessionsNow.length === 1 && get().currentSessionId === null) {
      await get().setCurrentSession(sessionsNow[0]!.id);
    }
  };
};
