// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const selectAgent = vi.fn().mockResolvedValue(undefined);
const requestOpenQuestionScroll = vi.fn();

let openQuestions: ReadonlyArray<unknown> = [];
let storeState: Record<string, unknown> = {};

vi.mock('../../../../store', () => ({
  useSessionOpenQuestions: () => openQuestions,
  useAppStore: (selector: (s: unknown) => unknown) => selector(storeState),
}));

import { OpenQuestionsStrip } from './index';

const SESSION_ID = 'sess-1';
const WS_ID = 'ws-1';

const baseState = (overrides: Record<string, unknown> = {}) => ({
  sessionPhaseRuns: { [SESSION_ID]: [{ id: 'a1', name: 'Implementer', stepId: 'step1' }] },
  sessions: [{ id: SESSION_ID, workspaceId: WS_ID }],
  phaseTemplates: { [WS_ID]: [{ id: 'wf1', steps: [{ id: 'step1', ordinal: 0 }] }] },
  selectedAgentId: { [SESSION_ID]: 'cur-agent' },
  selectAgent,
  requestOpenQuestionScroll,
  ...overrides,
});

const ownedQuestion = (over: Record<string, unknown> = {}) => ({
  id: 'q1',
  sessionId: SESSION_ID,
  status: 'open',
  text: 'which approach?',
  suggestedAnswers: [],
  userAnswer: null,
  workflowId: 'wf1',
  ownedByStepOrdinal: 0,
  turnOrdinal: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

beforeEach(() => {
  selectAgent.mockClear();
  requestOpenQuestionScroll.mockClear();
  openQuestions = [];
  storeState = baseState();
});

afterEach(cleanup);

describe('OpenQuestionsStrip', () => {
  it('hides when there are no open questions', () => {
    openQuestions = [];
    const { container } = render(<OpenQuestionsStrip sessionId={SESSION_ID as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one button per agent with open questions, excluding answered', () => {
    openQuestions = [
      ownedQuestion(),
      ownedQuestion({ id: 'q2', status: 'answered', turnOrdinal: 1 }),
    ];
    render(<OpenQuestionsStrip sessionId={SESSION_ID as never} />);
    expect(screen.getByText('Implementer')).toBeDefined();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('click fires selectAgent then requestOpenQuestionScroll for the owner agent', async () => {
    const user = userEvent.setup();
    openQuestions = [ownedQuestion()];
    render(<OpenQuestionsStrip sessionId={SESSION_ID as never} />);
    await user.click(screen.getByRole('button'));
    expect(selectAgent).toHaveBeenCalledWith(SESSION_ID, 'a1');
    expect(requestOpenQuestionScroll).toHaveBeenCalledWith({ agentId: 'a1', questionId: 'q1' });
  });

  it('keeps null-turnOrdinal questions in the strip and scrolls to the first one', async () => {
    const user = userEvent.setup();
    openQuestions = [ownedQuestion({ id: 'qn', turnOrdinal: undefined })];
    render(<OpenQuestionsStrip sessionId={SESSION_ID as never} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDefined();
    await user.click(btn);
    expect(requestOpenQuestionScroll).toHaveBeenCalledWith({ agentId: 'a1', questionId: 'qn' });
  });

  it('clusters ad-hoc questions by creator agent and jumps to it', async () => {
    const user = userEvent.setup();
    storeState = baseState({
      sessionPhaseRuns: {
        [SESSION_ID]: [{ id: 'scout', name: 'Scout' }],
      },
    });
    openQuestions = [
      ownedQuestion({
        id: 'qc',
        workflowId: undefined,
        ownedByStepOrdinal: undefined,
        createdByAgentId: 'scout',
      }),
    ];
    render(<OpenQuestionsStrip sessionId={SESSION_ID as never} />);
    expect(screen.getByText('Scout')).toBeDefined();
    await user.click(screen.getByRole('button'));
    expect(selectAgent).toHaveBeenCalledWith(SESSION_ID, 'scout');
    expect(requestOpenQuestionScroll).toHaveBeenCalledWith({ agentId: 'scout', questionId: 'qc' });
  });

  it('orphan cluster jumps to the current agent', async () => {
    const user = userEvent.setup();
    openQuestions = [ownedQuestion({ workflowId: undefined, ownedByStepOrdinal: undefined })];
    render(<OpenQuestionsStrip sessionId={SESSION_ID as never} />);
    await user.click(screen.getByRole('button'));
    expect(selectAgent).toHaveBeenCalledWith(SESSION_ID, 'cur-agent');
    expect(requestOpenQuestionScroll).toHaveBeenCalledWith({
      agentId: 'cur-agent',
      questionId: 'q1',
    });
  });
});
