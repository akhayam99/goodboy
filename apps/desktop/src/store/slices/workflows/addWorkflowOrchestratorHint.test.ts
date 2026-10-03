// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoalAttachment, IsoDateTime, OrchestratorHint } from '@goodboy/types';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';

const { savedRows, savedHints } = vi.hoisted(() => ({
  savedRows: [] as GoalAttachment[],
  savedHints: [] as ReadonlyArray<OrchestratorHint>[],
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
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    insertGoalAttachment: async (
      _db: unknown,
      row: Omit<GoalAttachment, 'ownerType' | 'ownerId' | 'createdAt'> & {
        readonly owner: { readonly type: 'session' | 'workflow_run'; readonly id: string };
      },
    ) => {
      savedRows.push({
        id: row.id,
        ownerType: row.owner.type,
        ownerId: row.owner.id,
        relPath: row.relPath,
        kind: row.kind,
        fileName: row.fileName,
        mimeType: row.mimeType,
        createdAt: '2026-10-03T09:00:00.000Z' as IsoDateTime,
      });
    },
    listGoalAttachmentsForRun: async (_db: unknown, runId: string) =>
      savedRows.filter((row) => row.ownerId === runId),
    updateWorkflowRunOrchestratorHints: async (
      _db: unknown,
      _runId: string,
      hints: ReadonlyArray<OrchestratorHint>,
    ) => {
      savedHints.push(hints);
    },
  }),
);

const run = aWorkflowRun({ executionMode: 'dynamic' });
const session = aSession({ workflowRuns: [run] });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  savedRows.length = 0;
  savedHints.length = 0;
  useAppStore.setState({
    sessions: [session],
    sessionWorktrees: { [session.id]: ['/repo/.worktrees/retry-budget'] },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

const IMAGE = {
  id: 'att-trace',
  fileName: 'checkout-trace.png',
  mimeType: 'image/png',
  dataBase64: 'QUJD',
};

const hintsNow = () =>
  useAppStore.getState().sessions.find((entry) => entry.id === session.id)?.workflowRuns[0]
    ?.orchestratorHints ?? [];

describe('addWorkflowOrchestratorHint', () => {
  it('saves the image with the hint as a run file the next agent reads', async () => {
    await useAppStore.getState().addWorkflowOrchestratorHint(session.id, run.id, {
      text: 'Northwind sandbox still returns 502.\nThe trace is attached.',
      delivery: 'queue',
      attachments: [IMAGE],
    });

    expect(storySpies.writeAttachment).toHaveBeenCalledTimes(1);
    expect(savedRows.map((row) => [row.id, row.ownerType, row.ownerId])).toEqual([
      ['att-trace', 'workflow_run', run.id],
    ]);
    expect(useAppStore.getState().workflowRunAttachments[run.id]?.map((row) => row.id)).toEqual([
      'att-trace',
    ]);
    const [hint] = hintsNow();
    expect(hint?.text).toBe('Northwind sandbox still returns 502.\nThe trace is attached.');
    expect(hint?.attachmentIds).toEqual(['att-trace']);
    expect(savedHints.at(-1)?.[0]?.attachmentIds).toEqual(['att-trace']);
  });

  it('keeps an image-only hint with a line that points at the image', async () => {
    await useAppStore.getState().addWorkflowOrchestratorHint(session.id, run.id, {
      text: '   ',
      delivery: 'queue',
      attachments: [IMAGE],
    });

    expect(hintsNow().map((hint) => hint.text)).toEqual(['See the attached image.']);
  });

  it('refuses files when the session has no worktree, and saves no hint', async () => {
    useAppStore.setState({ sessionWorktrees: {} });

    await expect(
      useAppStore.getState().addWorkflowOrchestratorHint(session.id, run.id, {
        text: 'look at the trace',
        delivery: 'queue',
        attachments: [IMAGE],
      }),
    ).rejects.toThrow('This session has no worktree yet, so the hint cannot keep files.');
    expect(hintsNow()).toEqual([]);
    expect(savedRows).toEqual([]);
  });
});
