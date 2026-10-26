// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type MountId, type ProviderRunId } from '@goodboy/types';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import type { SessionProjectMount } from '@goodboy/types';

const { insertTurnFileSet, worktreeSnapshot, worktreeTurnFiles } = vi.hoisted(() => ({
  insertTurnFileSet: vi.fn(async () => undefined),
  worktreeSnapshot: vi.fn(),
  worktreeTurnFiles: vi.fn(),
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({ insertTurnFileSet }),
);
vi.mock('../../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../../features/worktree/worktree', () => ({ worktreeSnapshot, worktreeTurnFiles }));

import { beginTurnFileSets, recordTurnFileSets } from '.';

const SESSION = aSession({ workspaceId: aWorkspace({}).id }).id;
const RUN = brandId<ProviderRunId>({ value: 'run-3' });
const PROJECT = aProject({ baseBranch: 'main' });

const mountOf = (patch: Partial<SessionProjectMount>): SessionProjectMount => ({
  mountId: brandId<MountId>({ value: 'mount-payments' }),
  sessionId: SESSION,
  projectId: PROJECT.id,
  mountName: 'payments-api',
  worktreePath: '/repos/payments-api/.goodboy/worktrees/retry-webhook',
  lastWorktreePath: null,
  repoRoot: '/repos/payments-api',
  branch: 'hl/retry-webhook',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
  ...patch,
});

const FOUND = {
  own: [{ path: 'src/webhooks/retry.ts', status: 'modified', additions: 42, deletions: 6 }],
  fromBase: ['src/ledger/post.ts'],
  isPartial: false,
};

const reportError = vi.fn(async () => undefined);
type RecordOptions = {
  readonly isShared?: boolean;
  readonly mounts?: ReadonlyArray<SessionProjectMount>;
};

const record = async ({ isShared = false, mounts = [mountOf({})] }: RecordOptions = {}) =>
  recordTurnFileSets({
    reportError,
    sessionId: SESSION,
    runId: RUN,
    projects: [PROJECT],
    begun: beginTurnFileSets({ mounts }),
    isShared: async () => isShared,
  });

beforeEach(() => {
  vi.clearAllMocks();
  worktreeSnapshot.mockResolvedValue({ head: 'abc', entries: [], isPartial: false });
  worktreeTurnFiles.mockResolvedValue(FOUND);
});

describe('turn file sets', () => {
  it('records the files of the turn and the ones from main apart, for the mount it wrote in', async () => {
    await record();

    expect(worktreeTurnFiles).toHaveBeenCalledWith({
      worktreePath: '/repos/payments-api/.goodboy/worktrees/retry-webhook',
      before: { head: 'abc', entries: [] },
      baseBranch: 'main',
    });
    expect(insertTurnFileSet).toHaveBeenCalledWith({
      db: {},
      set: expect.objectContaining({
        runId: RUN,
        mountId: 'mount-payments',
        own: FOUND.own,
        fromBase: FOUND.fromBase,
        isPartial: false,
      }),
    });
    expect(reportError).not.toHaveBeenCalled();
  });

  it('records nothing for a turn another agent wrote beside, because the files could be theirs', async () => {
    await record({ isShared: true });

    expect(worktreeTurnFiles).not.toHaveBeenCalled();
    expect(insertTurnFileSet).not.toHaveBeenCalled();
  });

  it('leaves a detached mount and a folder without a branch out', async () => {
    await record({
      mounts: [mountOf({ diskState: 'removed' }), mountOf({ branch: '' })],
    });

    expect(worktreeSnapshot).not.toHaveBeenCalled();
    expect(insertTurnFileSet).not.toHaveBeenCalled();
  });

  it('reports a failure once and never fails the turn', async () => {
    worktreeTurnFiles.mockRejectedValue(new Error('git failed: status'));

    await expect(
      record({
        mounts: [
          mountOf({}),
          mountOf({ mountId: brandId<MountId>({ value: 'mount-ledger' }), worktreePath: '/x' }),
        ],
      }),
    ).resolves.toBeUndefined();

    expect(insertTurnFileSet).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't record what this turn changed" }),
    );
  });

  it('keeps the other mounts when one before snapshot failed', async () => {
    worktreeSnapshot.mockRejectedValueOnce(new Error('not a repository'));

    await record({
      mounts: [
        mountOf({}),
        mountOf({ mountId: brandId<MountId>({ value: 'mount-ledger' }), worktreePath: '/x' }),
      ],
    });

    expect(insertTurnFileSet).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledTimes(1);
  });
});
