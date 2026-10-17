// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import { formatAge } from '../../../../../shared/utils/time/formatAge';
import { QuestionDrawer } from '../../QuestionDrawer';
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
  openDrawer: vi.fn(),
};

type SeedParams = {
  readonly open?: ReadonlyArray<OpenQuestion>;
  readonly answered?: ReadonlyArray<OpenQuestion>;
  readonly agents?: ReadonlyArray<Agent>;
  readonly loaded?: boolean;
  readonly openedId?: OpenQuestionId | null;
};

const seed = ({
  open = [Q1, Q2, Q3],
  answered = [],
  agents = [PLANNER, REVIEWER],
  loaded = true,
  openedId = null,
}: SeedParams = {}) => {
  store.open = open;
  store.answered = answered;
  store.state = {
    ...actions,
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    drawer:
      openedId === null
        ? null
        : { kind: 'question', sessionId: SESSION_ID, payload: { questionId: openedId } },
    providers: [],
    cliRequirements: [],
    agentKindOverride: {},
    sessionPhaseRuns: { [SESSION_ID]: agents },
    sessionOpenQuestions: loaded ? { [SESSION_ID]: open } : {},
    sessionAnsweredQuestions: loaded ? { [SESSION_ID]: answered } : {},
    sessionQuestionsLoadError: {},
  };
};

const setup = (params: SeedParams = {}) => {
  seed(params);
  render(<QuestionsPane session={SESSION} />);
};

type DrawerParams = SeedParams & {
  readonly questionId: OpenQuestionId;
};

const setupDrawer = ({ questionId, ...params }: DrawerParams) => {
  seed(params);
  return render(
    <QuestionDrawer sessionId={SESSION_ID} questionId={questionId} from={null} onClose={vi.fn()} />,
  );
};

const row = (name: string) => screen.getByRole('button', { name });
const group = (name: string) => screen.getByRole('list', { name });
const ANSWERED_A1 = question('a1', 'Which branch should the fix land on?', 'reviewer', {
  status: 'answered',
  userAnswer: 'main',
  answeredAt: NOW,
});
const ANSWERED_A2 = question('a2', 'Squash the commits before merge?', 'planner', {
  status: 'answered',
  userAnswer: 'Yes, one commit',
  answeredAt: NOW,
});

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

  it('shows the shared empty state only when nothing was ever asked', () => {
    setup({ open: [] });
    screen.getByRole('heading', { level: 2, name: 'No questions yet' });
    screen.getByText('Agents ask you here when they need a decision.');
  });

  it('lists Needs you then Answered on one grid, each counted from two', () => {
    setup({ answered: [ANSWERED_A1] });
    const headings = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);
    expect(headings).toEqual(['Needs you', 'Answered']);
    expect(
      Array.from(document.querySelectorAll('[data-list-grid-count]')).map(
        (node) => node.textContent,
      ),
    ).toEqual(['3']);
    expect(document.querySelectorAll('[data-list-grid]')).toHaveLength(1);
    expect(within(group('Needs you')).getAllByRole('button')).toHaveLength(3);
    expect(within(group('Answered')).getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.queryByText('No questions')).toBeNull();
  });

  it('keeps answered rows with no centered empty state beside them', () => {
    setup({ open: [], answered: [ANSWERED_A1, ANSWERED_A2] });
    expect(screen.queryByText('No questions yet')).toBeNull();
    expect(screen.queryByText('No questions')).toBeNull();
    expect(within(group('Answered')).getAllByRole('button')).toHaveLength(2);
    expect(screen.getAllByRole('heading', { level: 2 })[0]?.textContent).toBe('Answered');
    expect(document.querySelector('[data-list-grid-count]')?.textContent).toBe('2');
  });

  it('reads a row as the question, the answer in gray, the asker role and the age', () => {
    setup({ answered: [ANSWERED_A1] });
    const answered = row('Which branch should the fix land on?, You: main');
    const cells = Array.from(answered.querySelectorAll<HTMLElement>('[data-list-grid-cell]'));
    expect(cells.map((cell) => cell.getAttribute('data-list-grid-cell'))).toEqual([
      'state',
      'question',
      'answer',
      'asker',
      'age',
    ]);
    expect(cells.map((cell) => cell.textContent)).toEqual([
      '',
      'Which branch should the fix land on?',
      'You: main',
      'Reviewer',
      formatAge({ from: NOW, now: Date.now() }),
    ]);
  });

  it('marks a blocking ask with one dot in its own cell', () => {
    setup();
    const blocking = row('Which queue should retries run on?');
    const quiet = row('Which events should be retried?');
    expect(within(blocking).getByRole('img', { name: 'Blocking' })).toBeDefined();
    expect(within(quiet).queryByRole('img', { name: 'Blocking' })).toBeNull();
  });

  it('opens the question in the drawer from its row, naming the question', () => {
    setup();
    fireEvent.click(row('Keep the old dispatch path?'));
    expect(actions.openDrawer).toHaveBeenCalledWith({
      kind: 'question',
      sessionId: SESSION_ID,
      payload: { questionId: Q3.id },
    });
  });

  it('marks the row whose question the drawer shows', () => {
    setup({ openedId: Q2.id });
    expect(row('Which events should be retried?').getAttribute('aria-current')).toBe('true');
    expect(row('Keep the old dispatch path?').getAttribute('aria-current')).toBeNull();
  });

  it('opens the question another surface asked to focus in the drawer', () => {
    useOpenQuestions.setState({ focusedQuestionId: Q3.id });
    setup();
    expect(actions.openDrawer).toHaveBeenCalledWith({
      kind: 'question',
      sessionId: SESSION_ID,
      payload: { questionId: Q3.id },
    });
    expect(useOpenQuestions.getState().focusedQuestionId).toBeNull();
  });

  it('keeps a question an agent is answering under Needs you, saying so in gray', () => {
    const delegate = agent('delegate-1', 'answer: Keep the old dispatch path?', {
      sourceKind: 'open_question',
      sourceThreadId: 'q3',
      ordinal: 4,
    } as Partial<Agent>);
    setup({ agents: [PLANNER, REVIEWER, delegate] });
    expect(
      within(group('Needs you')).getByRole('button', {
        name: 'Keep the old dispatch path?, An agent is answering',
      }),
    ).toBeDefined();
    expect(screen.getByTestId('pane-shell').getAttribute('data-meta')).toBeNull();
  });
});

describe('QuestionDrawer', () => {
  it('shows the question card, with the asker in the card and the question as the title', () => {
    setupDrawer({ questionId: Q1.id });
    const card = screen.getByRole('article');
    expect(within(card).getAllByText('Planner').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Which queue should retries run on?').length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it('stages an answer and moves the drawer to the next waiting question', () => {
    setupDrawer({ questionId: Q1.id });
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(useOpenQuestions.getState().staged).toEqual([Q1.id]);
    expect(actions.answerOpenQuestions).not.toHaveBeenCalled();
    expect(actions.openDrawer).toHaveBeenCalledWith({
      kind: 'question',
      sessionId: SESSION_ID,
      payload: { questionId: Q2.id },
    });
  });

  it('keeps Undo on a staged answer when its question is opened again', () => {
    useOpenQuestions.setState({ staged: [Q1.id] });
    setupDrawer({ questionId: Q1.id });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(useOpenQuestions.getState().staged).toEqual([]);
  });

  it('sends the answers of one agent together once its last question is answered', async () => {
    const view = setupDrawer({ questionId: Q1.id });
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    view.unmount();
    setupDrawer({ questionId: Q2.id });
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

  it('shows what was sent on an answered question', () => {
    setupDrawer({ questionId: ANSWERED_A1.id, answered: [ANSWERED_A1] });
    screen.getByText('Answered · sent to Reviewer');
  });

  it('dismisses a question and offers Undo in the drawer', async () => {
    const view = setupDrawer({ questionId: Q3.id });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss question' }));
    await waitFor(() => expect(actions.dismissOpenQuestion).toHaveBeenCalledWith(SESSION_ID, Q3));
    view.unmount();
    setupDrawer({ questionId: Q3.id, open: [Q1, Q2] });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(actions.restoreDismissedOpenQuestion).toHaveBeenCalledWith(SESSION_ID, Q3),
    );
  });

  it('says so when the question is no longer in the session', () => {
    setupDrawer({ questionId: ANSWERED_A2.id });
    screen.getByText('This question is no longer in this session.');
  });
});
