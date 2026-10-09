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
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  QUESTION_OPTIONS,
  SESSION,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { BranchPage } from '../../../branch/components/BranchPage';

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
    </ToastProvider>,
  );
  await settle();
};

const list = (): HTMLElement => screen.getByRole('navigation', { name: 'Comments' });

const comment = (): HTMLElement => screen.getByRole('article', { name: 'Comment' });

describe('Fix run status line', () => {
  it('shows one line for the run with the tally, the model and the run controls', async () => {
    await mount({ threadId: null });

    const status = within(screen.getByTestId('resolve-run-status'));
    expect(status.getByText('Fixing 4 comments')).toBeDefined();
    expect(status.getByRole('button', { name: '3 need you' })).toBeDefined();
    expect(status.getByRole('button', { name: '1 working' })).toBeDefined();
    expect(status.queryByRole('button', { name: /ready to push/ })).toBeNull();
    expect(status.queryByRole('button', { name: /couldn't fix/ })).toBeNull();
    expect(status.getByText('Sonnet 5 · Medium')).toBeDefined();
    expect(status.getByRole('button', { name: 'Open transcript' })).toBeDefined();
    expect(status.getByRole('button', { name: 'Stop' })).toBeDefined();
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

  it('filters the list by a tally chip and clears the filter on a second click', async () => {
    await mount({ threadId: null });
    const status = within(screen.getByTestId('resolve-run-status'));

    fireEvent.click(status.getByRole('button', { name: '3 need you' }));
    expect(within(list()).getByRole('region', { name: 'Needs you' })).toBeDefined();
    expect(within(list()).queryByRole('region', { name: 'Ready to push' })).toBeNull();
    expect(within(list()).queryByRole('region', { name: 'Working' })).toBeNull();

    fireEvent.click(status.getByRole('button', { name: '3 need you' }));
    expect(within(list()).getByRole('region', { name: 'Ready to push' })).toBeDefined();
  });

  it('stops the run from the status line', async () => {
    const forceCloseResolver = vi.fn<StoreState['forceCloseResolver']>(async () => undefined);
    stub({ forceCloseResolver });
    await mount({ threadId: null });

    fireEvent.click(
      within(screen.getByTestId('resolve-run-status')).getByRole('button', { name: 'Stop' }),
    );
    const confirm = await screen.findByRole('dialog', { name: 'Stop this fix run?' });
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
    expect(within(comment()).queryByRole('button', { name: 'Answer' })).toBeNull();
  });

  it('continues the same fix run with the picked option', async () => {
    const answerQuestions = vi.fn<StoreState['answerQuestions']>(async () => undefined);
    stub({ answerQuestions });
    await mount({ threadId: ERROR_SHAPE_THREAD_ID });

    const card = within(screen.getByTestId('resolver-question'));
    fireEvent.click(card.getAllByRole('radio')[1] as HTMLElement);
    fireEvent.click(card.getByRole('button', { name: 'Continue the fix run' }));

    await waitFor(() => expect(answerQuestions).toHaveBeenCalledOnce());
    expect(answerQuestions.mock.calls[0]?.[0]).toEqual({
      sessionId: SESSION.id,
      launchId: LAUNCH_ID,
      answers: [{ threadId: ERROR_SHAPE_THREAD_ID, answer: QUESTION_OPTIONS[1] }],
    });
  });

  it('sends what the reviewer typed instead of an option', async () => {
    const answerQuestions = vi.fn<StoreState['answerQuestions']>(async () => undefined);
    stub({ answerQuestions });
    await mount({ threadId: ERROR_SHAPE_THREAD_ID });

    const card = within(screen.getByTestId('resolver-question'));
    fireEvent.change(card.getByRole('textbox', { name: 'Or tell it something else' }), {
      target: { value: 'Fail hard but log the delivery id' },
    });
    fireEvent.click(card.getByRole('button', { name: 'Continue the fix run' }));

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
