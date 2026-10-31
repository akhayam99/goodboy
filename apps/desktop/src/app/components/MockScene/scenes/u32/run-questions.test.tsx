// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { useOpenQuestions } from '../../../../../features/context/components/QuestionsTab/useOpenQuestions';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { BLOCKED_MOUNT_AGENT_ID, BLOCKED_MOUNT_SESSION_ID } from '../u30/blockedMountStepSeed';
import { U32_RUN_QUESTIONS_SCENES } from './run-questions';

const SCENE = 'u32-run-questions';
const SETTLE_MS = 2_000;
const FIRST_QUESTION_ID = 'mock-u32-rq-window';

const pendingInvoke = () => new Promise<never>(() => undefined);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useOpenQuestions.setState({ drafts: {}, staged: [], pendingUndo: null });
  stubStoryInvoke({
    db_select: [],
    db_execute: { rowsAffected: 0 },
    worktree_status: pendingInvoke,
    worktree_remote_url: pendingInvoke,
    worktree_changed_files: pendingInvoke,
    turn_quiet: [],
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

type MountParams = {
  readonly executionMode?: 'static' | 'dynamic';
};

const mount = async ({ executionMode = 'dynamic' }: MountParams = {}): Promise<HTMLElement> => {
  const Scene = U32_RUN_QUESTIONS_SCENES[SCENE];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  if (executionMode === 'static') {
    await act(async () => {
      useAppStore.setState((state) => ({
        sessions: state.sessions.map((session) => ({
          ...session,
          workflowRuns: session.workflowRuns.map((run) => ({ ...run, executionMode })),
        })),
      }));
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });
  }
  const block = document.querySelector<HTMLElement>(
    `[data-run-open-question="${FIRST_QUESTION_ID}"]`,
  );
  if (block === null) {
    throw new Error('the run page shows no open question');
  }
  return block;
};

type ClickParams = {
  readonly node: HTMLElement;
};

const click = async ({ node }: ClickParams): Promise<void> => {
  await act(async () => {
    fireEvent.click(node);
  });
};

describe('the u32 run questions scene', () => {
  it('registers the scene for the capture', () => {
    expect(MOCK_SCENES[SCENE]).toBe(U32_RUN_QUESTIONS_SCENES[SCENE]);
  });

  it('frames the blocked step in a 680px shot with padding on an inner element', async () => {
    await mount();
    const frame = document.querySelector<HTMLElement>('[data-shot]');
    expect(frame?.style.width).toBe('680px');
    expect(frame?.style.padding).toBe('');
  });

  it('shows the first of three questions with a count the pager walks', async () => {
    const block = await mount();

    within(block).getByRole('heading', {
      name: 'Should refunds older than 90 days be batched too?',
    });
    within(block).getByText('1 of 3');
    expect(within(block).queryByPlaceholderText('Answer')).toBeNull();
  });

  it('shows the first of three questions of a preset run with a count the pager walks', async () => {
    const block = await mount({ executionMode: 'static' });

    within(block).getByRole('heading', {
      name: 'Should refunds older than 90 days be batched too?',
    });
    within(block).getByText('1 of 3');
    await click({ node: within(block).getByRole('button', { name: 'Next question' }) });
    within(block).getByRole('heading', { name: 'Which batch size should refunds use?' });
    within(block).getByText('2 of 3');
  });

  it('moves to the next question in place and back', async () => {
    const block = await mount();

    await click({ node: within(block).getByRole('button', { name: 'Next question' }) });
    within(block).getByRole('heading', { name: 'Which batch size should refunds use?' });
    within(block).getByText('2 of 3');

    await click({ node: within(block).getByRole('button', { name: 'Next question' }) });
    within(block).getByRole('heading', {
      name: 'May the refunds CSV gain a column for the batch number?',
    });
    within(block).getByText('3 of 3');

    await click({ node: within(block).getByRole('button', { name: 'Previous question' }) });
    within(block).getByText('2 of 3');
  });

  it('answers one after the other and sends all three together for the asking step', async () => {
    const block = await mount();
    const answerOpenQuestions = vi.fn(async () => undefined);
    act(() => {
      useAppStore.setState({ answerOpenQuestions });
    });

    await click({ node: within(block).getByRole('radio', { name: 'Batch them' }) });
    await click({ node: within(block).getByRole('button', { name: 'Answer' }) });
    within(block).getByRole('heading', { name: 'Which batch size should refunds use?' });
    within(block).getByText('2 left');
    expect(answerOpenQuestions).not.toHaveBeenCalled();

    await click({ node: within(block).getByRole('radio', { name: '500 rows' }) });
    await click({ node: within(block).getByRole('button', { name: 'Answer' }) });
    within(block).getByRole('heading', {
      name: 'May the refunds CSV gain a column for the batch number?',
    });

    await click({ node: within(block).getByRole('radio', { name: 'No' }) });
    await click({ node: within(block).getByRole('button', { name: 'Answer' }) });

    expect(answerOpenQuestions).toHaveBeenCalledExactlyOnceWith(
      BLOCKED_MOUNT_SESSION_ID,
      [
        expect.objectContaining({ id: 'mock-u32-rq-window', answer: 'Batch them' }),
        expect.objectContaining({ id: 'mock-u32-rq-size', answer: '500 rows' }),
        expect.objectContaining({ id: 'mock-u32-rq-csv', answer: 'No' }),
      ],
      BLOCKED_MOUNT_AGENT_ID,
    );
  });

  it('keeps the picked answer and reports the error when the last send fails', async () => {
    const block = await mount();
    const answerOpenQuestions = vi.fn(async () => {
      throw new Error('payments-api is unreachable');
    });
    const reportError = vi.fn(async () => undefined);
    act(() => {
      useAppStore.setState({ answerOpenQuestions, reportError });
    });
    await click({ node: within(block).getByRole('radio', { name: 'Batch them' }) });
    await click({ node: within(block).getByRole('button', { name: 'Answer' }) });
    await click({ node: within(block).getByRole('radio', { name: '500 rows' }) });
    await click({ node: within(block).getByRole('button', { name: 'Answer' }) });
    await click({ node: within(block).getByRole('radio', { name: 'No' }) });
    await click({ node: within(block).getByRole('button', { name: 'Answer' }) });

    expect(answerOpenQuestions).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't send your answers" }),
    );
    within(block).getByRole('heading', {
      name: 'May the refunds CSV gain a column for the batch number?',
    });
    within(block).getByRole('radio', { name: 'No', checked: true });
    within(block).getByRole('button', { name: 'Answer' });
  });

  it('picks an answer on the shown question with the number keys', async () => {
    const block = await mount();
    vi.useRealTimers();
    const user = userEvent.setup();
    await user.click(within(block).getByRole('button', { name: 'Next question' }));
    await user.keyboard('2');

    within(block).getByRole('radio', { name: '500 rows', checked: true });
    within(block).getByRole('radio', { name: '250 rows', checked: false });
  });
});
