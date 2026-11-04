// @vitest-environment happy-dom

const { listGoalAttachmentsForRun } = vi.hoisted(() => ({ listGoalAttachmentsForRun: vi.fn() }));

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
  (await import('../../../../../store/storyHarness')).dbModuleMock({ listGoalAttachmentsForRun }),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { GoalAttachment, IsoDateTime, WorkflowRunId } from '@goodboy/types';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { GoalAttachmentsStrip } from './GoalAttachmentsStrip';

const AT: IsoDateTime = JSON.parse('"2026-10-30T10:00:00.000Z"');

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  listGoalAttachmentsForRun.mockReset();
  stubStoryInvoke({ attachment_read: 'data:image/png;base64,AAAA' });
});

afterEach(cleanup);

type ImageParams = {
  readonly runId: WorkflowRunId;
  readonly name: string;
};

type MountParams = {
  readonly hintIds: ReadonlyArray<string>;
};

const imageOf = ({ runId, name }: ImageParams): GoalAttachment => ({
  id: `att-${name}`,
  ownerType: 'workflow_run',
  ownerId: runId,
  relPath: `.goodboy/attachments/${name}.png`,
  kind: 'image',
  fileName: `${name}.png`,
  mimeType: 'image/png',
  createdAt: AT,
});

const mount = ({ hintIds }: MountParams) => {
  const run = aWorkflowRun({
    orchestratorHints: [
      {
        id: 'h-queued',
        text: 'Check the webhook',
        createdAt: AT,
        attachmentIds: hintIds.slice(0, 1),
      },
      {
        id: 'h-read',
        text: 'Cap the retries',
        createdAt: AT,
        consumedAt: AT,
        consumedAtStep: 2,
        attachmentIds: hintIds.slice(1),
      },
    ],
  });
  const session = { ...aSession(), workflowRuns: [run] };
  const attachments = [
    imageOf({ runId: run.id, name: 'goal-board' }),
    imageOf({ runId: run.id, name: 'queued-shot' }),
    imageOf({ runId: run.id, name: 'read-shot' }),
  ];
  listGoalAttachmentsForRun.mockResolvedValue(attachments);
  useAppStore.setState({
    sessions: [session],
    currentSessionId: session.id,
    sessionWorktrees: { [session.id]: ['/worktrees/payments-api'] },
    workflowRunAttachments: { [run.id]: attachments },
  });
  render(<GoalAttachmentsStrip owner={{ type: 'workflow_run', id: run.id }} />);
};

describe('the goal attachments of a run', () => {
  it('keeps the goal image and leaves out queued and read hint images', async () => {
    mount({ hintIds: ['att-queued-shot', 'att-read-shot'] });

    await screen.findByRole('button', { name: 'Preview goal-board.png' });
    expect(screen.queryByRole('button', { name: 'Preview queued-shot.png' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Preview read-shot.png' })).toBeNull();
  });

  it('shows every image again for a run with no hints', async () => {
    mount({ hintIds: [] });

    await screen.findByRole('button', { name: 'Preview goal-board.png' });
    screen.getByRole('button', { name: 'Preview queued-shot.png' });
    screen.getByRole('button', { name: 'Preview read-shot.png' });
  });
});
