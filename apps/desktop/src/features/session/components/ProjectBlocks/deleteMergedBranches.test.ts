// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type DeletedBranch,
  type IsoDateTime,
  type MountCleanupProposal,
  type MountId,
  type ProjectId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import {
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import type {
  AfterMergeOutcome,
  RunAfterMergeCleanupParams,
} from '../../../../store/slices/branch-cleanup/types';
import { runActionRetry } from '../../../../store/slices/notifications/actionRetries';
import { deleteMergedBranches } from './deleteMergedBranches';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger' });
const LEDGER = 'goodboy/ledger-export';
const RELAY = 'goodboy/notify-relay';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
});

type ProposalParams = {
  readonly branch: string;
};

const proposalOf = ({ branch }: ProposalParams): MountCleanupProposal => ({
  requestId: `request-${branch}`,
  sessionId: SESSION_ID,
  mountId: brandId<MountId>({ value: `mount-${branch}` }),
  projectId: null,
  reason: 'merge_cleanup',
  repoRoot: '/tmp/ledger-core',
  worktreePath: `/tmp/ledger-core/.goodboy/worktrees/${branch}`,
  branch,
  sizeBytes: null,
  request: null,
  createdAt: brandId<IsoDateTime>({ value: '2026-10-18T10:00:00.000Z' }),
});

const deletedOf = ({ branch }: ProposalParams): AfterMergeOutcome => {
  const deleted: DeletedBranch = {
    id: `deleted-${branch}`,
    workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
    projectId: brandId<ProjectId>({ value: 'project-ledger-core' }),
    sessionId: SESSION_ID,
    repoRoot: '/tmp/ledger-core',
    branch,
    sha: 'abc1234',
    keepRef: `refs/goodboy/kept/${branch}`,
    onOrigin: false,
    deletedAt: brandId<IsoDateTime>({ value: '2026-10-18T10:05:00.000Z' }),
    restoredAt: null,
  };
  return { kind: 'deleted', deleted };
};

const failureRows = () =>
  useAppStore
    .getState()
    .notifications.filter((row) => row.coalesceKey?.startsWith('delete-local-branches:') === true);

const retryIdOf = (): string => {
  const [row] = failureRows();
  if (row?.action?.kind !== 'retry-action') {
    throw new Error('the failure row carries no Retry');
  }
  return row.action.retryId;
};

describe('deleteMergedBranches', () => {
  it('asks for the local branch only, with a folder removal that must succeed', async () => {
    const runAfterMergeCleanup = vi.fn(async ({ expectedBranch }: RunAfterMergeCleanupParams) =>
      deletedOf({ branch: expectedBranch }),
    );
    useAppStore.setState({
      runAfterMergeCleanup,
      settleMountCleanup: vi.fn(async () => undefined),
    });

    expect(
      await deleteMergedBranches({
        sessionId: SESSION_ID,
        proposals: [proposalOf({ branch: LEDGER })],
      }),
    ).toBe(true);

    expect(runAfterMergeCleanup).toHaveBeenCalledWith(
      expect.objectContaining({ isRequested: true, isLocalOnly: true, isRemovalRequired: true }),
    );
  });

  it('keeps one row as retries go: a retry that fixes one of two leaves one row for the other', async () => {
    const outcomes = new Map<string, Array<'fail' | 'delete'>>([
      [LEDGER, ['fail', 'delete']],
      [RELAY, ['fail', 'fail', 'delete']],
    ]);
    const runAfterMergeCleanup = vi.fn(async ({ expectedBranch }: RunAfterMergeCleanupParams) => {
      const next = outcomes.get(expectedBranch)?.shift();
      if (next === 'fail') {
        throw new Error('the folder is in use');
      }
      return deletedOf({ branch: expectedBranch });
    });
    useAppStore.setState({
      runAfterMergeCleanup,
      settleMountCleanup: vi.fn(async () => undefined),
    });

    await deleteMergedBranches({
      sessionId: SESSION_ID,
      proposals: [proposalOf({ branch: LEDGER }), proposalOf({ branch: RELAY })],
    });
    await vi.waitFor(() => expect(failureRows()).toHaveLength(1));
    expect(failureRows()[0]?.title).toBe("Couldn't delete 2 local branches");
    const firstRetryId = retryIdOf();

    expect(await runActionRetry({ retryId: firstRetryId })).toBe(false);
    await vi.waitFor(() =>
      expect(failureRows().map((row) => row.title)).toEqual([
        `Couldn't delete the local branch ${RELAY}`,
      ]),
    );
    expect(retryIdOf()).toBe(firstRetryId);

    runAfterMergeCleanup.mockClear();
    expect(await runActionRetry({ retryId: firstRetryId })).toBe(true);
    expect(runAfterMergeCleanup).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ expectedBranch: RELAY }),
    );
    await vi.waitFor(() => expect(failureRows()).toEqual([]));
    expect(useAppStore.getState().undoStack).toHaveLength(2);
  });

  it('keeps a deleted branch in Undo when its suggestion fails to clear, and the Retry only clears it', async () => {
    const runAfterMergeCleanup = vi.fn(async ({ expectedBranch }: RunAfterMergeCleanupParams) =>
      deletedOf({ branch: expectedBranch }),
    );
    const settleMountCleanup = vi.fn(async () => undefined);
    settleMountCleanup.mockRejectedValueOnce(new Error('database is locked'));
    useAppStore.setState({ runAfterMergeCleanup, settleMountCleanup });

    expect(
      await deleteMergedBranches({
        sessionId: SESSION_ID,
        proposals: [proposalOf({ branch: LEDGER })],
      }),
    ).toBe(false);

    expect(useAppStore.getState().undoStack).toHaveLength(1);
    await vi.waitFor(() =>
      expect(failureRows().map((row) => row.title)).toEqual([
        `Couldn't finish deleting the local branch ${LEDGER}`,
      ]),
    );

    expect(await runActionRetry({ retryId: retryIdOf() })).toBe(true);
    expect(runAfterMergeCleanup).toHaveBeenCalledTimes(1);
    expect(settleMountCleanup).toHaveBeenCalledTimes(2);
    expect(useAppStore.getState().undoStack).toHaveLength(1);
    await vi.waitFor(() => expect(failureRows()).toEqual([]));
  });
});
