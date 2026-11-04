// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoalAttachment, OrchestratorHint } from '@goodboy/types';
import { isoDateTimeOf } from '../../../../__tests__/helpers/brandedIds';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../storyHarness';
import { orchestratorHintContext } from './orchestratorHintContext';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../storyHarness')).dbModuleMock({}));

const AT = isoDateTimeOf({ value: '2026-10-03T09:00:00.000Z' });
const SCRATCH = '/data/scratch/session-northwind';
const WORKTREE = '/repo/.worktrees/retry-budget';

const run = aWorkflowRun({ executionMode: 'dynamic' });
const session = aSession({ workflowRuns: [run] });

const row = ({
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

const hintOf = (attachmentIds: ReadonlyArray<string>): OrchestratorHint => ({
  id: 'hint-1',
  text: 'Northwind sandbox still returns 502.',
  createdAt: AT,
  attachmentIds,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const contextFor = ({ hints }: { readonly hints: ReadonlyArray<OrchestratorHint> }) =>
  orchestratorHintContext({
    get: useAppStore.getState,
    sessionId: session.id,
    workflowRunId: run.id,
    workspaceId: session.workspaceId,
    hints,
  });

describe('orchestratorHintContext', () => {
  it('hands the orchestrator a scratch image of a session with no worktree, read from its dir', async () => {
    useAppStore.setState({
      sessions: [session],
      sessionWorktrees: {},
      sessionScratchDirs: { [session.id]: SCRATCH },
      workflowRunAttachments: {
        [run.id]: [row({ id: 'trace', relPath: '.goodboy/attachments/scratch-trace-trace.png' })],
      },
    });

    const { clientDeps, hintInput } = await contextFor({ hints: [hintOf(['trace'])] });

    expect(hintInput.canReadFiles).toBe(true);
    expect(hintInput.operatorHints).toContain(
      `${SCRATCH}/.goodboy/attachments/scratch-trace-trace.png`,
    );
    expect(clientDeps).toEqual({ workingDir: SCRATCH });
  });

  it('reads a scratch image and a worktree image once the run has a worktree', async () => {
    useAppStore.setState({
      sessions: [session],
      sessionWorktrees: { [session.id]: [WORKTREE] },
      sessionScratchDirs: { [session.id]: SCRATCH },
      workflowRunAttachments: {
        [run.id]: [
          row({ id: 'early', relPath: '.goodboy/attachments/scratch-early-early.png' }),
          row({ id: 'late', relPath: '.goodboy/attachments/late-late.png' }),
        ],
      },
    });

    const { clientDeps, hintInput } = await contextFor({
      hints: [hintOf(['early', 'late'])],
    });

    expect(hintInput.canReadFiles).toBe(true);
    expect(hintInput.operatorHints).toContain(
      `${SCRATCH}/.goodboy/attachments/scratch-early-early.png`,
    );
    expect(hintInput.operatorHints).toContain(`${WORKTREE}/.goodboy/attachments/late-late.png`);
    expect(clientDeps).toEqual({ workingDir: WORKTREE, readDirs: [SCRATCH] });
  });

  it('reads a worktree image from the worktree only, with no extra dir', async () => {
    useAppStore.setState({
      sessions: [session],
      sessionWorktrees: { [session.id]: [WORKTREE] },
      workflowRunAttachments: {
        [run.id]: [row({ id: 'late', relPath: '.goodboy/attachments/late-late.png' })],
      },
    });

    const { clientDeps } = await contextFor({ hints: [hintOf(['late'])] });

    expect(clientDeps).toEqual({ workingDir: WORKTREE });
  });
});
