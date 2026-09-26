import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import type { AppStore } from '../../store';
import { drawerAfterMove } from '../drawer/drawerAfterMove';
import type { GetFn, Location, SessionView, SetFn } from './types';

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
    isKept && !isRestore && target === null ? current : next;
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
        target?.kind === 'diff' ? target.focus : null,
      ),
    },
    diffMountPath: {
      ...state.diffMountPath,
      [sessionId]: keep(
        lens === 'files',
        state.diffMountPath[sessionId] ?? null,
        target?.kind === 'diff' ? target.mountPath : null,
      ),
    },
    terminalMountPath: {
      ...state.terminalMountPath,
      [sessionId]: keep(
        lens === 'terminal',
        state.terminalMountPath[sessionId] ?? null,
        target?.kind === 'terminal' ? target.mountPath : null,
      ),
    },
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
    drawer: drawerAfterMove({ drawer: state.drawer, sessionId, lens }),
  };
};

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly location: Pick<Location, 'place' | 'studio'>;
  readonly isRestore: boolean;
};

export const applyLocation = ({ set, get, location, isRestore }: Params): void => {
  const { place, studio } = location;
  if (get().appStudio !== studio) {
    set({ appStudio: studio });
  }
  if (place.at === 'board') {
    void get().setCurrentSession(null);
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
  set((state) => surfaceChanges({ state, sessionId, view: resolved, isRestore }));
  if (resolved.agentId !== null && resolved.studio === null) {
    void get()
      .selectAgent(sessionId, resolved.agentId)
      .catch(() => undefined);
  }
};
