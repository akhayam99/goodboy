// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  Session,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    state: {} as Record<string, unknown>,
    open: [] as ReadonlyArray<unknown>,
    answered: [] as ReadonlyArray<unknown>,
  },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../../../../../store', async () => ({
  ...(await import('../../../../../store/slices/navigation/place')),
  EMPTY_ARRAY: [] as never[],
  useAppStore: (selector: (s: unknown) => unknown) => selector(store.state),
  useSessionOpenQuestions: () => store.open,
  useSessionAnsweredQuestions: () => store.answered,
}));

vi.mock('@goodboy/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/ui')>()),
  PaneShell: (props: { title: string; meta?: string; children: ReactNode }) => (
    <div data-testid="pane-shell" data-title={props.title} data-meta={props.meta}>
      {props.children}
    </div>
  ),
}));

import { useOpenQuestions } from '../../../../context/components/QuestionsTab/useOpenQuestions';
import { QuestionsPane } from './QuestionsPane';

const NOW = '2026-09-28T10:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'sess_1' as SessionId;
const SESSION = {
  id: SESSION_ID,
  workspaceId: 'ws_1' as WorkspaceId,
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
} as unknown as Session;

const agent = (id: string, name: string, extra: Partial<Agent> = {}): Agent =>
  ({
    id: id as AgentId,
    sessionId: SESSION_ID,
    ordinal: 0,
    name,
    status: 'running',
    ...extra,
  }) as Agent;

const question = (
  id: string,
  text: string,
  askerId: string,
  extra: Partial<OpenQuestion> = {},
): OpenQuestion =>
  ({
    id: id as OpenQuestionId,
    sessionId: SESSION_ID,
    createdByAgentId: askerId as AgentId,
    text,
    suggestedAnswers: ['Yes', 'No'],
    isBlocking: false,
    userAnswer: null,
    status: 'open',
    createdAt: NOW,
    ...extra,
  }) as OpenQuestion;

const PLANNER = agent('planner', 'Planner');
const REVIEWER = agent('reviewer', 'Reviewer');
const Q1 = question('q1', 'Which queue should retries run on?', 'planner', { isBlocking: true });
const Q2 = question('q2', 'Which events should be retried?', 'planner');
const Q3 = question('q3', 'Keep the old dispatch path?', 'reviewer');

const actions = {
  answerOpenQuestions: vi.fn().mockResolvedValue(undefined),
  dismissOpenQuestion: vi.fn().mockResolvedValue(undefined),
  restoreDismissedOpenQuestion: vi.fn().mockResolvedValue(undefined),
  loadSessionOpenQuestions: vi.fn().mockResolvedValue(undefined),
  loadSessionAnsweredQuestions: vi.fn().mockResolvedValue(undefined),
  spawnQuestionDelegates: vi.fn().mockResolvedValue([]),
  takeQuestionBack: vi.fn(),
  navigate: vi.fn(),
  setAnswerIntent: vi.fn(),
};

const setup = ({
  open = [Q1, Q2, Q3],
  answered = [],
  agents = [PLANNER, REVIEWER],
  loaded = true,
}: {
  readonly open?: ReadonlyArray<OpenQuestion>;
  readonly answered?: ReadonlyArray<OpenQuestion>;
  readonly agents?: ReadonlyArray<Agent>;
  readonly loaded?: boolean;
} = {}) => {
  store.open = open;
  store.answered = answered;
  store.state = {
    ...actions,
    sessions: [SESSION],
    providers: [],
    cliRequirements: [],
    agentKindOverride: {},
    sessionPhaseRuns: { [SESSION_ID]: agents },
    sessionOpenQuestions: loaded ? { [SESSION_ID]: open } : {},
    sessionAnsweredQuestions: loaded ? { [SESSION_ID]: answered } : {},
    sessionQuestionsLoadError: {},
  };
  render(<QuestionsPane session={SESSION} />);
};

const detailHeading = () => screen.getByRole('heading', { level: 2 });
const row = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  useOpenQuestions.setState({
    drafts: {},
    staged: [],
    pendingUndo: null,
    focusedQuestionId: null,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('QuestionsPane', () => {
  it('shows a skeleton until the questions load', () => {
    setup({ loaded: false });
    screen.getByRole('status', { name: 'Loading questions' });
  });

  it('shows the empty state when nothing was ever asked', () => {
    setup({ open: [] });
    screen.getByText('No open questions');
  });

  it('lists what waits on you and opens the first question', () => {
    setup();
    expect(screen.getByTestId('pane-shell').getAttribute('data-meta')).toBe(
      '3 waiting · 1 blocking',
    );
    screen.getByText('Waiting on you');
    row('Which events should be retried?');
    expect(detailHeading().textContent).toBe('Which queue should retries run on?');
  });

  it('opens the question picked in the list', () => {
    setup();
    fireEvent.click(row('Keep the old dispatch path?'));
    expect(detailHeading().textContent).toBe('Keep the old dispatch path?');
  });

  it('moves through the list with j and k', () => {
    setup();
    const card = screen.getByRole('article');
    fireEvent.keyDown(card, { key: 'j' });
    expect(detailHeading().textContent).toBe('Which events should be retried?');
    fireEvent.keyDown(screen.getByRole('article'), { key: 'k' });
    expect(detailHeading().textContent).toBe('Which queue should retries run on?');
  });

  it('stages an answer, moves on, and keeps Undo on the answered row', () => {
    setup();
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(detailHeading().textContent).toBe('Which events should be retried?');
    expect(actions.answerOpenQuestions).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(useOpenQuestions.getState().staged).toEqual([]);
  });

  it('sends the answers of one agent together once its last question is answered', async () => {
    setup();
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    fireEvent.click(screen.getByRole('radio', { name: 'No' }));
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    await waitFor(() =>
      expect(actions.answerOpenQuestions).toHaveBeenCalledWith(
        SESSION_ID,
        [
          { id: 'q1', text: Q1.text, answer: 'Yes' },
          { id: 'q2', text: Q2.text, answer: 'No' },
        ],
        'planner',
      ),
    );
  });

  it('keeps answered questions folded until asked for, then shows what was sent', () => {
    const answered = question('a1', 'Which branch should the fix land on?', 'reviewer', {
      status: 'answered',
      userAnswer: 'main',
      answeredAt: NOW,
    });
    setup({ answered: [answered] });
    expect(
      screen.queryByRole('button', { name: 'Which branch should the fix land on?' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Answered/ }));
    fireEvent.click(row('Which branch should the fix land on?'));
    screen.getByText('Answered · sent to Reviewer');
  });

  it('opens the question another surface asked to focus', () => {
    useOpenQuestions.setState({ focusedQuestionId: Q3.id });
    setup();
    expect(detailHeading().textContent).toBe('Keep the old dispatch path?');
  });

  it('dismisses a question and offers Undo on its row', async () => {
    setup();
    fireEvent.click(row('Keep the old dispatch path?'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss question' }));
    await waitFor(() => expect(actions.dismissOpenQuestion).toHaveBeenCalledWith(SESSION_ID, Q3));
    store.open = [Q1, Q2];
    cleanup();
    render(<QuestionsPane session={SESSION} />);
    screen.getByText('Dismissed');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(actions.restoreDismissedOpenQuestion).toHaveBeenCalledWith(SESSION_ID, Q3),
    );
  });

  it('sets a question an agent is answering apart', () => {
    const delegate = agent('delegate-1', 'answer: Keep the old dispatch path?', {
      sourceKind: 'open_question',
      sourceThreadId: 'q3',
      ordinal: 4,
    } as Partial<Agent>);
    setup({ agents: [PLANNER, REVIEWER, delegate] });
    screen.getByText('With an agent');
    expect(screen.getByTestId('pane-shell').getAttribute('data-meta')).toBe(
      '2 waiting · 1 blocking',
    );
  });
});
