import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import type { AppStore } from '../../store';
import { foldedLensOf } from './foldedLensOf';
import type { BranchTab, GetFn, Location, SessionView, SetFn } from './types';

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

type SurfaceParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly view: SessionView;
};

const surfaceChanges = ({ state, sessionId, view }: SurfaceParams): Partial<AppStore> => {
  const { lens, target } = view;
  return {
    activeLens: { ...state.activeLens, [sessionId]: lens },
    selectedAgentId: { ...state.selectedAgentId, [sessionId]: view.agentId },
    focusedWorkflowRunId: {
      ...state.focusedWorkflowRunId,
      [sessionId]: target?.kind === 'run' ? target.runId : null,
    },
    diffFocus: {
      ...state.diffFocus,
      [sessionId]: target?.kind === 'diff' || target?.kind === 'branch' ? target.focus : null,
    },
    diffMountPath: {
      ...state.diffMountPath,
      [sessionId]: target?.kind === 'diff' || target?.kind === 'branch' ? target.mountPath : null,
    },
    branchTab: branchTabsAfter({ state, sessionId, target }),
    branchThreadId: {
      ...state.branchThreadId,
      [sessionId]: target?.kind === 'branch' ? target.threadId : null,
    },
    focusedArtifactId: {
      ...state.focusedArtifactId,
      [sessionId]: target?.kind === 'artifact' ? target.artifactId : null,
    },
    focusedGithubIssueNumber: {
      ...state.focusedGithubIssueNumber,
      [sessionId]: target?.kind === 'github-issue' ? target.issueNumber : null,
    },
    focusedExternalTask: {
      ...state.focusedExternalTask,
      [sessionId]: target?.kind === 'external-task' ? target.task : null,
    },
  };
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
  const folded: SessionView = { ...view, lens: foldedLensOf({ lens: view.lens }) };
  const resolved: SessionView = isAgentGone ? { ...folded, agentId: null } : folded;
  set((state) => ({
    ...surfaceChanges({ state, sessionId, view: resolved }),
    drawer,
    openSessionDraftWorkspaceId: null,
  }));
  if (resolved.agentId !== null) {
    void get()
      .selectAgent(sessionId, resolved.agentId)
      .catch(() => undefined);
  }
};
