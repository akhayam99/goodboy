// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { ProviderRunId } from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';
import { brandedId } from '../../../history/testing/brandedId';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  QUESTION_OPTIONS,
  SESSION,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { BranchPage } from '../../../branch/components/BranchPage';
import { DrawerHost } from '../../../../app/components/DrawerHost';

type StoreState = ReturnType<StoryStore['getState']>;

const ERROR_SHAPE_THREAD_ID = 'PRRT_thread_error_shape';
const WORKING_THREAD_ID = 'PRRT_thread_idempotency';
const READY_THREAD_ID = 'PRRT_thread_retry_backoff';
const LAUNCH_ID = 'mock-resolve-launch-318';

let useAppStore: StoryStore;
let restore: Partial<StoreState> = {};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  useAppStore.setState(restore);
  restore = {};
});

const stub = (actions: Partial<StoreState>): void => {
  const state = useAppStore.getState();
  restore = {
    ...Object.fromEntries(Object.keys(actions).map((key) => [key, state[key as keyof StoreState]])),
    ...restore,
  };
  useAppStore.setState(actions);
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mount = async ({ threadId }: { readonly threadId: string | null }): Promise<void> => {
  seedResolveScene({ expandedThreadId: threadId });
  render(
    <ToastProvider>
      <BranchPage session={SESSION} workingDir={null} />
      <DrawerHost />
    </ToastProvider>,
  );
  await settle();
};

const list = (): HTMLElement => screen.getByRole('navigation', { name: 'Comments' });

const comment = (): HTMLElement => screen.getByRole('article', { name: 'Comment' });

const counter = (): HTMLElement => {
  const count = document.querySelector<HTMLElement>('[data-fix-run-count]');
  if (count === null) {
    throw new Error('no fix run count');
  }
  return count;
};

describe('Fix run count', () => {
  it('counts the run quietly in the toolbar, opens the transcript from the line and keeps one stop button', async () => {
    const openDrawer = vi.fn<StoreState['openDrawer']>();
    stub({ openDrawer });
    await mount({ threadId: null });

    const count = within(counter());
    expect(count.getByRole('status').textContent).toMatch(/^Fixing·4 of 4/);
    expect(count.queryByRole('button', { name: /need you|working|ready to push/ })).toBeNull();
    expect(count.queryByText('Sonnet 5 · Medium')).toBeNull();
    expect(screen.queryByTestId('resolve-run-status')).toBeNull();
    expect(count.queryByRole('button', { name: 'Fix actions' })).toBeNull();
    expect(count.getByRole('button', { name: 'Stop fixing 4 comments' })).toBeDefined();
    fireEvent.click(count.getByRole('button', { name: /^Open transcript, / }));
    expect(openDrawer).toHaveBeenCalledWith({
      kind: 'transcript',
      sessionId: SESSION.id,
      payload: { agentId: 'mock-resolve-agent-idempotency' },
    });
  });

  it('runs every comment of the launch on the model the status line names', async () => {
    await mount({ threadId: null });

    const models = new Set(
      (useAppStore.getState().sessionResolveAttempts[SESSION.id] ?? [])
        .filter((attempt) => attempt.launchId === LAUNCH_ID)
        .map((attempt) => `${attempt.provider}/${attempt.model}/${attempt.effort}`),
    );

    expect(models.size).toBe(1);
  });

  it('stops the run from the counter, behind a confirm that names the comments', async () => {
    const forceCloseResolver = vi.fn<StoreState['forceCloseResolver']>(async () => undefined);
    stub({ forceCloseResolver });
    await mount({ threadId: null });

    fireEvent.click(within(counter()).getByRole('button', { name: 'Stop fixing 4 comments' }));
    expect(await screen.findByText('Stop the fix for 4 comments?')).toBeDefined();
    expect(forceCloseResolver).not.toHaveBeenCalled();
    const confirms = screen.getAllByRole('button', { name: 'Stop fixing 4 comments' });
    const confirm = confirms.at(-1);
    if (confirm === undefined) {
      throw new Error('no confirm button');
    }
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(forceCloseResolver).toHaveBeenCalledWith(SESSION.id, 'mock-resolve-agent-idempotency'),
    );
  });

  it('stops a comment in work from its own row, behind a confirm that names the batch', async () => {
    const forceCloseResolver = vi.fn<StoreState['forceCloseResolver']>(async () => undefined);
    stub({ forceCloseResolver });
    await mount({ threadId: null });

    const item = list().querySelector(`[data-thread-id="${WORKING_THREAD_ID}"]`)?.closest('li');
    const work = item?.querySelector<HTMLElement>('[data-row-work]') ?? null;
    expect(work).not.toBeNull();
    fireEvent.click(within(work ?? list()).getByRole('button', { name: 'Stop' }));
    const confirm = await screen.findByRole('dialog', { name: 'Stop the fix for 4 comments?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Stop' }));

    expect(forceCloseResolver).toHaveBeenCalledWith(SESSION.id, 'mock-resolve-agent-idempotency');
  });
});

describe('Question from the fix run', () => {
  it('asks in the thread with the recommended option picked and no separate Answer verb', async () => {
    await mount({ threadId: ERROR_SHAPE_THREAD_ID });

    const card = within(screen.getByTestId('resolver-question'));
    expect(card.getByRole('heading', { name: 'Question from the fix run' })).toBeDefined();
    expect(card.getByText('Recommended')).toBeDefined();
    const options = card.getAllByRole('radio');
    expect(options).toHaveLength(QUESTION_OPTIONS.length);
    expect(options[0]?.getAttribute('aria-checked')).toBe('true');
    expect(card.getByRole('textbox', { name: 'Or tell it something else' })).toBeDefined();
    const answers = screen.getAllByRole('button', { name: 'Answer' });
    expect(answers.filter((button) => !button.hasAttribute('data-branch-primary'))).toHaveLength(1);
    expect(card.getAllByRole('button', { name: 'Answer' })).toHaveLength(1);
  });

  it('continues the same fix run with the picked option', async () => {
    const answerQuestions = vi.fn<StoreState['answerQuestions']>(async () => undefined);
    stub({ answerQuestions });
    await mount({ threadId: ERROR_SHAPE_THREAD_ID });

    const card = within(screen.getByTestId('resolver-question'));
    fireEvent.click(card.getAllByRole('radio')[1] as HTMLElement);
    fireEvent.click(card.getByRole('button', { name: 'Answer' }));

    await waitFor(() => expect(answerQuestions).toHaveBeenCalledOnce());
    expect(answerQuestions.mock.calls[0]?.[0]).toEqual({
      sessionId: SESSION.id,
      launchId: LAUNCH_ID,
      answers: [{ threadId: ERROR_SHAPE_THREAD_ID, answer: QUESTION_OPTIONS[1] }],
    });
  });

  it('keeps Continue disabled while the run is still working', async () => {
    const answerQuestions = vi.fn<StoreState['answerQuestions']>(async () => undefined);
    stub({ answerQuestions });
    await mount({ threadId: ERROR_SHAPE_THREAD_ID });
    const attempt = useAppStore
      .getState()
      .sessionResolveAttempts[SESSION.id]?.find((item) =>
        item.threadIds.includes(ERROR_SHAPE_THREAD_ID),
      );
    if (attempt === undefined) {
      throw new Error('no attempt for the question thread');
    }
    const turns = useAppStore.getState().agentTurnState;
    restore = { ...restore, agentTurnState: turns };
    act(() => {
      useAppStore.setState({
        agentTurnState: {
          ...turns,
          [attempt.agentId]: {
            kind: 'running',
            runId: brandedId<ProviderRunId>({ value: 'run-1' }),
            startedAt: TEST_NOW,
          },
        },
      });
    });

    const card = within(screen.getByTestId('resolver-question'));
    const button = card.getByRole('button', { name: 'Answer' });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);
    expect(answerQuestions).not.toHaveBeenCalled();
  });

  it('sends what the reviewer typed instead of an option', async () => {
    const answerQuestions = vi.fn<StoreState['answerQuestions']>(async () => undefined);
    stub({ answerQuestions });
    await mount({ threadId: ERROR_SHAPE_THREAD_ID });

    const card = within(screen.getByTestId('resolver-question'));
    fireEvent.change(card.getByRole('textbox', { name: 'Or tell it something else' }), {
      target: { value: 'Fail hard but log the delivery id' },
    });
    fireEvent.click(card.getByRole('button', { name: 'Answer' }));

    await waitFor(() => expect(answerQuestions).toHaveBeenCalledOnce());
    expect(answerQuestions.mock.calls[0]?.[0].answers).toEqual([
      { threadId: ERROR_SHAPE_THREAD_ID, answer: 'Fail hard but log the delivery id' },
    ]);
  });

  it('says what was answered once the thread is back to work', async () => {
    seedResolveScene({ expandedThreadId: READY_THREAD_ID });
    useAppStore.setState({
      sessionResolveAnswers: { [SESSION.id]: { [READY_THREAD_ID]: 'Fail hard with a 503' } },
    });
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={null} />
        <DrawerHost />
      </ToastProvider>,
    );
    await settle();

    expect(screen.getByTestId('resolver-answered').textContent).toContain(
      'You answered: Fail hard with a 503',
    );
  });
});

describe('Working comment', () => {
  it('shows the elapsed time and the same-run line', async () => {
    await mount({ threadId: WORKING_THREAD_ID });

    const working = within(screen.getByTestId('resolver-working'));
    expect(working.getByText(/^Working on it · /)).toBeDefined();
    expect(working.getByText(/^Same fix run · /)).toBeDefined();
  });
});
