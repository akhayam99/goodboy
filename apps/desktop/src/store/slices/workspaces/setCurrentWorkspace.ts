import type {
  Agent,
  IsoDateTime,
  MountId,
  Project,
  ProjectId,
  Session,
  SessionExternalTask,
  SessionId,
  TurnState,
  Workflow,
  WorkspaceId,
} from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import {
  listAgentsForSessions,
  listExternalTasksForWorkspace,
  listProjectsForWorkspace,
  listSessionsForWorkspace,
  listWorktreesForSessions,
  setSetting as dbSetSetting,
  summarizeWorkspaceProviderTelemetry,
  summarizeWorkspaceTelemetry,
  touchWorkspaceLastAccessed,
  updateSessionActiveProject,
  updateSessionWriteDestination,
} from '@goodboy/db';
import type { SessionWorktree } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { listLiveRunIds } from '../../../features/chat/turn';
import { isMainWindow } from '../../../features/workspace/window';
import { invokeBudgetAlertsList } from '../../../features/budget/budget';
import {
  invokeWorkflowList,
  invokeWorkflowsForSession,
  invokeStepDefList,
} from '../../../features/workflows/workflows';
import {
  SETTING_LAST_SESSION_ID,
  SETTING_LAST_WORKSPACE_ID,
} from '../../../features/settings/settings';
import { stopWork } from '../../runtime/live-work/stopWork';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { buildProviderSpendBreakdown, loadCurrentProviderBudgetStatuses } from '../budget';
import { storedAgentKind, type AgentKind } from '../../../features/session/agent-kind';
import {
  reattachableTurn,
  reconcileLoadedAgent,
  reconcileLoadedSessions,
} from '../sessions/reconcileSessionRuns';
import { sessionById } from '../sessions/sessionIndex';
import { reattachLiveTurn } from '../turn/reattachLiveTurn';
import { resumeInterruptedAgents } from '../turn/resumeInterruptedAgents';
import { buildSessionProjectMounts } from '../worktrees/buildSessionProjectMounts';
import { hydrateWriteDestination } from '../project-mounts/hydrateWriteDestination';
import { verifyWorkspaceWorktrees } from '../project-mounts/verify/verifyWorkspaceWorktrees';
import { workspaceVerification } from '../project-mounts/verify/workspaceVerification';
import { clearPendingTurnEvents } from '../transcripts/buffer';
import { beginWorkspaceSwitch } from './beginWorkspaceSwitch';
import { failWorkspaceSwitch } from './failWorkspaceSwitch';
import { refuseWorkspaceSwitch } from './refuseWorkspaceSwitch';
import { loadWorkspaceFacts, type WorkspaceFacts } from './loadWorkspaceFacts';
import { workspaceFactsPatchOf } from './workspaceFactsPatchOf';
import { switchEpoch } from './switchEpoch';
import type { GetFn, SetFn } from './types';

type RepairedDestination = {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
};

type SnapshotParams = {
  readonly get: GetFn;
  readonly id: WorkspaceId;
  readonly isCurrent: () => boolean;
};

type MountRecords = {
  sessionWorktrees: Record<string, ReadonlyArray<string>>;
  sessionWorktreeRecords: Record<string, ReadonlyArray<SessionWorktree>>;
  sessionProjectMounts: Record<string, ReturnType<typeof buildSessionProjectMounts>>;
  sessionActiveProject: Record<string, ProjectId>;
  sessionActiveMount: Record<string, MountId | null>;
  sessionBranches: Record<string, string>;
};

type WorkspaceSnapshot = MountRecords & {
  readonly touchedAt: IsoDateTime;
  readonly loadStartedAt: number;
  readonly projects: ReadonlyArray<Project>;
  readonly sessions: ReadonlyArray<Session>;
  readonly worktreesBySession: ReadonlyMap<SessionId, ReadonlyArray<SessionWorktree>>;
  readonly sessionPhaseRuns: Record<string, ReadonlyArray<Agent>>;
  readonly waitingTurns: Record<string, TurnState>;
  readonly kindOverridesFromDb: Record<string, AgentKind>;
  readonly sessionExternalTasks: Record<string, SessionExternalTask[]>;
  readonly facts: WorkspaceFacts | null;
  readonly factsError: string | null;
};

type SessionMountHydration = {
  readonly rows: ReadonlyArray<SessionWorktree>;
  readonly mounts: ReturnType<typeof buildSessionProjectMounts>;
  readonly activeMount: MountId | undefined;
  readonly activeProject: ProjectId | undefined;
  readonly branch: string | undefined;
  readonly repair: RepairedDestination | undefined;
  readonly isActiveProjectInvalid: boolean;
};

type HydrateParams = {
  readonly session: Session;
  readonly rows: ReadonlyArray<SessionWorktree>;
  readonly projects: ReadonlyArray<Project>;
};

type UnverifiedParams = {
  readonly candidates: ReadonlyArray<SessionWorktree>;
};

type WriteHydrationParams = {
  readonly records: MountRecords;
  readonly sessionId: SessionId;
  readonly hydration: SessionMountHydration;
};

type AfterHydrationParams = {
  readonly session: Session;
  readonly hydration: SessionMountHydration;
};

type BackgroundVerifyParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly isCurrent: () => boolean;
  readonly projects: ReadonlyArray<Project>;
  readonly sessions: ReadonlyArray<Session>;
  readonly worktreesBySession: ReadonlyMap<SessionId, ReadonlyArray<SessionWorktree>>;
};

type VerifiedPatch = {
  readonly sessionId: SessionId;
  readonly hydration: SessionMountHydration;
};

const SWITCH_KEY = 'workspace-switch';

const unverifiedRows = ({ candidates }: UnverifiedParams): ReadonlyArray<SessionWorktree> =>
  candidates.filter((candidate) => candidate.worktreePath !== null);

const hydrateSessionMounts = async ({
  session,
  rows,
  projects,
}: HydrateParams): Promise<SessionMountHydration> => {
  const mounts = buildSessionProjectMounts({ projects, rows });
  const hydration = hydrateWriteDestination({ mounts, storedMountId: session.activeMountId });
  if (hydration.kind === 'restored' || hydration.kind === 'repaired') {
    const isRepair =
      hydration.kind === 'repaired' || session.activeProjectId !== hydration.projectId;
    if (isRepair) {
      await updateSessionWriteDestination({
        db: tauriDatabase,
        sessionId: session.id,
        mountId: hydration.mountId,
      });
    }
    return {
      rows,
      mounts,
      activeMount: hydration.mountId,
      activeProject: hydration.projectId,
      branch: hydration.branch,
      repair: isRepair ? { mountId: hydration.mountId, projectId: hydration.projectId } : undefined,
      isActiveProjectInvalid: false,
    };
  }
  const hasKnownProject =
    session.activeProjectId != null &&
    mounts.some((mount) => mount.projectId === session.activeProjectId);
  const isActiveProjectInvalid =
    session.activeProjectId != null &&
    mounts.every((mount) => mount.projectId !== session.activeProjectId);
  if (isActiveProjectInvalid) {
    await updateSessionActiveProject({ db: tauriDatabase, id: session.id, projectId: null });
  }
  return {
    rows,
    mounts,
    activeMount: session.activeMountId ?? undefined,
    activeProject: hasKnownProject ? (session.activeProjectId ?? undefined) : undefined,
    branch: undefined,
    repair: undefined,
    isActiveProjectInvalid,
  };
};

const writeHydration = ({ records, sessionId, hydration }: WriteHydrationParams): void => {
  records.sessionWorktreeRecords[sessionId] = hydration.rows;
  records.sessionProjectMounts[sessionId] = hydration.mounts;
  delete records.sessionWorktrees[sessionId];
  delete records.sessionActiveMount[sessionId];
  delete records.sessionActiveProject[sessionId];
  delete records.sessionBranches[sessionId];
  if (hydration.rows.length > 0) {
    records.sessionWorktrees[sessionId] = hydration.rows.map((row) => row.worktreePath);
  }
  if (hydration.activeMount !== undefined) {
    records.sessionActiveMount[sessionId] = hydration.activeMount;
  }
  if (hydration.activeProject !== undefined) {
    records.sessionActiveProject[sessionId] = hydration.activeProject;
  }
  if (hydration.branch !== undefined) {
    records.sessionBranches[sessionId] = hydration.branch;
  }
};

const sessionAfterHydration = ({ session, hydration }: AfterHydrationParams): Session => {
  if (hydration.repair !== undefined) {
    return {
      ...session,
      activeMountId: hydration.repair.mountId,
      activeProjectId: hydration.repair.projectId,
    };
  }
  if (!hydration.isActiveProjectInvalid) {
    return session;
  }
  const { activeProjectId: _drop, ...validSession } = session;
  return validSession;
};

const verifyWorkspaceInBackground = async ({
  set,
  get,
  isCurrent,
  projects,
  sessions,
  worktreesBySession,
}: BackgroundVerifyParams): Promise<void> => {
  const candidatesBySession = new Map(
    sessions.map((session) => [
      session.id,
      unverifiedRows({ candidates: worktreesBySession.get(session.id) ?? [] }),
    ]),
  );
  const { availableBySession } = await verifyWorkspaceWorktrees({ candidatesBySession, projects });
  if (!isCurrent()) {
    return;
  }
  const patches: Array<VerifiedPatch> = [];
  for (const session of sessions) {
    const available = availableBySession.get(session.id) ?? [];
    if (available.length === (candidatesBySession.get(session.id) ?? []).length) {
      continue;
    }
    const loaded = sessionById(get().sessions, session.id);
    if (loaded === undefined) {
      continue;
    }
    patches.push({
      sessionId: session.id,
      hydration: await hydrateSessionMounts({ session: loaded, rows: available, projects }),
    });
  }
  if (patches.length === 0 || !isCurrent()) {
    return;
  }
  const patchBySession = new Map(patches.map((patch) => [patch.sessionId, patch.hydration]));
  set((state) => {
    const records: MountRecords = {
      sessionWorktrees: { ...state.sessionWorktrees },
      sessionWorktreeRecords: { ...state.sessionWorktreeRecords },
      sessionProjectMounts: { ...state.sessionProjectMounts },
      sessionActiveProject: { ...state.sessionActiveProject },
      sessionActiveMount: { ...state.sessionActiveMount },
      sessionBranches: { ...state.sessionBranches },
    };
    for (const [sessionId, hydration] of patchBySession) {
      writeHydration({ records, sessionId, hydration });
    }
    return {
      ...records,
      sessions: state.sessions.map((session) => {
        const hydration = patchBySession.get(session.id);
        return hydration === undefined ? session : sessionAfterHydration({ session, hydration });
      }),
    };
  });
};

const loadWorkspaceSnapshot = async ({
  get,
  id,
  isCurrent,
}: SnapshotParams): Promise<WorkspaceSnapshot | null> => {
  const touchedAt = new Date().toISOString() as IsoDateTime;
  touchWorkspaceLastAccessed({ db: tauriDatabase, id }).catch(() => undefined);

  const projects = await listProjectsForWorkspace({ db: tauriDatabase, workspaceId: id });
  await get()
    .loadIntegrations(id)
    .catch(() => undefined);
  if (!isCurrent()) {
    return null;
  }

  const loadStartedAt = performance.now();
  const loadedSessions = await listSessionsForWorkspace(tauriDatabase, id);
  const liveRunIds = await listLiveRunIds();
  const recoveryNow = new Date().toISOString() as IsoDateTime;
  const sessions = await reconcileLoadedSessions({
    sessions: loadedSessions,
    liveRunIds,
    now: recoveryNow,
  });
  const sessionIds = sessions.map((s) => s.id);
  const [worktreesBySession, agentsBySession, externalTasks] = await Promise.all([
    listWorktreesForSessions(tauriDatabase, sessionIds),
    listAgentsForSessions(tauriDatabase, sessionIds),
    listExternalTasksForWorkspace({ db: tauriDatabase, workspaceId: id }),
  ]);
  if (!isCurrent()) {
    return null;
  }
  const records: MountRecords = {
    sessionWorktrees: {},
    sessionWorktreeRecords: {},
    sessionProjectMounts: {},
    sessionActiveProject: {},
    sessionActiveMount: {},
    sessionBranches: {},
  };
  const sessionPhaseRuns: Record<string, ReadonlyArray<Agent>> = {};
  const waitingTurns: Record<string, TurnState> = {};
  const kindOverridesFromDb: Record<string, AgentKind> = {};
  const hydratedSessions: Array<Session> = [];
  for (const s of sessions) {
    const hydration = await hydrateSessionMounts({
      session: s,
      rows: unverifiedRows({ candidates: worktreesBySession.get(s.id) ?? [] }),
      projects,
    });
    writeHydration({ records, sessionId: s.id, hydration });
    hydratedSessions.push(sessionAfterHydration({ session: s, hydration }));
    const reconciled = await Promise.all(
      (agentsBySession.get(s.id) ?? []).map((agent) => reconcileLoadedAgent({ agent, liveRunIds })),
    );
    const runs = reconciled.map(({ agent }) => agent);
    for (const { agent, waiting } of reconciled) {
      if (waiting !== null) {
        waitingTurns[agent.id] = waiting;
      }
    }
    sessionPhaseRuns[s.id] = runs;
    for (const run of runs) {
      if (run.kind) {
        kindOverridesFromDb[run.id] = storedAgentKind({ kind: run.kind });
      }
    }
  }
  const sessionExternalTasks: Record<string, SessionExternalTask[]> = {};
  for (const task of externalTasks) {
    sessionExternalTasks[task.sessionId] = [...(sessionExternalTasks[task.sessionId] ?? []), task];
  }
  for (const s of sessions) {
    sessionExternalTasks[s.id] = sessionExternalTasks[s.id] ?? [];
  }
  const factsRead = await loadWorkspaceFacts({
    db: tauriDatabase,
    sessionIds,
    sessionPhaseRuns,
    kindOverride: { ...get().agentKindOverride, ...kindOverridesFromDb },
  })
    .then((facts) => ({ facts, factsError: facts.error }))
    .catch((error: unknown) => ({ facts: null, factsError: formatError(error) }));
  if (!isCurrent()) {
    return null;
  }
  return {
    touchedAt,
    loadStartedAt,
    projects,
    sessions: hydratedSessions,
    worktreesBySession,
    ...records,
    sessionPhaseRuns,
    waitingTurns,
    kindOverridesFromDb,
    sessionExternalTasks,
    ...factsRead,
  };
};

const clearedWorkspaceState = () => ({
  currentSessionId: null,
  appStudio: null,
  drawer: null,
  drawerBack: null,
  sessions: [],
  archivedSessions: {},
  sessionSummary: null,
  workspaceSummary: null,
  transcripts: {},
  messages: {},
  sessionTelemetry: {},
  sessionSlots: {},
  slotHistory: {},
  slotHistoryCounts: {},
  sessionSlotsLoad: {},
  sessionWorktrees: {},
  sessionProjectMounts: {},
  sessionActiveProject: {},
  sessionActiveMount: {},
  sessionBranches: {},
  sessionExternalTasks: {},
  sessionPhaseRuns: {},
  selectedAgentId: {},
  agentRunHistory: {},
  runRouting: {},
  agentTurnState: {},
  sessionBudgets: {},
  summarizerStatus: {},
  budgetAlerts: [],
  unknownPayloadCounts: {},
  sessionLoading: {},
  boardReady: false,
});

export const setCurrentWorkspace = (set: SetFn, get: GetFn) => {
  const latest = createLatestOnly();
  return async (id: WorkspaceId | null) => {
    const claimed = latest.claim({ key: SWITCH_KEY });
    switchEpoch.value += 1;
    const isOpeningAnother = id != null && id !== get().currentWorkspaceId;
    beginWorkspaceSwitch({ set, id: isOpeningAnother ? id : null });
    const { stillRunning } = await stopWork({
      getState: get,
      scope: { kind: 'all' },
      reason: 'leave',
    });
    if (!claimed.isCurrent()) {
      return;
    }
    if (stillRunning > 0) {
      refuseWorkspaceSwitch({ set, get, id });
      return;
    }

    if (id != null) {
      let snapshot: WorkspaceSnapshot | null = null;
      try {
        snapshot = await loadWorkspaceSnapshot({ get, id, isCurrent: claimed.isCurrent });
      } catch (error) {
        if (claimed.isCurrent()) {
          failWorkspaceSwitch({ set, id, message: formatError(error) });
        }
        return;
      }
      if (snapshot === null || !claimed.isCurrent()) {
        return;
      }
      const {
        touchedAt,
        loadStartedAt,
        projects,
        sessions: sessionsWithValidActiveMounts,
        sessionWorktrees,
        sessionWorktreeRecords,
        sessionProjectMounts,
        sessionActiveProject,
        sessionActiveMount,
        sessionBranches,
        sessionPhaseRuns,
        waitingTurns,
        kindOverridesFromDb,
        sessionExternalTasks,
        worktreesBySession,
        facts,
        factsError,
      } = snapshot;
      clearPendingTurnEvents();
      set((state) => ({
        ...clearedWorkspaceState(),
        currentWorkspaceId: id,
        switchingToWorkspaceId: null,
        workspaceSwitchError: null,
        workspaces: state.workspaces.map((w) =>
          w.id === id ? { ...w, lastAccessedAt: touchedAt } : w,
        ),
        projects: [...state.projects.filter((project) => project.workspaceId !== id), ...projects],
        sessions: sessionsWithValidActiveMounts,
        sessionWorktrees,
        sessionWorktreeRecords,
        sessionProjectMounts,
        sessionActiveProject,
        sessionActiveMount,
        sessionBranches,
        sessionPhaseRuns,
        agentTurnState: waitingTurns,
        agentKindOverride: { ...state.agentKindOverride, ...kindOverridesFromDb },
        sessionExternalTasks,
        ...(facts === null ? {} : workspaceFactsPatchOf({ state, facts, now: Date.now() })),
        workspaceFactsError: factsError,
        boardReady: true,
      }));
      for (const runs of Object.values(sessionPhaseRuns)) {
        for (const agent of runs) {
          const turn = reattachableTurn({ agent });
          if (turn !== null) {
            void reattachLiveTurn({ set, get, ...turn }).catch((error) =>
              console.error('reattach live turn failed', error),
            );
          }
        }
      }
      console.log(
        `[perf] workspace:firstPaint ${(performance.now() - loadStartedAt).toFixed(0)}ms`,
      );
      workspaceVerification.track({
        promise: verifyWorkspaceInBackground({
          set,
          get,
          isCurrent: claimed.isCurrent,
          projects,
          sessions: sessionsWithValidActiveMounts,
          worktreesBySession,
        }),
      });

      void get()
        .loadDormantSpend(id)
        .catch(() => undefined);
      void (async (): Promise<void> => {
        const tWsDefer = performance.now();
        const [
          workspaceSummary,
          providerSummaries,
          providerBudgetStatus,
          budgetAlerts,
          phaseTemplates,
          stepLibrary,
        ] = await Promise.all([
          summarizeWorkspaceTelemetry(tauriDatabase, id).catch(() => null),
          summarizeWorkspaceProviderTelemetry(tauriDatabase, id).catch(() => []),
          loadCurrentProviderBudgetStatuses(),
          invokeBudgetAlertsList().catch(() => []),
          invokeWorkflowList(id).catch(() => []),
          invokeStepDefList(id).catch(() => []),
        ]);
        if (!claimed.isCurrent()) {
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
          sessionWorkflows[s.id] = attached;
        }
        const mergedTemplates = [...phaseTemplates, ...extraById.values()];
        set((state) => ({
          sessionWorkflows,
          workspaceSummary,
          providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries),
          providerBudgetStatus,
          budgetAlerts,
          phaseTemplates: { ...state.phaseTemplates, [id]: mergedTemplates },
          stepLibrary: { ...state.stepLibrary, [id]: stepLibrary },
        }));
        void resumeInterruptedAgents({ get }).catch((error) =>
          console.error('resume interrupted agents failed', error),
        );
        for (const session of get().sessions) {
          const hasQueuedChain = session.workflowRuns.some(
            (run) =>
              run.discardedAt == null &&
              run.triggerMode === 'after_run' &&
              run.chainAfterId != null,
          );
          if (!hasQueuedChain) {
            continue;
          }
          void get().maybeAutoAdvanceWorkflow(session.id);
        }
        console.log(`[perf] workspace:deferred ${(performance.now() - tWsDefer).toFixed(0)}ms`);
      })();
      void get().loadWorkspaceOverrides(id);
    } else {
      clearPendingTurnEvents();
      set({
        ...clearedWorkspaceState(),
        currentWorkspaceId: null,
        providerSpendBreakdown: [],
        providerBudgetStatus: {},
      });
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
