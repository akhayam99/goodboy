// @vitest-environment happy-dom

let _storeState: Record<string, unknown> = {};
let _openQuestions: Array<{ status: string; [k: string]: unknown }> = [];
let _answeredQuestions: Array<{ status: string; [k: string]: unknown }> = [];
let _oqDrafts: Record<string, unknown> = {};
let _oqJustAnswered: string[] = [];

const mockAnswerOpenQuestions = vi.fn().mockResolvedValue(undefined);
const mockDismissOpenQuestion = vi.fn().mockResolvedValue(undefined);
const mockLoadSessionAnsweredQuestions = vi.fn().mockResolvedValue(undefined);
const mockSelectAgent = vi.fn().mockResolvedValue(undefined);
const mockFlashAnswered = vi.fn();
const mockToggleSuggestion = vi.fn();
const mockSetCustomAnswer = vi.fn();
const mockToggleCustomField = vi.fn();
const mockClearJustAnswered = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-shell', () => ({ Command: { create: vi.fn() } }));
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: [] as never[],
  useAppStore: vi.fn((selector: (s: unknown) => unknown) => selector(_storeState)),
  useSessionOpenQuestions: vi.fn(() => _openQuestions),
  useSessionAnsweredQuestions: vi.fn(() => _answeredQuestions),
}));

vi.mock('../../../../context/components/QuestionsTab/useOpenQuestions', () => ({
  useOpenQuestions: vi.fn((selector: (s: unknown) => unknown) =>
    selector({
      drafts: _oqDrafts,
      justAnswered: _oqJustAnswered,
      toggleSuggestion: mockToggleSuggestion,
      setCustomAnswer: mockSetCustomAnswer,
      toggleCustomField: mockToggleCustomField,
      flashAnswered: mockFlashAnswered,
      clearJustAnswered: mockClearJustAnswered,
    }),
  ),
  deriveDraftAnswer: vi.fn(
    (draft: { selectedSuggestions?: string[]; customAnswer?: string } | undefined) => {
      if (!draft) return '';
      const custom = draft.customAnswer?.trim() ?? '';
      if (custom.length > 0) return custom;
      return (draft.selectedSuggestions ?? []).join(', ');
    },
  ),
}));

vi.mock('../../../../context/components/QuestionsTab/QuestionCard', () => ({
  QuestionCard: (props: {
    question: { id: string; text: string };
    onDismiss: (id: string) => void;
  }) => (
    <div data-testid={`question-card-${props.question.id}`}>
      <span>{props.question.text}</span>
      <button onClick={() => props.onDismiss(props.question.id)}>dismiss</button>
    </div>
  ),
}));

vi.mock('./PaneShell', () => ({
  PaneShell: (props: { title: string; description?: string; children: React.ReactNode }) => (
    <div data-testid="pane-shell" data-title={props.title} data-description={props.description}>
      {props.children}
    </div>
  ),
}));

vi.mock('../../SessionOverviewPane/lib', () => ({
  selectOpenQuestions: (qs: Array<{ status: string }>) => qs.filter((q) => q.status === 'open'),
}));

vi.mock('../../../../chat/components/ChatView/OpenQuestionInlineCard', () => ({
  AnsweredCard: (props: { question: { id: string; text: string } }) => (
    <div data-testid={`answered-card-${props.question.id}`}>{props.question.text}</div>
  ),
}));

import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  Session,
  SessionId,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { QuestionsPane } from './QuestionsPane';

const NOW = '2026-05-26T00:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'sess_1' as SessionId;
const WS_ID = 'ws_1' as WorkspaceId;
const WF_A = 'wf_a' as WorkflowId;
const WF_B = 'wf_b' as WorkflowId;

const BASE_SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WS_ID,
  goal: 'test goal',
  branchPrefix: 'test',
  createdAt: NOW,
  state: { kind: 'idle' },
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
} as unknown as Session;

function mkStep(workflowId: WorkflowId, ordinal: number): Step {
  return {
    id: `${workflowId}_s${ordinal}` as StepId,
    workflowId,
    ordinal,
    name: `step ${ordinal}`,
    promptPrefix: '',
  };
}

function mkWorkflow(id: WorkflowId, stepCount: number): Workflow {
  return {
    id,
    workspaceId: WS_ID,
    name: id === WF_A ? 'Workflow A' : 'Workflow B',
    description: '',
    steps: Array.from({ length: stepCount }, (_, i) => mkStep(id, i)),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function mkAgent(
  id: string,
  stepId: StepId | undefined,
  name: string,
  extras?: Partial<Agent>,
): Agent {
  return {
    id: id as AgentId,
    sessionId: SESSION_ID,
    stepId,
    ordinal: 0,
    name,
    status: 'completed',
    ...extras,
  } as Agent;
}

function mkQuestion(id: string, opts: Partial<OpenQuestion> = {}): OpenQuestion {
  return {
    id: id as OpenQuestionId,
    sessionId: SESSION_ID,
    text: `question ${id}`,
    suggestedAnswers: [],
    userAnswer: null,
    status: 'open',
    createdAt: NOW,
    ...opts,
  } as OpenQuestion;
}

function setupStore(overrides: {
  agents?: Agent[];
  workflows?: Workflow[];
  openQuestions?: OpenQuestion[];
  answeredQuestions?: OpenQuestion[];
  drafts?: Record<string, unknown>;
}) {
  const agents = overrides.agents ?? [];
  const workflows = overrides.workflows ?? [];
  const openQuestions = overrides.openQuestions ?? [];
  const answeredQuestions = overrides.answeredQuestions ?? [];

  _openQuestions = openQuestions;
  _answeredQuestions = answeredQuestions;
  _oqDrafts = overrides.drafts ?? {};
  _oqJustAnswered = [];
  _storeState = {
    sessionPhaseRuns: { [SESSION_ID]: agents },
    phaseTemplates: { [WS_ID]: workflows },
    sessionOpenQuestions: { [SESSION_ID]: openQuestions },
    sessionAnsweredQuestions: { [SESSION_ID]: answeredQuestions },
    answerOpenQuestions: mockAnswerOpenQuestions,
    dismissOpenQuestion: mockDismissOpenQuestion,
    loadSessionAnsweredQuestions: mockLoadSessionAnsweredQuestions,
    selectAgent: mockSelectAgent,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  _storeState = {};
  _openQuestions = [];
  _answeredQuestions = [];
  _oqDrafts = {};
  _oqJustAnswered = [];
});

describe('QuestionsPane', () => {
  describe('empty state', () => {
    it('renders empty state when no open questions', () => {
      setupStore({ openQuestions: [] });
      render(<QuestionsPane session={BASE_SESSION} />);
      expect(screen.getByText('No open questions')).toBeDefined();
    });

    it('renders empty state when all questions are answered/dismissed', () => {
      setupStore({
        openQuestions: [
          mkQuestion('q1', { status: 'answered' }),
          mkQuestion('q2', { status: 'dismissed' }),
        ],
      });
      render(<QuestionsPane session={BASE_SESSION} />);
      expect(screen.getByText('No open questions')).toBeDefined();
    });

    it('passes correct PaneShell description in empty state', () => {
      setupStore({ openQuestions: [] });
      render(<QuestionsPane session={BASE_SESSION} />);
      const shell = screen.getByTestId('pane-shell');
      expect(shell.getAttribute('data-title')).toBe('Questions');
      expect(shell.getAttribute('data-description')).toBe(
        'Decisions agents need from you to keep going.',
      );
    });
  });

  describe('cluster rendering', () => {
    it('renders questions grouped by workflow-owner agent with headers', () => {
      const wfA = mkWorkflow(WF_A, 2);
      const planner = mkAgent('agent_planner', wfA.steps[0]!.id, 'planner');
      const implementer = mkAgent('agent_impl', wfA.steps[1]!.id, 'implementer');

      setupStore({
        agents: [planner, implementer],
        workflows: [wfA],
        openQuestions: [
          mkQuestion('q1', { workflowId: WF_A, ownedByStepOrdinal: 0 }),
          mkQuestion('q2', { workflowId: WF_A, ownedByStepOrdinal: 0 }),
          mkQuestion('q3', { workflowId: WF_A, ownedByStepOrdinal: 1 }),
        ],
      });

      render(<QuestionsPane session={BASE_SESSION} />);

      expect(screen.getByText('planner')).toBeDefined();
      expect(screen.getByText('implementer')).toBeDefined();
      expect(screen.getByTestId('question-card-q1')).toBeDefined();
      expect(screen.getByTestId('question-card-q2')).toBeDefined();
      expect(screen.getByTestId('question-card-q3')).toBeDefined();
    });

    it('renders ad-hoc clusters by creator agent when no workflow', () => {
      const scout = mkAgent('agent_scout', undefined, 'scout');
      const fixer = mkAgent('agent_fixer', undefined, 'fixer');

      setupStore({
        agents: [scout, fixer],
        workflows: [],
        openQuestions: [
          mkQuestion('q1', { createdByAgentId: scout.id }),
          mkQuestion('q2', { createdByAgentId: fixer.id }),
        ],
      });

      render(<QuestionsPane session={BASE_SESSION} />);

      expect(screen.getByText('scout')).toBeDefined();
      expect(screen.getByText('fixer')).toBeDefined();
    });

    it('shows "via {creator}" suffix when owner differs from creator', () => {
      const wfA = mkWorkflow(WF_A, 2);
      const scout = mkAgent('agent_scout', wfA.steps[0]!.id, 'scout');
      const planner = mkAgent('agent_planner', wfA.steps[1]!.id, 'planner');

      setupStore({
        agents: [scout, planner],
        workflows: [wfA],
        openQuestions: [
          mkQuestion('q1', {
            workflowId: WF_A,
            ownedByStepOrdinal: 1,
            createdByAgentId: scout.id,
            createdByStepOrdinal: 0,
          }),
        ],
      });

      render(<QuestionsPane session={BASE_SESSION} />);

      expect(screen.getByText('planner')).toBeDefined();
      expect(screen.getByText('via scout')).toBeDefined();
    });

    it('does not show "via" suffix when owner == creator', () => {
      const wfA = mkWorkflow(WF_A, 1);
      const planner = mkAgent('agent_planner', wfA.steps[0]!.id, 'planner');

      setupStore({
        agents: [planner],
        workflows: [wfA],
        openQuestions: [
          mkQuestion('q1', {
            workflowId: WF_A,
            ownedByStepOrdinal: 0,
            createdByAgentId: planner.id,
            createdByStepOrdinal: 0,
          }),
        ],
      });

      render(<QuestionsPane session={BASE_SESSION} />);

      expect(screen.getByText('planner')).toBeDefined();
      expect(screen.queryByText(/^via /)).toBeNull();
    });

    it('no header for orphan questions', () => {
      setupStore({
        agents: [],
        workflows: [],
        openQuestions: [mkQuestion('q1'), mkQuestion('q2')],
      });

      render(<QuestionsPane session={BASE_SESSION} />);

      expect(screen.getByTestId('question-card-q1')).toBeDefined();
      expect(screen.getByTestId('question-card-q2')).toBeDefined();
      expect(screen.queryByText(/^via /)).toBeNull();
    });

    it('orphan cluster sorts last when mixed with owned clusters', () => {
      const wfA = mkWorkflow(WF_A, 1);
      const planner = mkAgent('agent_planner', wfA.steps[0]!.id, 'planner');

      setupStore({
        agents: [planner],
        workflows: [wfA],
        openQuestions: [
          mkQuestion('q_owned', { workflowId: WF_A, ownedByStepOrdinal: 0 }),
          mkQuestion('q_orphan'),
        ],
      });

      render(<QuestionsPane session={BASE_SESSION} />);

      const cards = screen.getAllByTestId(/^question-card-/);
      expect(cards[0]!.getAttribute('data-testid')).toBe('question-card-q_owned');
      expect(cards[1]!.getAttribute('data-testid')).toBe('question-card-q_orphan');
    });

    it('separates clusters across different workflows', () => {
      const wfA = mkWorkflow(WF_A, 1);
      const wfB = mkWorkflow(WF_B, 1);
      const agentA = mkAgent('agent_a', wfA.steps[0]!.id, 'agent A');
      const agentB = mkAgent('agent_b', wfB.steps[0]!.id, 'agent B');

      setupStore({
        agents: [agentA, agentB],
        workflows: [wfA, wfB],
        openQuestions: [
          mkQuestion('q1', { workflowId: WF_A, ownedByStepOrdinal: 0 }),
          mkQuestion('q2', { workflowId: WF_B, ownedByStepOrdinal: 0 }),
        ],
      });

      render(<QuestionsPane session={BASE_SESSION} />);

      expect(screen.getByText('agent A')).toBeDefined();
      expect(screen.getByText('agent B')).toBeDefined();
    });
  });

  describe('pane description', () => {
    it('singular "question" for 1 open question', () => {
      setupStore({ openQuestions: [mkQuestion('q1')] });
      render(<QuestionsPane session={BASE_SESSION} />);
      const shell = screen.getByTestId('pane-shell');
      expect(shell.getAttribute('data-description')).toBe('1 open question waiting on you.');
    });

    it('plural "questions" for multiple open questions', () => {
      setupStore({
        openQuestions: [mkQuestion('q1'), mkQuestion('q2'), mkQuestion('q3')],
      });
      render(<QuestionsPane session={BASE_SESSION} />);
      const shell = screen.getByTestId('pane-shell');
      expect(shell.getAttribute('data-description')).toBe('3 open questions waiting on you.');
    });
  });

  describe('dismiss callback', () => {
    it('calls dismissOpenQuestion with session id and question', () => {
      const question = mkQuestion('q1');
      setupStore({ openQuestions: [question] });
      render(<QuestionsPane session={BASE_SESSION} />);

      fireEvent.click(screen.getByText('dismiss'));
      expect(mockDismissOpenQuestion).toHaveBeenCalledWith(SESSION_ID, question);
    });
  });

  describe('submit callback per cluster', () => {
    it('routes answer to cluster ownerAgentId, not global first question creator', () => {
      const wfA = mkWorkflow(WF_A, 2);
      const planner = mkAgent('agent_planner', wfA.steps[0]!.id, 'planner');
      const implementer = mkAgent('agent_impl', wfA.steps[1]!.id, 'implementer');

      setupStore({
        agents: [planner, implementer],
        workflows: [wfA],
        openQuestions: [
          mkQuestion('q1', {
            workflowId: WF_A,
            ownedByStepOrdinal: 0,
            createdByAgentId: 'some_other_agent' as AgentId,
          }),
          mkQuestion('q2', {
            workflowId: WF_A,
            ownedByStepOrdinal: 1,
          }),
        ],
        drafts: {
          q2: { selectedSuggestions: ['yes'], customAnswer: '', showCustomField: false },
        },
      });

      render(<QuestionsPane session={BASE_SESSION} />);

      const submitButtons = screen.getAllByText('send answer');
      expect(submitButtons.length).toBeGreaterThanOrEqual(1);

      fireEvent.click(submitButtons[submitButtons.length - 1]!);

      expect(mockAnswerOpenQuestions).toHaveBeenCalledWith(
        SESSION_ID,
        [{ id: 'q2', text: 'question q2', answer: 'yes' }],
        implementer.id,
      );
    });

    it('does not render submit button when no drafts pending', () => {
      setupStore({ openQuestions: [mkQuestion('q1')] });
      render(<QuestionsPane session={BASE_SESSION} />);
      expect(screen.queryByText('send answer')).toBeNull();
      expect(screen.queryByText(/send \d+ answers/)).toBeNull();
    });

    it('shows "send N answers" when multiple drafts pending in a cluster', () => {
      const scout = mkAgent('agent_scout', undefined, 'scout');

      setupStore({
        agents: [scout],
        workflows: [],
        openQuestions: [
          mkQuestion('q1', { createdByAgentId: scout.id }),
          mkQuestion('q2', { createdByAgentId: scout.id }),
        ],
        drafts: {
          q1: { selectedSuggestions: ['option a'], customAnswer: '', showCustomField: false },
          q2: { selectedSuggestions: [], customAnswer: 'custom answer', showCustomField: true },
        },
      });

      render(<QuestionsPane session={BASE_SESSION} />);
      expect(screen.getByText('send 2 answers')).toBeDefined();
    });

    it('submit with null ownerAgentId for orphan cluster', () => {
      setupStore({
        openQuestions: [mkQuestion('q1')],
        drafts: {
          q1: { selectedSuggestions: ['ok'], customAnswer: '', showCustomField: false },
        },
      });

      render(<QuestionsPane session={BASE_SESSION} />);
      fireEvent.click(screen.getByText('send answer'));

      expect(mockAnswerOpenQuestions).toHaveBeenCalledWith(
        SESSION_ID,
        [{ id: 'q1', text: 'question q1', answer: 'ok' }],
        null,
      );
    });

    it('calls flashAnswered before answerOpenQuestions', () => {
      setupStore({
        openQuestions: [mkQuestion('q1')],
        drafts: {
          q1: { selectedSuggestions: ['yes'], customAnswer: '', showCustomField: false },
        },
      });

      render(<QuestionsPane session={BASE_SESSION} />);
      fireEvent.click(screen.getByText('send answer'));

      expect(mockFlashAnswered).toHaveBeenCalledWith(['q1']);
      expect(mockAnswerOpenQuestions).toHaveBeenCalled();
    });

    it('does nothing when pairs list is empty (no pending drafts)', () => {
      setupStore({
        openQuestions: [mkQuestion('q1')],
        drafts: {
          q1: { selectedSuggestions: [], customAnswer: '   ', showCustomField: false },
        },
      });

      render(<QuestionsPane session={BASE_SESSION} />);
      expect(screen.queryByText('send answer')).toBeNull();
    });
  });

  describe('workflowRunId scoping', () => {
    it('resolves owner via workflowRunId when present on question and agent', () => {
      const wfA = mkWorkflow(WF_A, 1);
      const runId = 'run_1' as WorkflowRunId;
      const agent1 = mkAgent('agent_1', wfA.steps[0]!.id, 'run1-agent', {
        workflowRunId: runId,
      });

      setupStore({
        agents: [agent1],
        workflows: [wfA],
        openQuestions: [
          mkQuestion('q1', {
            workflowId: WF_A,
            workflowRunId: runId,
            ownedByStepOrdinal: 0,
          }),
        ],
      });

      render(<QuestionsPane session={BASE_SESSION} />);
      expect(screen.getByText('run1-agent')).toBeDefined();
    });
  });

  describe('answered history', () => {
    it('loads answered questions on mount', () => {
      setupStore({ openQuestions: [] });
      render(<QuestionsPane session={BASE_SESSION} />);
      expect(mockLoadSessionAnsweredQuestions).toHaveBeenCalledWith(SESSION_ID);
    });

    it('renders no answered section when answered list is empty', () => {
      setupStore({ openQuestions: [], answeredQuestions: [] });
      render(<QuestionsPane session={BASE_SESSION} />);
      expect(screen.queryByTestId(/^answered-card-/)).toBeNull();
    });

    it('renders answered cards grouped by creator agent', () => {
      const scout = mkAgent('agent_scout', undefined, 'scout');
      setupStore({
        openQuestions: [],
        agents: [scout],
        answeredQuestions: [
          mkQuestion('aq1', {
            status: 'answered',
            createdByAgentId: scout.id,
            answeredAt: '2026-05-26T01:00:00.000Z' as IsoDateTime,
            userAnswer: 'yes',
          }),
          mkQuestion('aq2', {
            status: 'answered',
            createdByAgentId: scout.id,
            answeredAt: '2026-05-26T02:00:00.000Z' as IsoDateTime,
            userAnswer: 'no',
          }),
        ],
      });

      render(<QuestionsPane session={BASE_SESSION} />);
      expect(screen.getByTestId('answered-card-aq1')).toBeDefined();
      expect(screen.getByTestId('answered-card-aq2')).toBeDefined();
      expect(screen.getByText('scout')).toBeDefined();
    });

    it('clusters answered by different agents separately', () => {
      const scout = mkAgent('agent_scout', undefined, 'scout');
      const fixer = mkAgent('agent_fixer', undefined, 'fixer');
      setupStore({
        openQuestions: [],
        agents: [scout, fixer],
        answeredQuestions: [
          mkQuestion('aq1', {
            status: 'answered',
            createdByAgentId: scout.id,
            answeredAt: '2026-05-26T01:00:00.000Z' as IsoDateTime,
            userAnswer: 'yes',
          }),
          mkQuestion('aq2', {
            status: 'answered',
            createdByAgentId: fixer.id,
            answeredAt: '2026-05-26T02:00:00.000Z' as IsoDateTime,
            userAnswer: 'no',
          }),
        ],
      });

      render(<QuestionsPane session={BASE_SESSION} />);
      expect(screen.getByText('scout')).toBeDefined();
      expect(screen.getByText('fixer')).toBeDefined();
      expect(screen.getByTestId('answered-card-aq1')).toBeDefined();
      expect(screen.getByTestId('answered-card-aq2')).toBeDefined();
    });

    it('sorts clusters most-recent-first by newest answeredAt', () => {
      const older = mkAgent('agent_older', undefined, 'older-agent');
      const newer = mkAgent('agent_newer', undefined, 'newer-agent');
      setupStore({
        openQuestions: [],
        agents: [older, newer],
        answeredQuestions: [
          mkQuestion('aq_old', {
            status: 'answered',
            createdByAgentId: older.id,
            answeredAt: '2026-05-26T01:00:00.000Z' as IsoDateTime,
            userAnswer: 'old answer',
          }),
          mkQuestion('aq_new', {
            status: 'answered',
            createdByAgentId: newer.id,
            answeredAt: '2026-05-26T03:00:00.000Z' as IsoDateTime,
            userAnswer: 'new answer',
          }),
        ],
      });

      render(<QuestionsPane session={BASE_SESSION} />);
      const agentLabels = screen.getAllByText(/.*-agent$/);
      expect(agentLabels[0]!.textContent).toBe('newer-agent');
      expect(agentLabels[1]!.textContent).toBe('older-agent');
    });

    it('clicking agent header calls selectAgent', () => {
      const scout = mkAgent('agent_scout', undefined, 'scout');
      setupStore({
        openQuestions: [],
        agents: [scout],
        answeredQuestions: [
          mkQuestion('aq1', {
            status: 'answered',
            createdByAgentId: scout.id,
            answeredAt: '2026-05-26T01:00:00.000Z' as IsoDateTime,
            userAnswer: 'yes',
          }),
        ],
      });

      render(<QuestionsPane session={BASE_SESSION} />);
      fireEvent.click(screen.getByText('scout'));
      expect(mockSelectAgent).toHaveBeenCalledWith(SESSION_ID, scout.id);
    });

    it('renders answered section below open questions when both exist', () => {
      const scout = mkAgent('agent_scout', undefined, 'scout');
      setupStore({
        openQuestions: [mkQuestion('open1', { createdByAgentId: scout.id })],
        agents: [scout],
        answeredQuestions: [
          mkQuestion('aq1', {
            status: 'answered',
            createdByAgentId: scout.id,
            answeredAt: '2026-05-26T01:00:00.000Z' as IsoDateTime,
            userAnswer: 'yes',
          }),
        ],
      });

      render(<QuestionsPane session={BASE_SESSION} />);
      expect(screen.getByTestId('question-card-open1')).toBeDefined();
      expect(screen.getByTestId('answered-card-aq1')).toBeDefined();
      expect(screen.getByText('answered')).toBeDefined();
    });
  });
});
