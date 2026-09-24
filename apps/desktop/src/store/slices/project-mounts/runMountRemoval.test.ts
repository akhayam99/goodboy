import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MountCleanupDecision,
  MountDiskState,
  MountId,
  MountOperation,
  ProjectId,
  SessionId,
} from '@goodboy/types';
import type { CleanupTarget } from '../mount-cleanup/types';
import type { GetFn } from './types';

type CleanupResult = {
  readonly decision: MountCleanupDecision;
  readonly diskState: MountDiskState;
};

type LockParams = {
  readonly run: () => Promise<unknown>;
};

const h = vi.hoisted(() => ({
  operations: new Map<string, MountOperation>(),
  snapshots: new Array<ReadonlyArray<MountOperation>>(),
  cleanupMountDirectory: vi.fn(
    async ({ target }: { readonly target: CleanupTarget }): Promise<CleanupResult> => ({
      decision: { kind: 'removed', path: target.worktreePath },
      diskState: 'removed',
    }),
  ),
}));

vi.mock('@goodboy/db', () => ({
  getMountOperation: vi.fn(
    async ({ requestId }: { readonly requestId: string }) => h.operations.get(requestId) ?? null,
  ),
  upsertMountOperation: vi.fn(async ({ operation }: { readonly operation: MountOperation }) => {
    h.operations.set(operation.requestId, operation);
  }),
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../mount-cleanup', () => ({
  cleanupMountDirectory: h.cleanupMountDirectory,
}));

vi.mock('./mountLocks', () => ({
  withRepositoryAndMountLock: vi.fn(async ({ run }: LockParams) => run()),
}));

import { runMountRemoval } from './runMountRemoval';

const typedString = <Value extends string>({ value }: { readonly value: string }): Value =>
  JSON.parse(JSON.stringify(value));

const SESSION_ID = typedString<SessionId>({ value: 'session-remove' });
const MOUNT_ID = typedString<MountId>({ value: 'mount-remove' });
const PROJECT_ID = typedString<ProjectId>({ value: 'project-remove' });

const target = ({ isRepoProject = true }: { readonly isRepoProject?: boolean } = {}) => ({
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  repoRoot: '/repos/ledger-core',
  worktreePath: '/repos/ledger-core/.goodboy/worktrees/remove',
  branch: 'ak/remove',
  diskState: 'present' as const,
  isRepoProject,
});

const get: GetFn = () => Object.create(null);

const onlyOperation = (): MountOperation => {
  const [operation] = [...h.operations.values()];
  if (operation === undefined) {
    throw new Error('no operation recorded');
  }
  return operation;
};

beforeEach(() => {
  vi.clearAllMocks();
  h.operations.clear();
  h.snapshots.length = 0;
  h.cleanupMountDirectory.mockImplementation(async ({ target: cleanupTarget }) => {
    h.snapshots.push([...h.operations.values()]);
    return {
      decision: { kind: 'removed', path: cleanupTarget.worktreePath },
      diskState: 'removed',
    };
  });
});

describe('runMountRemoval', () => {
  it('logs a running remove operation before touching the disk', async () => {
    const finishRow = vi.fn(async () => true);

    await runMountRemoval({
      get,
      target: target(),
      mode: 'safe',
      keepDirectory: false,
      finish: 'clear-path',
      expectedRevision: 3,
      finishRow,
    });

    expect(h.snapshots[0]).toEqual([
      expect.objectContaining({
        kind: 'remove',
        status: 'running',
        mountId: MOUNT_ID,
        expectedRevision: 3,
        input: expect.objectContaining({
          mountId: MOUNT_ID,
          finish: 'clear-path',
          keepDirectory: false,
          worktreePath: '/repos/ledger-core/.goodboy/worktrees/remove',
        }),
      }),
    ]);
    expect(finishRow).toHaveBeenCalledWith({
      decision: { kind: 'removed', path: '/repos/ledger-core/.goodboy/worktrees/remove' },
      diskState: 'removed',
    });
    expect(onlyOperation()).toMatchObject({ status: 'succeeded', mountId: MOUNT_ID });
  });

  it('closes the operation as failed and leaves the row alone when cleanup fails', async () => {
    h.cleanupMountDirectory.mockResolvedValueOnce({
      decision: { kind: 'failed', path: '/x', reason: 'git refused' },
      diskState: 'present',
    });
    const finishRow = vi.fn(async () => true);

    const result = await runMountRemoval({
      get,
      target: target(),
      mode: 'safe',
      keepDirectory: false,
      finish: 'clear-path',
      expectedRevision: 0,
      finishRow,
    });

    expect(result.decision.kind).toBe('failed');
    expect(finishRow).not.toHaveBeenCalled();
    expect(onlyOperation()).toMatchObject({ status: 'failed', errorCode: 'cleanup-failed' });
  });

  it('marks the operation uncertain and throws when the row write loses its revision', async () => {
    const removal = runMountRemoval({
      get,
      target: target(),
      mode: 'safe',
      keepDirectory: false,
      finish: 'clear-path',
      expectedRevision: 0,
      finishRow: async () => false,
    });

    await expect(removal).rejects.toMatchObject({ code: 'revision-conflict' });
    expect(onlyOperation()).toMatchObject({ status: 'uncertain', errorCode: 'revision-conflict' });
  });

  it('marks the operation uncertain with the thrown code and rethrows', async () => {
    const failure = Object.assign(new Error('row gone'), { code: 'mount-missing' });

    const removal = runMountRemoval({
      get,
      target: target(),
      mode: 'safe',
      keepDirectory: false,
      finish: 'clear-path',
      expectedRevision: 0,
      finishRow: async () => {
        throw failure;
      },
    });

    await expect(removal).rejects.toBe(failure);
    expect(onlyOperation()).toMatchObject({ status: 'uncertain', errorCode: 'mount-missing' });
  });

  it('settles a drop-row removal without pointing at the deleted row', async () => {
    await runMountRemoval({
      get,
      target: target(),
      mode: 'safe',
      keepDirectory: false,
      finish: 'drop-row',
      expectedRevision: 0,
      finishRow: async () => true,
    });

    expect(onlyOperation()).toMatchObject({
      status: 'succeeded',
      mountId: null,
      input: expect.objectContaining({ mountId: MOUNT_ID, finish: 'drop-row' }),
    });
  });

  it('records a folder project directory as kept so recovery never removes it', async () => {
    await runMountRemoval({
      get,
      target: target({ isRepoProject: false }),
      mode: 'safe',
      keepDirectory: false,
      finish: 'drop-row',
      expectedRevision: 0,
      finishRow: async () => true,
    });

    expect(onlyOperation().input).toMatchObject({ keepDirectory: true });
  });
});
