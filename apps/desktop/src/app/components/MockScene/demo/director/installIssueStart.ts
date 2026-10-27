import {
  brandId,
  type IsoDateTime,
  type MountId,
  type Session,
  type SessionExternalTask,
  type SessionId,
  type SessionProjectMount,
} from '@goodboy/types';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { selectProjectById } from '../../../../../store/slices/projects/selectProjectById';
import type { AppStore } from '../../../../../store/store';
import { BRAND_SESSION } from '../../scenes/brand/canon';
import { installBoardActions } from './installBoardActions';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
};

type Input = Parameters<AppStore['createSession']>[0];

type SessionParams = {
  readonly id: SessionId;
  readonly input: Input;
  readonly at: IsoDateTime;
};

const sessionOf = ({ id, input, at }: SessionParams): Session => ({
  id,
  workspaceId: input.workspaceId,
  goal: BRAND_SESSION.title,
  state: { kind: 'idle', lastActivityAt: at },
  contextSlots: [{ key: 'goal', value: input.goal, enabled: true }],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  ...(input.projectId === undefined ? {} : { activeProjectId: input.projectId }),
  createdAt: at,
  updatedAt: at,
});

type TasksParams = {
  readonly id: SessionId;
  readonly input: Input;
  readonly at: IsoDateTime;
};

const tasksOf = ({ id, input, at }: TasksParams): ReadonlyArray<SessionExternalTask> =>
  (input.externalTasks ?? []).map((task) => ({
    sessionId: id,
    provider: task.provider,
    externalId: task.externalId,
    identifier: task.identifier,
    url: task.url,
    title: task.title,
    createdAt: at,
  }));

type MountParams = {
  readonly id: SessionId;
  readonly input: Input;
  readonly store: DirectorStore;
};

const mountsOf = ({ id, input, store }: MountParams): ReadonlyArray<SessionProjectMount> => {
  const project = selectProjectById(store.getState(), input.projectId ?? null);
  if (project === null) {
    return [];
  }
  return [
    {
      mountId: brandId<MountId>({ value: `demo-issue-mount-${project.name}` }),
      projectId: project.id,
      mountName: project.name,
      worktreePath: `${project.rootPath}-duplicate-credit`,
      lastWorktreePath: null,
      repoRoot: project.rootPath,
      branch: BRAND_SESSION.branch,
      baseBranch: 'main',
      parallelIndex: 0,
      diskState: 'present',
      revision: 1,
      sessionId: id,
      isAttached: true,
    },
  ];
};

export const installIssueStart = ({ store }: Params): void => {
  installBoardActions({ store });
  const createSession = (async (input) => {
    const at = nowIso({});
    const id = brandId<SessionId>({ value: `demo-issue-session-${Date.now()}` });
    const session = sessionOf({ id, input, at });
    const mounts = mountsOf({ id, input, store });
    store.setState((state) => ({
      sessions: [session, ...state.sessions],
      sessionExternalTasks: { ...state.sessionExternalTasks, [id]: tasksOf({ id, input, at }) },
      sessionPhaseRuns: { ...state.sessionPhaseRuns, [id]: [] },
      sessionPlans: { ...state.sessionPlans, [id]: [] },
      sessionWorkflows: { ...state.sessionWorkflows, [id]: [] },
      sessionSlots: { ...state.sessionSlots, [id]: session.contextSlots },
      sessionSlotsLoad: { ...state.sessionSlotsLoad, [id]: 'loaded' },
      sessionBranches: { ...state.sessionBranches, [id]: BRAND_SESSION.branch },
      sessionProjectMounts: { ...state.sessionProjectMounts, [id]: mounts },
      sessionWorktrees: {
        ...state.sessionWorktrees,
        [id]: mounts.map((mount) => mount.worktreePath),
      },
      currentSessionId: id,
    }));
    return { session };
  }) satisfies AppStore['createSession'];
  store.setState({ createSession });
};
