import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import type { AppStore } from '../../store';
import { selectActiveMount, selectWritableMounts } from '../project-mounts/selectors';
import type { AgentPane, BranchTab, GetFn, Location, SessionView, SetFn } from './types';

type TabsParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly target: SessionView['target'];
};

const branchTabsAfter = ({ state, sessionId, target }: TabsParams): AppState['branchTab'] => {
  if (target?.kind === 'branch') {
    return { ...state.branchTab, [sessionId]: target.tab };
  }
  if (!(sessionId in state.branchTab)) {
    return state.branchTab;
  }
  const rest: Record<SessionId, BranchTab> = { ...state.branchTab };
  delete rest[sessionId];
  return rest;
};

const paneOf = ({ target }: { readonly target: SessionView['target'] }): AgentPane | null =>
  target?.kind === 'thread' || target?.kind === 'agent' ? (target.pane ?? null) : null;

type SurfaceParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly view: SessionView;
  readonly isRestore: boolean;
};

const surfaceChanges = ({
  state,
  sessionId,
  view,
  isRestore,
}: SurfaceParams): Partial<AppStore> => {
  const { lens, target } = view;
  const keep = <T>(isKept: boolean, current: T, next: T): T =>
    isKept && !isRestore && (target === null || target.kind === 'agent') ? current : next;
  return {
    activeLens: { ...state.activeLens, [sessionId]: lens },
    sessionStudio: { ...state.sessionStudio, [sessionId]: view.studio },
    selectedAgentId: {
      ...state.selectedAgentId,
      [sessionId]: view.studio === null ? view.agentId : null,
    },
    focusedWorkflowRunId: {
      ...state.focusedWorkflowRunId,
      [sessionId]: keep(
        lens === 'workflows',
        state.focusedWorkflowRunId[sessionId] ?? null,
        target?.kind === 'run' ? target.runId : null,
      ),
    },
    diffFocus: {
      ...state.diffFocus,
      [sessionId]: keep(
        lens === 'files',
        state.diffFocus[sessionId] ?? null,
        target?.kind === 'diff' || target?.kind === 'branch' ? target.focus : null,
      ),
    },
    diffMountPath: {
      ...state.diffMountPath,
      [sessionId]: keep(
        lens === 'files',
        state.diffMountPath[sessionId] ?? null,
        target?.kind === 'diff' || target?.kind === 'branch' ? target.mountPath : null,
      ),
    },
    branchTab: branchTabsAfter({ state, sessionId, target }),
    branchThreadId: {
      ...state.branchThreadId,
      [sessionId]: target?.kind === 'branch' ? target.threadId : null,
    },
    terminalMountPath: {
      ...state.terminalMountPath,
      [sessionId]: keep(
        lens === 'terminal',
        state.terminalMountPath[sessionId] ?? null,
        target?.kind === 'terminal' ? target.mountPath : null,
      ),
    },
    exploreMountPath:
      lens === 'explore'
        ? {
            ...state.exploreMountPath,
            [sessionId]: keep(
              true,
              state.exploreMountPath[sessionId] ?? null,
              target?.kind === 'explore' ? target.mountPath : null,
            ),
          }
        : state.exploreMountPath,
    focusedArtifactId: {
      ...state.focusedArtifactId,
      [sessionId]: keep(
        lens === 'plans',
        state.focusedArtifactId[sessionId] ?? null,
        target?.kind === 'artifact' ? target.artifactId : null,
      ),
    },
    focusedGithubIssueNumber: {
      ...state.focusedGithubIssueNumber,
      [sessionId]: keep(
        lens === 'github_issue',
        state.focusedGithubIssueNumber[sessionId] ?? null,
        target?.kind === 'github-issue' ? target.issueNumber : null,
      ),
    },
    focusedExternalTask: {
      ...state.focusedExternalTask,
      [sessionId]: target?.kind === 'external-task' ? target.task : null,
    },
    agentPane: {
      ...state.agentPane,
      [sessionId]: view.studio === null ? (paneOf({ target }) ?? null) : null,
    },
  };
};

type ActiveMountParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly view: SessionView;
};

const syncActiveMount = ({ get, sessionId, view }: ActiveMountParams): void => {
  const target = view.target;
  if (target?.kind !== 'branch' || target.mountPath === null) {
    return;
  }
  const state = get();
  const shown = selectWritableMounts({ state, sessionId }).find(
    (mount) => mount.worktreePath === target.mountPath,
  );
  if (shown === undefined || shown.mountId === selectActiveMount({ state, sessionId })?.mountId) {
    return;
  }
  void state.setSessionActiveMount({ sessionId, mountId: shown.mountId }).catch(() => undefined);
};

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly location: Pick<Location, 'place' | 'studio' | 'focus'>;
  readonly isRestore: boolean;
};

export const applyLocation = ({ set, get, location, isRestore }: Params): void => {
  const { place, studio } = location;
  const drawer = location.focus.drawer;
  if (get().appStudio !== studio) {
    set({ appStudio: studio });
  }
  if (place.at === 'board' || place.at === 'session-draft') {
    void get().setCurrentSession(null);
    set({
      drawer: null,
      openSessionDraftWorkspaceId: place.at === 'board' ? null : get().currentWorkspaceId,
    });
    return;
  }
  const { sessionId, view } = place;
  if (get().currentSessionId !== sessionId) {
    void get().setCurrentSession(sessionId);
  }
  const runs = get().sessionPhaseRuns[sessionId];
  const isAgentGone =
    isRestore &&
    view.agentId !== null &&
    runs !== undefined &&
    !runs.some((run) => run.id === view.agentId);
  const resolved: SessionView = isAgentGone ? { ...view, agentId: null } : view;
  set((state) => ({
    ...surfaceChanges({ state, sessionId, view: resolved, isRestore }),
    drawer,
    openSessionDraftWorkspaceId: null,
  }));
  if (isRestore) {
    syncActiveMount({ get, sessionId, view: resolved });
  }
  if (resolved.agentId !== null && resolved.studio === null) {
    void get()
      .selectAgent(sessionId, resolved.agentId)
      .catch(() => undefined);
  }
};
