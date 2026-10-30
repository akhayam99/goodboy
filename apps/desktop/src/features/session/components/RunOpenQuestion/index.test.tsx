// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type OpenQuestion,
  type OpenQuestionId,
  type SessionId,
  type WorkflowRunId,
} from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryAgent,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useOpenQuestions } from '../../../context/components/QuestionsTab/useOpenQuestions';
import { RunOpenQuestion } from '.';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-implementer' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'run-ledger-core' });
const AT = brandId<IsoDateTime>({ value: '2026-10-30T09:00:00.000Z' });

type AskParams = Omit<Partial<OpenQuestion>, 'id'> & {
  readonly id: string;
  readonly text: string;
};

const ask = ({ id, text, ...rest }: AskParams): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: id }),
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  createdByAgentId: AGENT_ID,
  text,
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: AT,
  ...rest,
});

const WINDOW_QUESTION = ask({
  id: 'question-window',
  text: 'Should the export skip deliveries older than seven days?',
  suggestedAnswers: ['Skip them', 'Include them', 'Ask me per run'],
  recommendedAnswer: 'Skip them',
  selectMode: 'one',
});

const ACCOUNT_QUESTION = ask({
  id: 'question-account',
  text: 'Which Northwind accounts should the retries cover?',
  suggestedAnswers: ['Payments', 'Refunds', 'Payouts'],
  selectMode: 'many',
  createdAt: brandId<IsoDateTime>({ value: '2026-10-30T09:01:00.000Z' }),
});

const FIXTURE_QUESTION = ask({
  id: 'question-fixtures',
  text: 'Which fixture set should the benchmark read from notify-relay?',
  createdAt: brandId<IsoDateTime>({ value: '2026-10-30T09:02:00.000Z' }),
});

type AnswerFn = ReturnType<StoryStore['getState']>['answerOpenQuestions'];

let useAppStore: StoryStore;
let answerOpenQuestions: Mock<AnswerFn>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 }, turn_quiet: [] });
  useOpenQuestions.setState({ drafts: {}, staged: [], pendingUndo: null });
  answerOpenQuestions = vi.fn<AnswerFn>(async () => undefined);
});

afterEach(cleanup);

type MountParams = {
  readonly questions: ReadonlyArray<OpenQuestion>;
};

const mount = async ({ questions }: MountParams): Promise<void> => {
  act(() => {
    useAppStore.setState({
      sessionPhaseRuns: {
        [SESSION_ID]: [
          buildStoryAgent({
            id: AGENT_ID,
            sessionId: SESSION_ID,
            name: 'Implementer',
            status: 'blocked',
          }),
        ],
      },
      sessionOpenQuestions: { [SESSION_ID]: questions },
      answerOpenQuestions,
    });
  });
  render(
    <ToastProvider>
      <RunOpenQuestion sessionId={SESSION_ID} questions={questions} />
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
};

const answerButton = () => screen.getByRole('button', { name: 'Answer' });

describe('the run page question', () => {
  it('shows the same card as the transcript: suggestions, the recommended one and one pick', async () => {
    await mount({ questions: [WINDOW_QUESTION] });

    screen.getByRole('heading', { name: WINDOW_QUESTION.text });
    screen.getByRole('radiogroup', { name: 'Pick one answer' });
    const options = screen.getAllByRole('radio').map((option) => option.getAttribute('aria-label'));
    expect(options).toEqual(
      expect.arrayContaining(['Skip them', 'Include them', 'Ask me per run']),
    );
    expect(screen.getAllByText('Recommended')).toHaveLength(1);
    expect(screen.queryByPlaceholderText('Answer the question')).toBeNull();
  });

  it('shows a many-select question as checkboxes and sends the picks joined', async () => {
    await mount({ questions: [ACCOUNT_QUESTION] });

    screen.getByRole('group', { name: 'Pick one or more answers' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Payments' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Payouts' }));
    await act(async () => {
      fireEvent.click(answerButton());
    });

    expect(answerOpenQuestions).toHaveBeenCalledExactlyOnceWith(
      SESSION_ID,
      [
        {
          id: ACCOUNT_QUESTION.id,
          text: ACCOUNT_QUESTION.text,
          answer: 'Payments, Payouts',
        },
      ],
      AGENT_ID,
    );
  });

  it('takes a free text answer when the agent gave no suggestions', async () => {
    await mount({ questions: [FIXTURE_QUESTION] });

    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), {
      target: { value: 'The Harborline set.' },
    });
    await act(async () => {
      fireEvent.click(answerButton());
    });

    expect(answerOpenQuestions).toHaveBeenCalledExactlyOnceWith(
      SESSION_ID,
      [{ id: FIXTURE_QUESTION.id, text: FIXTURE_QUESTION.text, answer: 'The Harborline set.' }],
      AGENT_ID,
    );
  });

  it('holds the send until both distinct questions are answered, then sends them together', async () => {
    await mount({ questions: [WINDOW_QUESTION, ACCOUNT_QUESTION] });
    screen.getByText('1 of 2');

    fireEvent.click(screen.getByRole('radio', { name: 'Skip them' }));
    await act(async () => {
      fireEvent.click(answerButton());
    });

    expect(answerOpenQuestions).not.toHaveBeenCalled();
    screen.getByRole('heading', { name: ACCOUNT_QUESTION.text });
    screen.getByText('2 of 2');
    screen.getByText('1 left');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Refunds' }));
    await act(async () => {
      fireEvent.click(answerButton());
    });

    expect(answerOpenQuestions).toHaveBeenCalledExactlyOnceWith(
      SESSION_ID,
      [
        { id: WINDOW_QUESTION.id, text: WINDOW_QUESTION.text, answer: 'Skip them' },
        { id: ACCOUNT_QUESTION.id, text: ACCOUNT_QUESTION.text, answer: 'Refunds' },
      ],
      AGENT_ID,
    );
  });

  it('says how many are left and jumps to the next unanswered one', async () => {
    await mount({ questions: [WINDOW_QUESTION, ACCOUNT_QUESTION, FIXTURE_QUESTION] });
    expect(screen.queryByText(/ left$/)).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'Skip them' }));
    await act(async () => {
      fireEvent.click(answerButton());
    });
    screen.getByText('2 of 3');
    screen.getByRole('button', { name: '2 left, go to the next unanswered question' });

    fireEvent.click(screen.getByRole('button', { name: 'Previous question' }));
    screen.getByRole('heading', { name: WINDOW_QUESTION.text });
    fireEvent.click(
      screen.getByRole('button', { name: '2 left, go to the next unanswered question' }),
    );

    screen.getByRole('heading', { name: ACCOUNT_QUESTION.text });
    expect(answerOpenQuestions).not.toHaveBeenCalled();
  });
});
