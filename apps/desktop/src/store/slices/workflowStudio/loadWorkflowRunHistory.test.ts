import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { aRunHistoryRow } from '../../../features/workflows/testing/aRunHistoryRow';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

type ListParams = {
  readonly workspaceId: string;
};

const { listRuns } = vi.hoisted(() => ({
  listRuns: vi.fn<(params: ListParams) => Promise<unknown>>(),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    listWorkspaceWorkflowRuns: (params: ListParams) => listRuns(params),
  }),
);

const WORKSPACE = brandId<WorkspaceId>({ value: 'ws-harborline' });

const LEDGER = aRunHistoryRow({ id: 'run-ledger', sessionGoal: 'Ledger export speed up' });
const NIGHTLY = aRunHistoryRow({
  id: 'run-nightly',
  sessionGoal: 'Nightly reconciliation before cutoff',
});

type Deferred = {
  readonly promise: Promise<unknown>;
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: unknown) => void;
};

const deferred = (): Deferred => {
  let resolve: (value: unknown) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<unknown>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  listRuns.mockReset();
});

afterEach(() => {
  listRuns.mockReset();
});

const historyOf = () => store.getState().workflowRunHistory[WORKSPACE];

describe('loadWorkflowRunHistory', () => {
  it('reads the runs of the named workspace and keeps them', async () => {
    listRuns.mockResolvedValue([LEDGER, NIGHTLY]);

    await store.getState().loadWorkflowRunHistory({ workspaceId: WORKSPACE });

    expect(listRuns).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: WORKSPACE }));
    expect(historyOf()?.status).toBe('ready');
    expect(historyOf()?.runs).toEqual([LEDGER, NIGHTLY]);
  });

  it('keeps the old runs and says the load failed, then a retry replaces them', async () => {
    listRuns.mockResolvedValueOnce([LEDGER]);
    await store.getState().loadWorkflowRunHistory({ workspaceId: WORKSPACE });

    listRuns.mockRejectedValueOnce(new Error('database is locked'));
    await store.getState().loadWorkflowRunHistory({ workspaceId: WORKSPACE });

    expect(historyOf()?.status).toBe('failed');
    expect(historyOf()?.runs).toEqual([LEDGER]);

    listRuns.mockResolvedValueOnce([NIGHTLY, LEDGER]);
    await store.getState().loadWorkflowRunHistory({ workspaceId: WORKSPACE });

    expect(historyOf()?.status).toBe('ready');
    expect(historyOf()?.runs).toEqual([NIGHTLY, LEDGER]);
  });

  it('drops a late answer to an older request', async () => {
    const slow = deferred();
    listRuns.mockReturnValueOnce(slow.promise).mockResolvedValueOnce([NIGHTLY]);

    const first = store.getState().loadWorkflowRunHistory({ workspaceId: WORKSPACE });
    await store.getState().loadWorkflowRunHistory({ workspaceId: WORKSPACE });
    slow.resolve([LEDGER]);
    await first;

    expect(historyOf()?.runs).toEqual([NIGHTLY]);
    expect(historyOf()?.status).toBe('ready');
  });

  it('drops a late failure of an older request', async () => {
    const slow = deferred();
    listRuns.mockReturnValueOnce(slow.promise).mockResolvedValueOnce([NIGHTLY]);

    const first = store.getState().loadWorkflowRunHistory({ workspaceId: WORKSPACE });
    await store.getState().loadWorkflowRunHistory({ workspaceId: WORKSPACE });
    slow.reject(new Error('database is locked'));
    await first;

    expect(historyOf()?.status).toBe('ready');
  });
});
