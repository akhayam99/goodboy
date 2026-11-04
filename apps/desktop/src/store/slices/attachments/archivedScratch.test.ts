// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoalAttachment, IsoDateTime } from '@goodboy/types';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';

const { listGoalAttachmentsForRun } = vi.hoisted(() => ({
  listGoalAttachmentsForRun: vi.fn(async (): Promise<ReadonlyArray<unknown>> => []),
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
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    listGoalAttachmentsForRun,
    archiveSession: async () => undefined,
    unarchiveSession: async () => undefined,
  }),
);

const RUN = aWorkflowRun();
const SESSION = aSession({ workflowRuns: [RUN] });
const OWNER = { type: 'workflow_run', id: RUN.id } as const;
const SCRATCH = '/goodboy-root/scratch/payments-api';
const AT: IsoDateTime = JSON.parse('"2026-10-30T10:00:00.000Z"');

const SCRATCH_ROW: GoalAttachment = {
  id: 'hint-1',
  ownerType: 'workflow_run',
  ownerId: RUN.id,
  relPath: '.goodboy/attachments/scratch-hint-1-sketch.png',
  kind: 'image',
  fileName: 'sketch.png',
  mimeType: 'image/png',
  createdAt: AT,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  listGoalAttachmentsForRun.mockClear();
  listGoalAttachmentsForRun.mockResolvedValue([SCRATCH_ROW]);
  storySpies.scratchDirPrepare.mockResolvedValue(SCRATCH);
});

describe('scratch attachments of an archived session', () => {
  it('resolves the scratch dir of a run that belongs to an archived session', async () => {
    useAppStore.setState({
      sessions: [],
      archivedSessions: { [SESSION.workspaceId]: [SESSION] },
    });

    await useAppStore.getState().loadGoalAttachments(OWNER);

    expect(useAppStore.getState().sessionScratchDirs[SESSION.id]).toBe(SCRATCH);
    expect(useAppStore.getState().workflowRunAttachments[RUN.id]).toEqual([SCRATCH_ROW]);
  });

  it('keeps the scratch dir with its cached rows through archive and restore', async () => {
    useAppStore.setState({
      sessions: [SESSION],
      currentWorkspaceId: SESSION.workspaceId,
      currentSessionId: null,
    });
    await useAppStore.getState().loadGoalAttachments(OWNER);

    await useAppStore.getState().archiveTask(SESSION.id);
    await useAppStore.getState().unarchiveTask(SESSION.id);
    await useAppStore.getState().loadGoalAttachments(OWNER);

    expect(useAppStore.getState().sessionScratchDirs[SESSION.id]).toBe(SCRATCH);
    expect(useAppStore.getState().workflowRunAttachments[RUN.id]).toEqual([SCRATCH_ROW]);
    expect(listGoalAttachmentsForRun).toHaveBeenCalledTimes(1);
  });

  it('drops the scratch dir with the rows when the session is deleted', () => {
    useAppStore.setState({
      sessionScratchDirs: { [SESSION.id]: SCRATCH },
      workflowRunAttachments: { [RUN.id]: [SCRATCH_ROW] },
    });

    useAppStore.getState().evictSession({ sessionId: SESSION.id, mode: 'delete' });

    expect(useAppStore.getState().sessionScratchDirs[SESSION.id]).toBeUndefined();
  });
});
