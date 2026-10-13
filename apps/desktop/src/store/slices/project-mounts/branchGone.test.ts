// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, SessionId, SessionMountView } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from './types';

type Holder = {
  localBranches: Array<string>;
  remoteBranches: Array<string>;
  views: Array<SessionMountView>;
  reopenedViews: Array<SessionMountView> | null;
  removeWorktreeChecked: ReturnType<typeof vi.fn>;
  fetchRemoteBranches: ReturnType<typeof vi.fn>;
  deleteSessionMount: ReturnType<typeof vi.fn>;
  updateSessionMountLifecycle: ReturnType<typeof vi.fn>;
};

const h: Holder = vi.hoisted(() => ({
  localBranches: [],
  remoteBranches: [],
  views: [],
  reopenedViews: null,
  removeWorktreeChecked: vi.fn(),
  fetchRemoteBranches: vi.fn(async () => undefined),
  deleteSessionMount: vi.fn(async () => true),
  updateSessionMountLifecycle: vi.fn(async () => true),
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    deleteSessionMount: h.deleteSessionMount,
    updateSessionMountLifecycle: h.updateSessionMountLifecycle,
    listSessionMounts: vi.fn(async () => {
      const current = h.views;
      if (h.reopenedViews !== null) {
        h.views = h.reopenedViews;
      }
      return current;
    }),
    listMountOperations: vi.fn(async () => []),
    getMountOperation: vi.fn(async () => null),
    upsertMountOperation: vi.fn(async () => undefined),
    updateSessionWriteDestination: vi.fn(async () => true),
    updateSessionActiveProject: vi.fn(async () => undefined),
  }),
);
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/worktree/worktree', () => ({
  listBranchNames: vi.fn(async () => h.localBranches),
  removeWorktreeChecked: h.removeWorktreeChecked,
  listRemoteBranches: vi.fn(async () => h.remoteBranches.map((name) => ({ name }))),
  fetchRemoteBranches: h.fetchRemoteBranches,
}));

import { attachMount } from './attachMount';
import { checkMountBranchGone } from './checkMountBranchGone';
import { isBranchDeletedEverywhere } from './isBranchDeletedEverywhere';
import { removeGoneMount } from './removeGoneMount';
import { restoreGoneBranch } from './restoreGoneBranch';

type TypedStringParams = {
  readonly value: string;
};

const typedString = <Value extends string>({ value }: TypedStringParams): Value =>
  JSON.parse(JSON.stringify(value));

const SESSION_ID = typedString<SessionId>({ value: 'sess-1' });
const MOUNT_ID = typedString<MountId>({ value: 'mount-api' });
const KEY = { sessionId: SESSION_ID, mountId: MOUNT_ID };

type ViewParams = {
  readonly diskState?: SessionMountView['diskState'];
};

const makeView = ({ diskState = 'present' }: ViewParams = {}): SessionMountView =>
  Object.assign(Object.create(null), {
    id: MOUNT_ID,
    sessionId: SESSION_ID,
    projectId: 'project-api',
    mountName: 'payments-api',
    repoRoot: '/repos/payments-api',
    branch: 'ak/ledger-fix',
    baseBranch: null,
    worktreePath: null,
    lastWorktreePath: '/kept/payments-api',
    parallelIndex: 0,
    isAttached: false,
    diskState,
    revision: 2,
  });

const makeStore = (): AppStore =>
  Object.assign(Object.create(null), {
    sessionMounts: { [SESSION_ID]: [makeView()] },
    sessionProjectMounts: { [SESSION_ID]: [] },
    mountBranchGone: {},
    mountBranchObservations: {},
    mountCleanupProposals: {},
    deletedBranches: {},
    sessionWorktrees: { [SESSION_ID]: [] },
    sessionActiveProject: {},
    sessionActiveMount: {},
    sessionBranches: {},
    sessions: [{ id: SESSION_ID, workspaceId: 'ws-1', state: { kind: 'idle' } }],
    terminalTabs: {},
    projects: [
      {
        id: 'project-api',
        workspaceId: 'ws-1',
        rootPath: '/repos/payments-api',
        kind: 'repo',
        name: 'payments-api',
      },
    ],
    reconcileOrphanWorktrees: vi.fn(async () => undefined),
    restoreDeletedBranch: vi.fn(async () => undefined),
    attachMount: vi.fn(async () => undefined),
  });

type Wired = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type WireParams = {
  readonly store: AppStore;
};
const wire = ({ store }: WireParams): Wired => ({
  set: (update) => {
    Object.assign(store, typeof update === 'function' ? update(store) : update);
  },
  get: () => store,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.views = [makeView()];
  h.reopenedViews = null;
  h.localBranches = ['main'];
  h.remoteBranches = ['main'];
  h.removeWorktreeChecked.mockImplementation(async () => ({
    kind: 'removed',
    path: '/kept/payments-api',
  }));
});

describe('checkMountBranchGone', () => {
  it('marks a closed mount whose branch is gone locally and on origin', async () => {
    const store = makeStore();
    const { set, get } = wire({ store });

    const isGone = await checkMountBranchGone({ set, get })(KEY);

    expect(isGone).toBe(true);
    expect(store.mountBranchGone[MOUNT_ID]).toEqual({ restorableBranchId: null });
  });

  it('drops a scan that a reopen outran', async () => {
    const store = makeStore();
    const { set, get } = wire({ store });
    const reopened = {
      ...makeView(),
      isAttached: true,
      worktreePath: '/kept/payments-api',
      revision: 3,
    };

    const pending = checkMountBranchGone({ set, get })(KEY);
    Object.assign(store, { sessionMounts: { [SESSION_ID]: [reopened] } });

    expect(await pending).toBe(false);
    expect(store.mountBranchGone).toEqual({});
  });

  it('drops a scan that a revision bump outran', async () => {
    const store = makeStore();
    const { set, get } = wire({ store });

    const pending = checkMountBranchGone({ set, get })(KEY);
    Object.assign(store, { sessionMounts: { [SESSION_ID]: [{ ...makeView(), revision: 3 }] } });

    expect(await pending).toBe(false);
    expect(store.mountBranchGone).toEqual({});
  });

  it('offers a restore when a saved copy of the branch exists', async () => {
    const store = makeStore();
    Object.assign(store, {
      deletedBranches: {
        'ws-1': [
          {
            id: 'deleted-1',
            repoRoot: '/repos/payments-api',
            branch: 'ak/ledger-fix',
            restoredAt: null,
          },
        ],
      },
    });
    const { set, get } = wire({ store });

    await checkMountBranchGone({ set, get })(KEY);

    expect(store.mountBranchGone[MOUNT_ID]).toEqual({ restorableBranchId: 'deleted-1' });
  });

  it('stays quiet while the branch still exists locally or on origin', async () => {
    const store = makeStore();
    const { set, get } = wire({ store });
    h.remoteBranches = ['main', 'ak/ledger-fix'];

    expect(await checkMountBranchGone({ set, get })(KEY)).toBe(false);

    h.remoteBranches = ['main'];
    h.localBranches = ['main', 'ak/ledger-fix'];
    expect(await checkMountBranchGone({ set, get })(KEY)).toBe(false);
    expect(store.mountBranchGone).toEqual({});
  });

  it('clears the mark once the branch is back', async () => {
    const store = makeStore();
    const { set, get } = wire({ store });
    await checkMountBranchGone({ set, get })(KEY);

    h.localBranches = ['main', 'ak/ledger-fix'];
    await checkMountBranchGone({ set, get })(KEY);

    expect(store.mountBranchGone).toEqual({});
  });
});

describe('removeGoneMount', () => {
  it('removes the kept folder and forgets the row', async () => {
    const store = makeStore();
    Object.assign(store, { mountBranchGone: { [MOUNT_ID]: { restorableBranchId: null } } });
    const { set, get } = wire({ store });

    const result = await removeGoneMount({ set, get })(KEY);

    expect(result).toEqual({ kind: 'forgotten', reason: null });
    expect(h.removeWorktreeChecked).toHaveBeenCalledWith({
      repoPath: '/repos/payments-api',
      worktreePath: '/kept/payments-api',
      mode: 'safe',
    });
    expect(h.deleteSessionMount).toHaveBeenCalledWith(
      expect.objectContaining({ mountId: MOUNT_ID }),
    );
    expect(store.sessionMounts[SESSION_ID]).toEqual([]);
    expect(store.mountBranchGone).toEqual({});
  });

  it('keeps the row and the folder when the folder holds uncommitted work', async () => {
    const store = makeStore();
    const { set, get } = wire({ store });
    h.removeWorktreeChecked.mockImplementation(async () => ({
      kind: 'kept',
      path: '/kept/payments-api',
      reasons: ['3 uncommitted changes'],
    }));

    const result = await removeGoneMount({ set, get })(KEY);

    expect(result).toEqual({ kind: 'kept', reason: '3 uncommitted changes' });
    expect(h.deleteSessionMount).not.toHaveBeenCalled();
  });

  it('aborts without deleting when the mount was reopened while waiting for the lock', async () => {
    const store = makeStore();
    const { set, get } = wire({ store });
    h.reopenedViews = [
      {
        ...makeView(),
        worktreePath: '/kept/payments-api',
        isAttached: true,
        revision: 3,
      },
    ];

    const result = await removeGoneMount({ set, get })(KEY);

    expect(result.kind).toBe('kept');
    expect(h.removeWorktreeChecked).not.toHaveBeenCalled();
    expect(h.deleteSessionMount).not.toHaveBeenCalled();
  });

  it('keeps a row that was reopened between the folder removal and the row deletion', async () => {
    const store = makeStore();
    const { set, get } = wire({ store });
    h.removeWorktreeChecked.mockImplementation(async () => {
      h.reopenedViews = [
        { ...makeView(), worktreePath: '/kept/payments-api', isAttached: true, revision: 4 },
      ];
      return { kind: 'removed', path: '/kept/payments-api' };
    });

    const result = await removeGoneMount({ set, get })(KEY);

    expect(result).toEqual({
      kind: 'kept',
      reason: 'the mount changed while waiting to remove it',
    });
    expect(h.deleteSessionMount).not.toHaveBeenCalled();
  });

  it('forgets a row whose files are already gone without touching the disk', async () => {
    const store = makeStore();
    h.views = [makeView({ diskState: 'removed' })];
    Object.assign(store, { sessionMounts: { [SESSION_ID]: h.views } });
    const { set, get } = wire({ store });

    await removeGoneMount({ set, get })(KEY);

    expect(h.removeWorktreeChecked).not.toHaveBeenCalled();
    expect(store.sessionMounts[SESSION_ID]).toEqual([]);
  });
});

describe('restoreGoneBranch', () => {
  it('recreates the saved branch, then reopens the mount', async () => {
    const store = makeStore();
    Object.assign(store, { mountBranchGone: { [MOUNT_ID]: { restorableBranchId: 'deleted-1' } } });
    const { set, get } = wire({ store });

    await restoreGoneBranch({ set, get })(KEY);

    expect(store.restoreDeletedBranch).toHaveBeenCalledWith({ id: 'deleted-1' });
    expect(store.attachMount).toHaveBeenCalledWith({ ...KEY, expectedRevision: 2 });
    expect(store.mountBranchGone).toEqual({});
  });

  it('keeps the mark when attach fails so Retry reaches attach again', async () => {
    const store = makeStore();
    Object.assign(store, { mountBranchGone: { [MOUNT_ID]: { restorableBranchId: 'deleted-1' } } });
    vi.mocked(store.attachMount).mockRejectedValueOnce(new Error('branch-taken'));
    const { set, get } = wire({ store });

    await expect(restoreGoneBranch({ set, get })(KEY)).rejects.toThrow('branch-taken');
    expect(store.mountBranchGone).toEqual({ [MOUNT_ID]: { restorableBranchId: 'deleted-1' } });

    await restoreGoneBranch({ set, get })(KEY);

    expect(store.restoreDeletedBranch).toHaveBeenCalledTimes(2);
    expect(store.attachMount).toHaveBeenCalledTimes(2);
    expect(store.mountBranchGone).toEqual({});
  });

  it('attaches against the revision it saw before the restore', async () => {
    const store = makeStore();
    Object.assign(store, { mountBranchGone: { [MOUNT_ID]: { restorableBranchId: 'deleted-1' } } });
    vi.mocked(store.restoreDeletedBranch).mockImplementationOnce(async () => {
      Object.assign(store, { sessionMounts: { [SESSION_ID]: [{ ...makeView(), revision: 3 }] } });
    });
    const { set, get } = wire({ store });

    await restoreGoneBranch({ set, get })(KEY);

    expect(store.attachMount).toHaveBeenCalledWith({ ...KEY, expectedRevision: 2 });
  });

  it('refuses when no saved copy of the branch exists', async () => {
    const store = makeStore();
    Object.assign(store, { mountBranchGone: { [MOUNT_ID]: { restorableBranchId: null } } });
    const { set, get } = wire({ store });

    await expect(restoreGoneBranch({ set, get })(KEY)).rejects.toMatchObject({
      code: 'branch-missing',
    });
    expect(store.attachMount).not.toHaveBeenCalled();
  });
});

describe('attachMount with an expected revision', () => {
  it('does not attach when the mount revision moved', async () => {
    const store = makeStore();
    h.views = [{ ...makeView(), revision: 3 }];
    const { set, get } = wire({ store });

    await expect(attachMount(set, get)({ ...KEY, expectedRevision: 2 })).rejects.toMatchObject({
      code: 'revision-conflict',
    });
    expect(h.updateSessionMountLifecycle).not.toHaveBeenCalled();
  });
});

describe('isBranchDeletedEverywhere', () => {
  it('refreshes origin once for two checks of the same repository', async () => {
    const repoRoot = '/repos/ledger-core';

    await Promise.all([
      isBranchDeletedEverywhere({ repoRoot, branch: 'ak/one' }),
      isBranchDeletedEverywhere({ repoRoot, branch: 'ak/two' }),
    ]);
    await isBranchDeletedEverywhere({ repoRoot, branch: 'ak/three' });

    expect(h.fetchRemoteBranches).toHaveBeenCalledTimes(1);
    expect(h.fetchRemoteBranches).toHaveBeenCalledWith(repoRoot);
  });

  it('does not call a branch gone when the refresh fails', async () => {
    h.fetchRemoteBranches.mockRejectedValueOnce(new Error('offline'));
    h.remoteBranches = ['main'];

    expect(
      await isBranchDeletedEverywhere({ repoRoot: '/repos/notify-relay', branch: 'ak/gone' }),
    ).toBe(false);
  });
});
