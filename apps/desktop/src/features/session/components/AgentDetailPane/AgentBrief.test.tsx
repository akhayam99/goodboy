// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, OpenQuestion, Session, SessionId } from '@goodboy/types';

const state = vi.hoisted(() => ({
  sessionPhaseRuns: {} as Record<string, ReadonlyArray<Agent>>,
  sessionWorkflows: {} as Record<string, ReadonlyArray<unknown>>,
  agentTurnState: {} as Record<string, unknown>,
  agentKindOverride: {} as Record<string, unknown>,
  agentProviderOverride: {} as Record<string, unknown>,
  agentModelOverride: {} as Record<string, unknown>,
  agentEffortOverride: {} as Record<string, unknown>,
  sessionPlans: {} as Record<string, ReadonlyArray<unknown>>,
  openQuestions: [] as ReadonlyArray<OpenQuestion>,
  answeredQuestions: [] as ReadonlyArray<OpenQuestion>,
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
  useSessionAnsweredQuestions: () => state.answeredQuestions,
  useExecutedAgentRouting: () => null,
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

vi.mock('./AgentBriefChildren', () => ({
  AgentBriefChildren: ({
    children,
  }: {
    readonly children: ReadonlyArray<{ readonly agent: Agent }>;
  }) =>
    children.length === 0 ? null : (
      <section>
        <span>Subagents</span>
        {children.map((child) => (
          <span key={child.agent.id}>{child.agent.name}</span>
        ))}
      </section>
    ),
}));

const { invokeSpy } = vi.hoisted(() => ({ invokeSpy: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeSpy }));

import { AgentBrief } from './AgentBrief';

const opensWithItsLabel = (section: Element): boolean =>
  (section.firstElementChild?.textContent ?? '').trim() !== '';

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
    answeredQuestions: [],
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

  it('lets the subagent tree speak for an implementer split into parts', () => {
    const container = makeAgent({ outputSummary: 'completed 2 clusters' });
    state.sessionPhaseRuns = {
      [sessionId]: [
        container,
        makeAgent({
          id: 'part-1' as AgentId,
          ordinal: 1,
          name: 'part one',
          parentAgentId: agentId,
        }),
      ],
    };

    render(<AgentBrief session={session} agent={container} />);

    expect(screen.queryByText('Outcome')).toBeNull();
    expect(screen.queryByText('completed 2 clusters')).toBeNull();
    expect(screen.getByText('part one')).toBeTruthy();
  });

  it('keeps the outcome of a scout that spawned subagents', () => {
    const scout = makeAgent({ kind: 'scout', outputSummary: 'mapped the store' });
    state.sessionPhaseRuns = {
      [sessionId]: [
        scout,
        makeAgent({
          id: 'sub-1' as AgentId,
          ordinal: 1,
          name: 'sub scout',
          kind: 'scout',
          parentAgentId: agentId,
        }),
      ],
    };

    render(<AgentBrief session={session} agent={scout} />);

    expect(screen.getByText('Outcome')).toBeDefined();
    expect(screen.getByText('mapped the store')).toBeDefined();
  });

  it('falls back to the last assistant reply when outputSummary is an empty string', () => {
    const agent = makeAgent({ outputSummary: '' });
    transcriptItems.items = [{ kind: 'assistant_text', text: 'here is the last reply' }];

    const { container } = render(<AgentBrief session={session} agent={agent} />);

    expect(screen.getByText('Latest')).toBeDefined();
    expect(container.textContent).toContain('here is the last reply');
    expect(screen.getByText('from the last reply')).toBeDefined();
  });

  it('labels the excerpt it renders as unsummarized rather than as a summary', () => {
    const agent = makeAgent({ outputSummary: '' });
    transcriptItems.items = [{ kind: 'assistant_text', text: 'here is the last reply' }];

    const { container } = render(<AgentBrief session={session} agent={agent} />);

    expect(container.textContent).toContain('[unsummarized step output, carried whole]');
  });

  it('starts no provider work while rendering the excerpt', () => {
    const agent = makeAgent({ outputSummary: '' });
    transcriptItems.items = [{ kind: 'assistant_text', text: 'here is the last reply' }];

    render(<AgentBrief session={session} agent={agent} />);

    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it('falls back to the last assistant reply when outputSummary is absent', () => {
    const agent = makeAgent({ outputSummary: undefined });
    transcriptItems.items = [{ kind: 'assistant_text', text: 'still working from the transcript' }];

    const { container } = render(<AgentBrief session={session} agent={agent} />);

    expect(screen.getByText('Latest')).toBeDefined();
    expect(container.textContent).toContain('still working from the transcript');
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

describe('AgentBrief delegated answers', () => {
  const delegateId = 'child-1' as AgentId;

  const delegate = (over: Partial<Agent> = {}): Agent =>
    makeAgent({
      id: delegateId,
      ordinal: 1,
      name: 'answer: pick a database',
      kind: 'scout',
      status: 'running',
      parentAgentId: agentId,
      sourceKind: 'open_question',
      sourceThreadId: 'oq-1',
      ...over,
    });

  const question = {
    id: 'oq-1',
    sessionId,
    text: 'pick a database',
    suggestedAnswers: [],
    isBlocking: false,
    userAnswer: null,
    status: 'open',
    createdByAgentId: agentId,
    createdAt: '2026-09-21T00:00:00.000Z',
  } as unknown as OpenQuestion;

  it('lists the delegate on the asker, with the question and its status', () => {
    state.sessionPhaseRuns = { [sessionId]: [makeAgent({}), delegate()] };
    state.openQuestions = [question];

    render(<AgentBrief session={session} agent={makeAgent({})} />);

    expect(screen.getByText('Delegated answers')).toBeTruthy();
    const row = screen.getByTestId(`delegate-brief-row-${delegateId}`);
    expect(row.textContent).toContain('pick a database');
    expect(row.textContent).toContain('running');
  });

  it('opens the delegate from its row', () => {
    const selectAgent = vi.fn(async () => undefined);
    state.selectAgent = selectAgent;
    state.sessionPhaseRuns = { [sessionId]: [makeAgent({}), delegate()] };
    state.openQuestions = [question];

    render(<AgentBrief session={session} agent={makeAgent({})} />);
    fireEvent.click(screen.getByTestId(`delegate-brief-row-${delegateId}`));

    expect(selectAgent).toHaveBeenCalledWith(sessionId, delegateId);
  });

  it('keeps the delegate out of the generic children lane, so it is not listed twice', () => {
    state.sessionPhaseRuns = {
      [sessionId]: [
        makeAgent({}),
        delegate(),
        makeAgent({
          id: 'child-2' as AgentId,
          ordinal: 2,
          name: 'cluster one',
          parentAgentId: agentId,
        }),
      ],
    };
    state.openQuestions = [question];

    render(<AgentBrief session={session} agent={makeAgent({})} />);

    expect(screen.getByText('Subagents')).toBeTruthy();
    expect(screen.getByText('cluster one')).toBeTruthy();
    expect(screen.queryByText('answer: pick a database')).toBeNull();
  });

  it('says nothing about delegates when the agent spawned none', () => {
    state.sessionPhaseRuns = { [sessionId]: [makeAgent({})] };

    render(<AgentBrief session={session} agent={makeAgent({})} />);

    expect(screen.queryByText('Delegated answers')).toBeNull();
  });

  it('quotes the question on the delegate itself, with a way back to the asker', () => {
    const selectAgent = vi.fn(async () => undefined);
    state.selectAgent = selectAgent;
    state.sessionPhaseRuns = { [sessionId]: [makeAgent({ name: 'plan the work' }), delegate()] };
    state.answeredQuestions = [
      { ...question, status: 'answered', userAnswer: 'Postgres' } as unknown as OpenQuestion,
    ];

    render(<AgentBrief session={session} agent={delegate()} />);

    expect(screen.getByText('Answering for')).toBeTruthy();
    expect(screen.getByText('pick a database')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'asked by plan the work' }));
    expect(selectAgent).toHaveBeenCalledWith(sessionId, agentId);
  });

  it('says nothing about answering for on an agent that is not a delegate', () => {
    state.sessionPhaseRuns = { [sessionId]: [makeAgent({})] };
    state.openQuestions = [question];

    render(<AgentBrief session={session} agent={makeAgent({})} />);

    expect(screen.queryByText('Answering for')).toBeNull();
  });
});

describe('AgentBrief sections', () => {
  it('opens every section with its label on the shared surface', () => {
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
    expect(sections.every(opensWithItsLabel)).toBe(true);
  });
});
