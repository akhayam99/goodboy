import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  MountDiskState,
  MountId,
  ProjectId,
  SessionId,
  SessionMountView,
  SessionProjectMount,
} from '@goodboy/types';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from './types';

type CleanupParams = {
  readonly target: {
    readonly worktreePath: string;
  };
};

type LifecycleParams = {
  readonly mountId: MountId;
  readonly worktreePath: string | null;
  readonly isAttached: boolean;
  readonly diskState: MountDiskState;
  readonly expectedRevision: number;
};

type ListParams = {
  readonly sessionId: SessionId;
};

type LockParams = {
  readonly run: () => Promise<unknown>;
};

const h = vi.hoisted(() => ({
  cleanupMountDirectory: vi.fn(async ({ target }: CleanupParams) => ({
    decision: { kind: 'removed', path: target.worktreePath },
    diskState: 'removed',
  })),
  rows: new Map<MountId, SessionMountView>(),
  updateSessionMountLifecycle: vi.fn(async ({}: LifecycleParams) => true),
  withRepositoryAndMountLock: vi.fn(async ({ run }: LockParams) => run()),
}));

vi.mock('@goodboy/db', () => ({
  listSessionMounts: vi.fn(async ({ sessionId }: ListParams) =>
    [...h.rows.values()].filter((row) => row.sessionId === sessionId),
  ),
  updateSessionMountLifecycle: h.updateSessionMountLifecycle,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../mount-cleanup', () => ({
  cleanupMountDirectory: h.cleanupMountDirectory,
}));

vi.mock('./mountLocks', () => ({
  withRepositoryAndMountLock: h.withRepositoryAndMountLock,
}));

import { removeMountWorktree } from './removeMountWorktree';

type TypedStringParams = {
  readonly value: string;
};

const typedString = <Value extends string>({ value }: TypedStringParams): Value =>
  JSON.parse(JSON.stringify(value));

const SESSION_ID = typedString<SessionId>({ value: 'session-1' });
const PROJECT_ID = typedString<ProjectId>({ value: 'project-1' });
const TARGET_ID = typedString<MountId>({ value: 'mount-target' });
const SIBLING_ID = typedString<MountId>({ value: 'mount-sibling' });
const AT = typedString<IsoDateTime>({ value: '2026-09-10T10:00:00.000Z' });

type ViewParams = {
  readonly id: MountId;
  readonly branch: string;
  readonly worktreePath: string;
};

const view = ({ id, branch, worktreePath }: ViewParams): SessionMountView => ({
  id,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  worktreePath,
  lastWorktreePath: worktreePath,
  branch,
  baseBranch: 'main',
  parallelIndex: id === TARGET_ID ? 1 : 2,
  mountName: 'API',
  repoSlug: null,
  repoRoot: '/repos/api',
  isAttached: true,
  diskState: 'present',
  revision: 2,
  createdAt: AT,
  updatedAt: AT,
});

type ProjectMountParams = {
  readonly source: SessionMountView;
};

const projectMount = ({ source }: ProjectMountParams): SessionProjectMount => ({
  mountId: source.id,
  sessionId: source.sessionId,
  projectId: source.projectId,
  mountName: source.mountName,
  worktreePath: source.worktreePath ?? source.lastWorktreePath ?? '',
  lastWorktreePath: source.lastWorktreePath,
  repoRoot: source.repoRoot,
  branch: source.branch,
  baseBranch: source.baseBranch,
  parallelIndex: source.parallelIndex,
  isAttached: true,
  diskState: source.diskState,
  revision: source.revision,
});

type StateParams = {
  readonly views: ReadonlyArray<SessionMountView>;
};

const stateWith = ({ views }: StateParams): AppStore =>
  Object.assign(Object.create(null), {
    sessions: [{ id: SESSION_ID, workspaceId: 'workspace-1', state: { kind: 'idle' } }],
    archivedSessions: {},
    projects: [
      {
        id: PROJECT_ID,
        workspaceId: 'workspace-1',
        kind: 'repo',
        name: 'API',
        rootPath: '/repos/api',
      },
    ],
    sessionMounts: { [SESSION_ID]: views },
    sessionProjectMounts: { [SESSION_ID]: views.map((source) => projectMount({ source })) },
    sessionActiveMount: { [SESSION_ID]: TARGET_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionBranches: { [SESSION_ID]: 'ak/target' },
    sessionWorktrees: { [SESSION_ID]: views.flatMap((entry) => entry.worktreePath ?? []) },
    reconcileOrphanWorktrees: vi.fn(async () => undefined),
  });

beforeEach(() => {
  vi.clearAllMocks();
  const target = view({ id: TARGET_ID, branch: 'ak/target', worktreePath: '/worktrees/target' });
  const sibling = view({
    id: SIBLING_ID,
    branch: 'ak/sibling',
    worktreePath: '/worktrees/sibling',
  });
  h.rows.clear();
  h.rows.set(TARGET_ID, target);
  h.rows.set(SIBLING_ID, sibling);
  h.updateSessionMountLifecycle.mockImplementation(async (params: LifecycleParams) => {
    const current = h.rows.get(params.mountId);
    if (current === undefined || current.revision !== params.expectedRevision) {
      return false;
    }
    h.rows.set(params.mountId, {
      ...current,
      worktreePath: params.worktreePath,
      lastWorktreePath: params.worktreePath ?? current.worktreePath ?? current.lastWorktreePath,
      isAttached: params.isAttached,
      diskState: params.diskState,
      revision: current.revision + 1,
    });
    return true;
  });
});

describe('removeMountWorktree', () => {
  it('removes one mount worktree and leaves its same-project sibling untouched', async () => {
    const initialViews = [...h.rows.values()];
    const state = stateWith({ views: initialViews });
    const set: SetFn = (update) => {
      const patch = typeof update === 'function' ? update(state) : update;
      Object.assign(state, patch);
    };
    const get: GetFn = () => state;
    const remove = removeMountWorktree({ set, get });

    const result = await remove({ sessionId: SESSION_ID, mountId: TARGET_ID, mode: 'safe' });

    expect(result).toEqual({ kind: 'removed', reason: null });
    expect(h.cleanupMountDirectory).toHaveBeenCalledTimes(1);
    expect(h.cleanupMountDirectory).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'safe',
        target: expect.objectContaining({
          mountId: TARGET_ID,
          worktreePath: '/worktrees/target',
        }),
      }),
    );
    expect(h.updateSessionMountLifecycle).toHaveBeenCalledTimes(1);
    expect(state.sessionMounts[SESSION_ID]).toEqual([
      expect.objectContaining({ id: TARGET_ID, worktreePath: null, isAttached: false }),
      expect.objectContaining({
        id: SIBLING_ID,
        worktreePath: '/worktrees/sibling',
        isAttached: true,
        revision: 2,
      }),
    ]);
  });
});
