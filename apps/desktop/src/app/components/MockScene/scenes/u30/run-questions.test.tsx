// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
import { C09_SESSION_ID, C09_TESTER_ID } from '../u25/c09OrchestratedSeed';
import { U30_RUN_QUESTIONS_SCENES } from './run-questions';

const SETTLE_MS = 2_000;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useOpenQuestions.setState({ drafts: {}, staged: [], pendingUndo: null });
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 }, turn_quiet: [] });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const mount = async (): Promise<HTMLElement> => {
  const Scene = U30_RUN_QUESTIONS_SCENES['u30-run-questions'];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  const open = document.querySelector<HTMLElement>('[data-run-open-question]');
  if (open === null) {
    throw new Error('the run page shows no question');
  }
  return open;
};

describe('the u30 run questions scene', () => {
  it('registers the scene for the capture', () => {
    expect(MOCK_SCENES['u30-run-questions']).toBe(U30_RUN_QUESTIONS_SCENES['u30-run-questions']);
  });

  it('frames the main content question for the changelog picture', async () => {
    const Shot = U30_RUN_QUESTIONS_SCENES['u30-run-questions-shot'];
    expect(MOCK_SCENES['u30-run-questions-shot']).toBe(Shot);
    render(
      <ToastProvider>
        <Shot />
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });
    const frame = document.querySelector<HTMLElement>('[data-shot]');
    expect(frame).not.toBeNull();
    expect(frame?.querySelector('[data-run-open-question]')).not.toBeNull();
  });

  it('shows the first question as the designed card, with suggestions and the recommended one', async () => {
    const open = await mount();

    within(open).getByRole('heading', {
      name: 'Should the export skip deliveries older than seven days?',
    });
    within(open).getByRole('radiogroup', { name: 'Pick one answer' });
    expect(
      within(open)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('aria-label')),
    ).toEqual(expect.arrayContaining(['Skip them', 'Include them', 'Ask me on every run']));
    expect(within(open).getAllByText('Recommended')).toHaveLength(1);
    expect(screen.queryByPlaceholderText('Answer the question')).toBeNull();
  });

  it('holds the second, different question for the same batch and sends both together', async () => {
    const open = await mount();
    const answerOpenQuestions = vi.fn(async () => undefined);
    act(() => {
      useAppStore.setState({ answerOpenQuestions });
    });
    within(open).getByText('1 of 2');

    fireEvent.click(within(open).getByRole('radio', { name: 'Skip them' }));
    await act(async () => {
      fireEvent.click(within(open).getByRole('button', { name: 'Answer' }));
    });
    expect(answerOpenQuestions).not.toHaveBeenCalled();
    within(open).getByRole('group', { name: 'Pick one or more answers' });
    within(open).getByText('1 left');

    fireEvent.click(within(open).getByRole('checkbox', { name: 'Payments' }));
    await act(async () => {
      fireEvent.click(within(open).getByRole('button', { name: 'Answer' }));
    });

    expect(answerOpenQuestions).toHaveBeenCalledExactlyOnceWith(
      C09_SESSION_ID,
      [
        expect.objectContaining({ id: 'mock-u30-question-window', answer: 'Skip them' }),
        expect.objectContaining({ id: 'mock-u30-question-accounts', answer: 'Payments' }),
      ],
      C09_TESTER_ID,
    );
  });
});
