// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Agent, AgentId, OpenQuestion, Session, SessionId } from '@goodboy/types';

const state = vi.hoisted(() => ({
  sessionPhaseRuns: {} as Record<string, ReadonlyArray<Agent>>,
  sessionWorkflows: {} as Record<string, ReadonlyArray<unknown>>,
  agentTurnState: {} as Record<string, unknown>,
  agentKindOverride: {} as Record<string, unknown>,
  sessionPlans: {} as Record<string, ReadonlyArray<unknown>>,
  openQuestions: [] as ReadonlyArray<OpenQuestion>,
  selectAgent: async () => undefined,
  answerOpenQuestions: async () => undefined,
  dismissOpenQuestion: async () => undefined,
  loadSessionOpenQuestions: async () => undefined,
}));

const transcriptItems = vi.hoisted(() => ({
  items: [] as ReadonlyArray<{ kind: string; text: string }>,
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (value: typeof state) => T) => selector(state),
  useSessionOpenQuestions: () => state.openQuestions,
}));

vi.mock('../../../../store/transcript', () => ({
  useTranscript: () => [],
}));

vi.mock('../../../chat/utils/transcript-items', () => ({
  reduceTranscript: () => transcriptItems.items,
}));

vi.mock('../../hooks/useAgentMetrics', () => ({
  useAgentMetrics: () => ({
    latestTelemetryByAgentId: new Map(),
    aggregatesByAgentId: new Map(),
    providerUsageByAgentId: new Map(),
    turnsByAgentId: new Map(),
  }),
}));

vi.mock('../../../workflows/useAttachedWorkflowRuns', () => ({
  useAttachedWorkflowRuns: () => [],
}));

vi.mock('./AgentFollowUps', () => ({
  AgentFollowUps: () => null,
}));

import { SECTION_SURFACE_CLASS } from '@goodboy/ui';
import { AgentBrief } from './AgentBrief';

const carriesSurface = (element: Element): boolean =>
  SECTION_SURFACE_CLASS.split(' ').every((token) => element.classList.contains(token));

const sessionId = 'session-1' as SessionId;
const agentId = 'agent-1' as AgentId;
const session = { id: sessionId, workflowRuns: [] } as unknown as Session;

const makeAgent = (over: Partial<Agent>): Agent => ({
  id: agentId,
  sessionId,
  ordinal: 0,
  name: 'Implement chat',
  status: 'completed',
  kind: 'implementer',
  ...over,
});

afterEach(cleanup);

beforeEach(() => {
  Object.assign(state, {
    sessionPhaseRuns: {},
    agentTurnState: {},
    agentKindOverride: {},
    sessionPlans: {},
    openQuestions: [],
  });
  transcriptItems.items = [];
});

describe('AgentBrief summary', () => {
  it('shows the recorded outcome when outputSummary has content', () => {
    const agent = makeAgent({ outputSummary: 'shipped the refactor' });

    render(<AgentBrief session={session} agent={agent} />);

    expect(screen.getByText('Outcome')).toBeDefined();
    expect(screen.getByText('shipped the refactor')).toBeDefined();
    expect(screen.queryByText('from the last reply')).toBeNull();
  });

  it('falls back to the last assistant reply when outputSummary is an empty string', () => {
    const agent = makeAgent({ outputSummary: '' });
    transcriptItems.items = [{ kind: 'assistant_text', text: 'here is the last reply' }];

    render(<AgentBrief session={session} agent={agent} />);

    expect(screen.getByText('Latest')).toBeDefined();
    expect(screen.getByText('here is the last reply')).toBeDefined();
    expect(screen.getByText('from the last reply')).toBeDefined();
  });

  it('falls back to the last assistant reply when outputSummary is absent', () => {
    const agent = makeAgent({ outputSummary: undefined });
    transcriptItems.items = [{ kind: 'assistant_text', text: 'still working from the transcript' }];

    render(<AgentBrief session={session} agent={agent} />);

    expect(screen.getByText('Latest')).toBeDefined();
    expect(screen.getByText('still working from the transcript')).toBeDefined();
  });
});

describe('AgentBrief statistics', () => {
  it('reads cost, turns, input and output as one metadata line, not four cards', () => {
    const { container } = render(
      <AgentBrief session={session} agent={makeAgent({ outputSummary: 'shipped the refactor' })} />,
    );

    const metrics = ['cost', 'turns', 'input', 'output'].map((label) => screen.getByText(label));
    const line = metrics[0]?.parentElement?.parentElement ?? null;

    expect(line).not.toBeNull();
    expect(metrics.every((metric) => metric.parentElement?.parentElement === line)).toBe(true);
    expect(container.querySelector('.grid')).toBeNull();
  });

  it('leads with the outcome and leaves the numbers behind it', () => {
    render(
      <AgentBrief session={session} agent={makeAgent({ outputSummary: 'shipped the refactor' })} />,
    );

    const outcome = screen.getByRole('heading', { level: 2, name: 'Outcome' });
    const position = outcome.compareDocumentPosition(screen.getByText('cost'));

    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('keeps the numbers off a surface of their own, so they cannot reinflate', () => {
    render(
      <AgentBrief session={session} agent={makeAgent({ outputSummary: 'shipped the refactor' })} />,
    );

    expect(screen.getByText('cost').closest('section')).toBeNull();
  });
});

describe('AgentBrief open questions', () => {
  const blocking = {
    id: 'oq-1',
    sessionId,
    text: 'Il refactor del core è già su main?',
    suggestedAnswers: ['sì', 'no'],
    userAnswer: null,
    status: 'open',
    createdByAgentId: agentId,
    createdAt: '2026-08-18T09:00:00.000Z',
  } as unknown as OpenQuestion;

  it('leads the brief with the question that blocks the step, above Latest', () => {
    state.openQuestions = [blocking];
    transcriptItems.items = [{ kind: 'assistant_text', text: 'here is the last reply' }];

    render(<AgentBrief session={session} agent={makeAgent({ outputSummary: '' })} />);

    const question = screen.getByText('Il refactor del core è già su main?');
    const latest = screen.getByText('Latest');

    expect(question.compareDocumentPosition(latest) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('says nothing about questions when none is waiting', () => {
    render(<AgentBrief session={session} agent={makeAgent({ outputSummary: 'shipped it' })} />);

    expect(screen.queryByText('Open question')).toBeNull();
    expect(screen.queryByText('Open questions')).toBeNull();
  });
});

describe('AgentBrief type scale', () => {
  it('labels the outcome on the eyebrow grade while keeping it in the outline', () => {
    render(
      <AgentBrief session={session} agent={makeAgent({ outputSummary: 'shipped the refactor' })} />,
    );

    const heading = screen.getByRole('heading', { level: 2, name: 'Outcome' });

    expect(heading.className).not.toContain('text-base');
    expect(screen.getByText('Outcome').className).toContain('text-2xs');
  });

  it('leaves the outcome body on the reading grade, since it is prose', () => {
    render(
      <AgentBrief session={session} agent={makeAgent({ outputSummary: 'shipped the refactor' })} />,
    );

    const prose = screen.getByText('shipped the refactor').closest('.text-sm');

    expect(prose).not.toBeNull();
  });

  it('reads the live state on the status grade the overview header uses', () => {
    render(<AgentBrief session={session} agent={makeAgent({ status: 'pending' })} />);

    const line = screen.getByText('queued').parentElement;

    expect(line?.className).toContain('text-xs');
    expect(line?.className).not.toContain('text-sm');
  });
});

describe('AgentBrief sections', () => {
  it('carries every section on the one shared surface', () => {
    state.sessionPlans = {
      [sessionId]: [
        { id: 'plan-1', agentId, title: 'Split the store', status: 'active', consumptionCount: 1 },
      ],
    };

    const { container } = render(
      <AgentBrief session={session} agent={makeAgent({ outputSummary: 'shipped the refactor' })} />,
    );
    const sections = Array.from(container.querySelectorAll('section'));

    expect(sections.length).toBeGreaterThan(2);
    expect(sections.every(carriesSurface)).toBe(true);
  });
});
