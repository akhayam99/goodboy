// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoalAttachment, IsoDateTime, WorkflowRunId } from '@goodboy/types';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';

type Read = {
  readonly resolve: (rows: ReadonlyArray<GoalAttachment>) => void;
  readonly reject: (error: Error) => void;
};

const { reads, listGoalAttachmentsForRun } = vi.hoisted(() => {
  const pending: Array<{
    resolve: (rows: ReadonlyArray<unknown>) => void;
    reject: (error: Error) => void;
  }> = [];
  return {
    reads: pending,
    listGoalAttachmentsForRun: vi.fn(
      () =>
        new Promise<ReadonlyArray<unknown>>((resolve, reject) => {
          pending.push({ resolve, reject });
        }),
    ),
  };
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    listGoalAttachmentsForRun,
    insertGoalAttachment: async () => undefined,
    deleteGoalAttachment: async () => undefined,
  }),
);

const RUN = aWorkflowRun();
const SESSION = aSession();
const OWNER = { type: 'workflow_run', id: RUN.id } as const;
const AT: IsoDateTime = JSON.parse('"2026-10-30T10:00:00.000Z"');

type RowParams = {
  readonly id: string;
};

const rowOf = ({ id }: RowParams): GoalAttachment => ({
  id,
  ownerType: 'workflow_run',
  ownerId: RUN.id,
  relPath: `.goodboy/attachments/${id}.png`,
  kind: 'image',
  fileName: `${id}.png`,
  mimeType: 'image/png',
  createdAt: AT,
});

const readAt = ({ index }: { readonly index: number }): Read => {
  const read = reads[index];
  if (read === undefined) {
    throw new Error(`no read ${index}`);
  }
  return read;
};

const idsOf = (runId: WorkflowRunId): ReadonlyArray<string> =>
  (useAppStore.getState().workflowRunAttachments[runId] ?? []).map((row) => row.id);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  reads.length = 0;
  listGoalAttachmentsForRun.mockClear();
  storySpies.writeAttachment.mockResolvedValue('.goodboy/attachments/new.png');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadGoalAttachments', () => {
  it('reads the rows of a run once when many rows ask at the same time', async () => {
    const { loadGoalAttachments } = useAppStore.getState();

    const all = Promise.all([
      loadGoalAttachments(OWNER),
      loadGoalAttachments(OWNER),
      loadGoalAttachments(OWNER),
    ]);
    expect(listGoalAttachmentsForRun).toHaveBeenCalledTimes(1);
    readAt({ index: 0 }).resolve([rowOf({ id: 'a' })]);
    await all;

    expect(idsOf(RUN.id)).toEqual(['a']);
    await loadGoalAttachments(OWNER);
    expect(listGoalAttachmentsForRun).toHaveBeenCalledTimes(1);
  });

  it('keeps the newer rows of an add when the older load answers late', async () => {
    const { loadGoalAttachments, addGoalAttachments } = useAppStore.getState();
    useAppStore.setState({
      currentSessionId: SESSION.id,
      sessionWorktrees: { [SESSION.id]: ['/worktrees/payments-api'] },
    });
    const load = loadGoalAttachments(OWNER);

    const add = addGoalAttachments(OWNER, [
      { id: 'new', fileName: 'new.png', mimeType: 'image/png', dataBase64: 'AAAA' },
    ]);
    await vi.waitFor(() => expect(listGoalAttachmentsForRun).toHaveBeenCalledTimes(2));
    readAt({ index: 1 }).resolve([rowOf({ id: 'old' }), rowOf({ id: 'new' })]);
    await add;
    readAt({ index: 0 }).resolve([rowOf({ id: 'old' })]);
    await load;

    expect(idsOf(RUN.id)).toEqual(['old', 'new']);
  });

  it('does not bring back a removed row when an older load answers late', async () => {
    const { loadGoalAttachments, removeGoalAttachment } = useAppStore.getState();
    const load = loadGoalAttachments(OWNER);
    useAppStore.setState({
      workflowRunAttachments: { [RUN.id]: [rowOf({ id: 'a' }), rowOf({ id: 'b' })] },
    });

    await removeGoalAttachment(OWNER, 'a');
    readAt({ index: 0 }).resolve([rowOf({ id: 'a' }), rowOf({ id: 'b' })]);
    await load;

    expect(idsOf(RUN.id)).toEqual(['b']);
  });

  it('rejects for every waiting row on a failed read and reads again on the next ask', async () => {
    const { loadGoalAttachments } = useAppStore.getState();

    const first = Promise.allSettled([loadGoalAttachments(OWNER), loadGoalAttachments(OWNER)]);
    readAt({ index: 0 }).reject(new Error('db locked'));
    const settled = await first;

    expect(settled.map(({ status }) => status)).toEqual(['rejected', 'rejected']);
    expect(useAppStore.getState().workflowRunAttachments[RUN.id]).toBeUndefined();
    const retry = loadGoalAttachments(OWNER);
    expect(listGoalAttachmentsForRun).toHaveBeenCalledTimes(2);
    readAt({ index: 1 }).resolve([rowOf({ id: 'a' })]);
    await retry;
    expect(idsOf(RUN.id)).toEqual(['a']);
  });
});
