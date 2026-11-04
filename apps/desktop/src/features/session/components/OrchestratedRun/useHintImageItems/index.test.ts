// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { GoalAttachment, OrchestratorHint } from '@goodboy/types';
import { isoDateTimeOf } from '../../../../../__tests__/helpers/brandedIds';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { useHintImageItems } from './index';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock({}),
);

const AT = isoDateTimeOf({ value: '2026-10-03T09:00:00.000Z' });
const SCRATCH = '/data/scratch/session-northwind';
const WORKTREE = '/repo/.worktrees/retry-budget';

const run = aWorkflowRun({ executionMode: 'dynamic' });
const session = aSession({ workflowRuns: [run] });

const rowOf = ({
  id,
  relPath,
}: {
  readonly id: string;
  readonly relPath: string;
}): GoalAttachment => ({
  id,
  ownerType: 'workflow_run',
  ownerId: run.id,
  relPath,
  kind: 'image',
  fileName: `${id}.png`,
  mimeType: 'image/png',
  createdAt: AT,
});

const hint: OrchestratorHint = {
  id: 'hint-1',
  text: 'Northwind sandbox still returns 502.',
  createdAt: AT,
  attachmentIds: ['early', 'late'],
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('useHintImageItems', () => {
  it('reads each image from the dir that holds it, before and after the run gets a worktree', () => {
    useAppStore.setState({
      sessions: [session],
      sessionWorktrees: { [session.id]: [WORKTREE] },
      sessionScratchDirs: { [session.id]: SCRATCH },
      workflowRunAttachments: {
        [run.id]: [
          rowOf({ id: 'early', relPath: '.goodboy/attachments/scratch-early-early.png' }),
          rowOf({ id: 'late', relPath: '.goodboy/attachments/late-late.png' }),
        ],
      },
    });

    const { result } = renderHook(() =>
      useHintImageItems({ sessionId: session.id, runId: run.id, hint }),
    );

    expect(result.current.images.map((image) => [image.id, image.workingDir])).toEqual([
      ['early', SCRATCH],
      ['late', WORKTREE],
    ]);
  });

  it('finds a scratch image of a run that never got a worktree', () => {
    useAppStore.setState({
      sessions: [session],
      sessionWorktrees: {},
      sessionScratchDirs: { [session.id]: SCRATCH },
      workflowRunAttachments: {
        [run.id]: [rowOf({ id: 'early', relPath: '.goodboy/attachments/scratch-early-early.png' })],
      },
    });

    const { result } = renderHook(() =>
      useHintImageItems({ sessionId: session.id, runId: run.id, hint }),
    );

    expect(result.current.images.map((image) => image.workingDir)).toEqual([SCRATCH]);
  });
});
