// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, OpenQuestion, Session, SessionId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    answerOpenQuestions: vi.fn(async () => undefined),
    dismissOpenQuestion: vi.fn(async () => undefined),
    loadSessionOpenQuestions: vi.fn(async () => undefined),
    selectAgent: vi.fn(async () => undefined),
    openQuestions: [] as ReadonlyArray<OpenQuestion>,
    sessionPhaseRuns: {
      'session-1': [{ id: 'agent-1', name: 'TEST', status: 'running' }],
    } as Record<string, ReadonlyArray<unknown>>,
    sessionWorkflows: {} as Record<string, ReadonlyArray<unknown>>,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessionOpenQuestions: () => state.openQuestions,
}));

import { AgentBriefQuestions } from './AgentBriefQuestions';
import { useOpenQuestions } from '../../../context/components/QuestionsTab/useOpenQuestions';

const sessionId = 'session-1' as SessionId;
const agentId = 'agent-1' as AgentId;
const session = { id: sessionId } as unknown as Session;
const agent = { id: agentId, sessionId, ordinal: 0, name: 'TEST' } as unknown as Agent;

const makeQuestion = (overrides: Partial<Record<keyof OpenQuestion, unknown>>): OpenQuestion =>
  ({
    id: 'oq-1',
    sessionId,
    text: 'Il refactor del core è già su main?',
    suggestedAnswers: ['sì, è su main', 'no, è su un altro branch'],
    userAnswer: null,
    status: 'open',
    createdByAgentId: agentId,
    createdAt: '2026-08-18T09:00:00.000Z',
    ...overrides,
  }) as unknown as OpenQuestion;

beforeEach(() => {
  state.answerOpenQuestions.mockClear();
  state.loadSessionOpenQuestions.mockClear();
  state.openQuestions = [];
  useOpenQuestions.setState({ drafts: {}, justAnswered: [], pendingUndo: null });
});
afterEach(cleanup);

describe('AgentBriefQuestions', () => {
  it('puts an unanswered question raised by this agent in the brief', () => {
    state.openQuestions = [makeQuestion({})];

    render(<AgentBriefQuestions session={session} agent={agent} />);

    expect(screen.getByText('Open question')).toBeDefined();
    expect(screen.getByText('Il refactor del core è già su main?')).toBeDefined();
    expect(screen.getByRole('radio', { name: 'no, è su un altro branch' })).toBeDefined();
  });

  it('loads the session questions so the brief does not depend on the transcript', () => {
    render(<AgentBriefQuestions session={session} agent={agent} />);

    expect(state.loadSessionOpenQuestions).toHaveBeenCalledWith(sessionId);
  });

  it('drops the question from the brief once it is answered', () => {
    state.openQuestions = [makeQuestion({ status: 'answered', userAnswer: 'sì, è su main' })];

    const { container } = render(<AgentBriefQuestions session={session} agent={agent} />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Il refactor del core è già su main?')).toBeNull();
  });

  it('shows nothing at all when this agent raised no question', () => {
    state.openQuestions = [makeQuestion({ createdByAgentId: 'agent-2' })];

    const { container } = render(<AgentBriefQuestions session={session} agent={agent} />);

    expect(container.firstChild).toBeNull();
  });

  it('claims a workflow step question that carries the step instead of the agent', () => {
    const stepAgent = {
      ...agent,
      ordinal: 3,
      workflowRunId: 'run-1',
    } as unknown as Agent;
    state.openQuestions = [
      makeQuestion({ createdByAgentId: null, workflowRunId: 'run-1', createdByStepOrdinal: 3 }),
    ];

    render(<AgentBriefQuestions session={session} agent={stepAgent} />);

    expect(screen.getByText('Il refactor del core è già su main?')).toBeDefined();
  });

  it('answers through the same store action the transcript uses', () => {
    state.openQuestions = [makeQuestion({})];

    render(<AgentBriefQuestions session={session} agent={agent} />);
    fireEvent.click(screen.getByRole('radio', { name: 'no, è su un altro branch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(state.answerOpenQuestions).toHaveBeenCalledTimes(1);
    expect(state.answerOpenQuestions).toHaveBeenCalledWith(
      sessionId,
      [
        {
          id: 'oq-1',
          text: 'Il refactor del core è già su main?',
          answer: 'no, è su un altro branch',
        },
      ],
      agentId,
    );
  });

  it('leaves out the asking-agent header, since the brief already names the agent', () => {
    state.openQuestions = [makeQuestion({})];

    render(<AgentBriefQuestions session={session} agent={agent} />);

    expect(screen.queryByTitle('Open TEST')).toBeNull();
  });

  it('titles the section for a single question and for several', () => {
    state.openQuestions = [makeQuestion({}), makeQuestion({ id: 'oq-2', text: 'And this one?' })];

    render(<AgentBriefQuestions session={session} agent={agent} />);

    expect(screen.getByText('Open questions')).toBeDefined();
  });
});
