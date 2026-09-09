import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';

const WORKTREE_PATH = '/repos/goodboy/.goodboy/worktrees/task';
const SECOND_PATH = '/repos/goodboy/.goodboy/worktrees/task-2';
const MOUNT_ID = 'mount-1' as MountId;
const SECOND_MOUNT_ID = 'mount-2' as MountId;

const h = vi.hoisted(() => ({
  emitNotification: vi.fn(async () => undefined),
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { reconcileSessionBranch } from './reconcileSessionBranch';
import { resolveSessionRepo } from './resolveSessionRepo';

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-1' as ProjectId;

type State = Record<string, unknown>;

const makeState = (): State => ({
  sessions: [{ id: SESSION_ID, workspaceId: 'workspace-1' }],
  projects: [
    { id: PROJECT_ID, workspaceId: 'workspace-1', kind: 'repo', rootPath: '/repos/goodboy' },
  ],
  sessionBranches: { [SESSION_ID]: 'ak/outgoing' },
  sessionMounts: {},
  mountBranchObservations: {},
  sessionProjectMounts: {
    [SESSION_ID]: [
      {
        mountId: MOUNT_ID,
        projectId: PROJECT_ID,
        mountName: 'goodboy',
        worktreePath: WORKTREE_PATH,
        repoRoot: '/repos/goodboy',
        branch: 'ak/outgoing',
        revision: 2,
      },
    ],
  },
  sessionWorktrees: { [SESSION_ID]: [WORKTREE_PATH] },
  sessionActiveMount: {},
  sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
  sessionGithub: { [SESSION_ID]: { pr: { number: 42 } } },
  sessionProjectPrs: { [SESSION_ID]: { [PROJECT_ID]: [{ number: 42 }] } },
  sessionSelectedPrNumber: { [SESSION_ID]: 40 },
  sessionExternalTasks: { [SESSION_ID]: [] },
  emitNotification: h.emitNotification,
});

type ObserveParams = {
  readonly state: State;
  readonly observedBranch: string;
  readonly mountId?: MountId;
  readonly worktreePath?: string;
};

const observe = async ({
  state,
  observedBranch,
  mountId = MOUNT_ID,
  worktreePath = WORKTREE_PATH,
}: ObserveParams): Promise<void> => {
  const set = vi.fn((updater: (current: State) => State) => {
    Object.assign(state, updater(state));
  });
  await reconcileSessionBranch(
    set as never,
    (() => state) as never,
  )({
    sessionId: SESSION_ID,
    mountId,
    worktreePath,
    observedBranch,
  });
};

type TwoMountParams = {
  readonly state: State;
};

const withTwoMounts = ({ state }: TwoMountParams): void => {
  state['sessionMounts'] = {
    [SESSION_ID]: [
      {
        id: MOUNT_ID,
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
        mountName: 'goodboy',
        worktreePath: null,
        lastWorktreePath: WORKTREE_PATH,
        repoRoot: '/repos/goodboy',
        branch: 'ak/outgoing',
        baseBranch: 'main',
        parallelIndex: 0,
        isAttached: false,
        diskState: 'missing',
        revision: 2,
      },
      {
        id: SECOND_MOUNT_ID,
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
        mountName: 'goodboy',
        worktreePath: SECOND_PATH,
        lastWorktreePath: SECOND_PATH,
        repoRoot: '/repos/goodboy',
        branch: 'ak/incoming',
        baseBranch: 'main',
        parallelIndex: 1,
        isAttached: true,
        diskState: 'present',
        revision: 5,
      },
    ],
  };
  (state['sessionProjectMounts'] as Record<string, Array<unknown>>)[SESSION_ID]?.push({
    mountId: SECOND_MOUNT_ID,
    projectId: PROJECT_ID,
    mountName: 'goodboy',
    worktreePath: SECOND_PATH,
    repoRoot: '/repos/goodboy',
    branch: 'ak/incoming',
    revision: 5,
  });
  (state['sessionActiveMount'] as Record<string, string>)[SESSION_ID] = MOUNT_ID;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reconcileSessionBranch', () => {
  it('records a mismatch against the mount without rewriting the branch', async () => {
    const state = makeState();

    await observe({ state, observedBranch: 'ak/incoming' });

    expect(state.mountBranchObservations).toEqual({
      [SESSION_ID]: [
        expect.objectContaining({
          mountId: MOUNT_ID,
          state: 'mismatch',
          recordedBranch: 'ak/outgoing',
          observedBranch: 'ak/incoming',
          revision: 2,
        }),
      ],
    });
    expect(state.sessionBranches).toEqual({ [SESSION_ID]: 'ak/outgoing' });
  });

  it('keeps every pull request association through repeated observations', async () => {
    const state = makeState();

    await observe({ state, observedBranch: 'ak/incoming' });
    await observe({ state, observedBranch: 'ak/incoming' });

    expect(state.sessionProjectPrs).toEqual({ [SESSION_ID]: { [PROJECT_ID]: [{ number: 42 }] } });
    expect(state.sessionSelectedPrNumber).toEqual({ [SESSION_ID]: 40 });
    expect(state.sessionGithub).toEqual({ [SESSION_ID]: { pr: { number: 42 } } });
  });

  it('blames the mount whose directory was read, never another row of the project', async () => {
    const state = makeState();
    withTwoMounts({ state });

    const repo = resolveSessionRepo({ state: state as never, sessionId: SESSION_ID });
    expect(repo?.worktreePath).toBe(SECOND_PATH);
    expect(repo?.mountId).toBe(SECOND_MOUNT_ID);

    await observe({
      state,
      observedBranch: 'ak/incoming',
      mountId: SECOND_MOUNT_ID,
      worktreePath: SECOND_PATH,
    });

    expect(state.mountBranchObservations).toEqual({ [SESSION_ID]: [] });
  });

  it('records nothing when the directory read is not the one the mount holds', async () => {
    const state = makeState();

    await observe({ state, observedBranch: 'ak/incoming', worktreePath: SECOND_PATH });

    expect(state.mountBranchObservations).toEqual({});
  });

  it('records a detached head when no branch is observed', async () => {
    const state = makeState();

    await observe({ state, observedBranch: '   ' });

    expect(state.mountBranchObservations).toEqual({
      [SESSION_ID]: [expect.objectContaining({ state: 'detached', observedBranch: null })],
    });
  });

  it('clears the observation when the observed branch matches again', async () => {
    const state = makeState();

    await observe({ state, observedBranch: 'ak/incoming' });
    await observe({ state, observedBranch: 'ak/outgoing' });

    expect(state.mountBranchObservations).toEqual({ [SESSION_ID]: [] });
    expect(h.emitNotification).not.toHaveBeenCalled();
  });
});
