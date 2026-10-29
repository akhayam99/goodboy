// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Agent, AgentId, OpenQuestion, WorkflowRunId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { OpenQuestionDeliveryError } from '../../../../../store/slices/open-questions/openQuestionDeliveryError';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryAgent,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { C09_SESSION_ID, C09_TESTER_ID } from '../u25/c09OrchestratedSeed';
import { U28_RUN_PAGE_SCENES } from './run-page';

const SETTLE_MS = 2_000;
const PRESET_RUN_ID = brandId<WorkflowRunId>({ value: 'mock-c09-run-preset' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 }, turn_quiet: [] });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const mount = async (): Promise<void> => {
  const Scene = U28_RUN_PAGE_SCENES['u28-run-needs-answers'];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const type = (placeholder: string, value: string): void => {
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
};

const delegateOf = ({ question }: { readonly question: OpenQuestion }): Agent =>
  buildStoryAgent({
    id: brandId<AgentId>({ value: `mock-delegate-${question.id}` }),
    sessionId: C09_SESSION_ID,
    name: 'answer: delegated',
    status: 'running',
    sourceKind: 'open_question',
    sourceThreadId: question.id,
  });

const delegateSecondQuestion = (): void => {
  act(() => {
    const questions = useAppStore.getState().sessionOpenQuestions[C09_SESSION_ID] ?? [];
    const second = questions[1];
    if (second === undefined) {
      throw new Error('no second question');
    }
    useAppStore.setState((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [C09_SESSION_ID]: [
          ...(state.sessionPhaseRuns[C09_SESSION_ID] ?? []),
          delegateOf({ question: second }),
        ],
      },
    }));
  });
};

const switchToPresetRun = (): void => {
  act(() => {
    useAppStore.setState((state) => ({
      focusedWorkflowRunId: { ...state.focusedWorkflowRunId, [C09_SESSION_ID]: PRESET_RUN_ID },
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [C09_SESSION_ID]: (state.sessionPhaseRuns[C09_SESSION_ID] ?? []).map((agent) =>
          agent.workflowRunId === PRESET_RUN_ID
            ? { ...agent, status: 'blocked' as const, completedAt: undefined }
            : agent,
        ),
      },
      sessionOpenQuestions: {
        ...state.sessionOpenQuestions,
        [C09_SESSION_ID]: (state.sessionOpenQuestions[C09_SESSION_ID] ?? []).map((question) => ({
          ...question,
          workflowRunId: PRESET_RUN_ID,
          createdByAgentId: undefined,
        })),
      },
    }));
  });
};

type BatchParams = {
  readonly askingAgentId: AgentId | null;
};

const expectDelegatedBatch = async ({ askingAgentId }: BatchParams): Promise<void> => {
  const answerOpenQuestions = vi.fn(async () => undefined);
  act(() => {
    useAppStore.setState({ answerOpenQuestions });
  });
  const form = screen.getByRole('form', { name: 'Answer the questions' });
  const send = within(form).getByRole('button', { name: 'Send answers' });
  expect(form.querySelectorAll('[data-run-question-waiting]')).toHaveLength(1);
  expect(screen.queryByPlaceholderText('Answer question 3 of 3')).toBeNull();
  expect(form.querySelector('[data-run-question-waiting]')?.textContent).toBe(
    'An agent is answering this',
  );

  type('Answer question 1 of 2', '12,000 rows.');
  expect(send.hasAttribute('disabled')).toBe(true);
  type('Answer question 2 of 2', 'Yes.');
  expect(send.hasAttribute('disabled')).toBe(false);

  await act(async () => {
    fireEvent.click(send);
  });

  expect(answerOpenQuestions).toHaveBeenCalledTimes(1);
  expect(answerOpenQuestions).toHaveBeenCalledWith(
    C09_SESSION_ID,
    [
      expect.objectContaining({ id: 'mock-c09-question', answer: '12,000 rows.' }),
      expect.objectContaining({ id: 'mock-c09-question-3', answer: 'Yes.' }),
    ],
    askingAgentId,
  );
};

describe('a batch with a delegated question', () => {
  it('orchestrated tail asks only the answerable questions and shows the delegated one as waiting', async () => {
    await mount();
    delegateSecondQuestion();
    await settle();

    await expectDelegatedBatch({ askingAgentId: C09_TESTER_ID });
  });

  it('preset tail asks only the answerable questions and shows the delegated one as waiting', async () => {
    await mount();
    switchToPresetRun();
    delegateSecondQuestion();
    await settle();

    expect(document.querySelector('[data-run-tail]')).not.toBeNull();
    await expectDelegatedBatch({ askingAgentId: null });
  });

  it('leaves a delivery failure to the pending notice instead of a second alert in the form', async () => {
    await mount();
    const answerOpenQuestions = vi.fn(async () => {
      throw new OpenQuestionDeliveryError('The agent is not reachable.');
    });
    act(() => {
      useAppStore.setState({ answerOpenQuestions });
    });
    type('Answer question 1 of 3', 'One.');
    type('Answer question 2 of 3', 'Two.');
    type('Answer question 3 of 3', 'Three.');
    const form = screen.getByRole('form', { name: 'Answer the questions' });

    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Send answers' }));
    });

    expect(within(form).queryByRole('alert')).toBeNull();
    expect(within(form).queryByRole('button', { name: 'Retry' })).toBeNull();
    const field = screen.getByPlaceholderText('Answer question 1 of 3');
    expect(field instanceof HTMLTextAreaElement ? field.value : null).toBe('');
  });

  it('shows every question as waiting with no send button when all are delegated', async () => {
    await mount();
    act(() => {
      const questions = useAppStore.getState().sessionOpenQuestions[C09_SESSION_ID] ?? [];
      useAppStore.setState((state) => ({
        sessionPhaseRuns: {
          ...state.sessionPhaseRuns,
          [C09_SESSION_ID]: [
            ...(state.sessionPhaseRuns[C09_SESSION_ID] ?? []),
            ...questions.map((question) => delegateOf({ question })),
          ],
        },
      }));
    });
    await settle();

    const form = screen.getByRole('form', { name: 'Answer the questions' });
    expect(form.querySelectorAll('[data-run-question-waiting]')).toHaveLength(3);
    expect(within(form).queryByRole('button', { name: 'Send answers' })).toBeNull();
    expect(within(form).queryByRole('button', { name: 'Send answer' })).toBeNull();
  });
});
