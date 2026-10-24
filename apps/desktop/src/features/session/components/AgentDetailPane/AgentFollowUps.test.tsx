// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Agent, AgentId, OpenQuestion, SessionId } from '@goodboy/types';
import type { SpawnedChild } from '../../../../shared/utils/spawnedChildren';
import type { ContinueOutcome } from '../../startRun/continueWithRole';

const state = vi.hoisted(() => {
  const autoTreeViews: Record<string, ReadonlyArray<unknown>> = {};
  const sessionPhaseRuns: Record<string, ReadonlyArray<unknown>> = {};
  return {
    agentTurnState: {} as Record<string, unknown>,
    sessionPhaseRuns,
    agentWriterWait: {},
    autoTreeViews,
    openQuestions: [] as ReadonlyArray<OpenQuestion>,
    navigate: vi.fn(),
    loadAgentTranscript: vi.fn(async () => undefined),
    providers: [],
    sessions: [],
    settings: {},
    providerLimits: {},
  };
});

const continueWithRole = vi.hoisted(() =>
  vi.fn(async (_params: unknown): Promise<ContinueOutcome> => ({
    kind: 'handed',
    agentId: 'agent-auto' as AgentId,
  })),
);

vi.mock('../../../../store', async () => ({
  ...(await import('../../../../store/slices/navigation/place')),
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (value: typeof state) => T) => selector(state),
  useSessionOpenQuestions: () => state.openQuestions,
}));

vi.mock('../../../../store/slices/transcripts/selectors', () => ({
  useTranscript: () => [],
}));

vi.mock('../../startRun/continueWithRole', () => ({ continueWithRole }));

import { AgentFollowUps } from './AgentFollowUps';
import type { FollowUpChild } from './followUpChildren';

const sessionId = 'session-1' as SessionId;
const sourceId = 'agent-1' as AgentId;

const source: Agent = {
  id: sourceId,
  sessionId,
  ordinal: 0,
  name: 'Review the store split',
  status: 'completed',
  kind: 'reviewer',
} as Agent;

const makeChild = (over: Partial<Agent>): FollowUpChild => {
  const agent = {
    id: 'agent-2' as AgentId,
    sessionId,
    ordinal: 1,
    name: 'Plan the store split',
    status: 'running',
    kind: 'planner',
    parentAgentId: sourceId,
    ...over,
  } as Agent;
  return {
    kind: 'planner',
    child: { agent, index: 0, total: 1, status: agent.status, assignment: null } as SpawnedChild,
  };
};

type RenderParams = {
  readonly followUps?: ReadonlyArray<FollowUpChild>;
};

const renderFollowUps = ({ followUps = [] }: RenderParams = {}) =>
  render(
    <AgentFollowUps
      sourceAgent={source}
      sourceKind="reviewer"
      sessionId={sessionId}
      followUps={followUps}
    />,
  );

afterEach(cleanup);

beforeEach(() => {
  state.agentTurnState = {};
  state.autoTreeViews = {};
  state.openQuestions = [];
  state.navigate.mockClear();
  continueWithRole.mockClear();
});

describe('AgentFollowUps inside an Auto tree', () => {
  it('offers nothing when Auto owns the agent, because Auto decides what comes next', () => {
    state.autoTreeViews = {
      [sessionId]: [
        {
          tree: { rootAgentId: 'agent-auto' },
          delegations: [{ childAgentId: sourceId, isAdopted: false }],
        },
      ],
    };

    const { container } = renderFollowUps();

    expect(container.firstChild).toBeNull();
  });

  it('offers nothing on an agent Auto already took from here either', () => {
    state.autoTreeViews = {
      [sessionId]: [
        {
          tree: { rootAgentId: 'agent-auto' },
          delegations: [{ childAgentId: sourceId, isAdopted: true }],
        },
      ],
    };

    const { container } = renderFollowUps();

    expect(container.firstChild).toBeNull();
  });
});

describe('AgentFollowUps continue the same run', () => {
  it('names the role each card continues with', () => {
    renderFollowUps();

    expect(screen.getByText('Planner')).toBeDefined();
    expect(screen.getByText('Implementer')).toBeDefined();
    expect(
      screen.getByRole('button', {
        name: 'Continue with Planner: Turn the review findings into a plan',
      }),
    ).toBeDefined();
  });

  it('sends the card to Auto with this agent as the source, and opens what answers it', async () => {
    renderFollowUps();

    screen.getByText('Turn the review findings into a plan').click();
    await vi.waitFor(() => expect(state.navigate).toHaveBeenCalledTimes(1));

    expect(continueWithRole).toHaveBeenCalledWith({
      sessionId,
      role: 'planner',
      work: 'Turn the review findings into a plan',
      sourceAgentId: sourceId,
    });
    expect(state.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId, agentId: 'agent-auto' },
    });
  });

  it('keeps the cards and shows the error when Auto cannot take it, so a click retries', async () => {
    continueWithRole.mockRejectedValueOnce(new Error('Wait for the turn to end first.'));
    renderFollowUps();

    screen.getByText('Fix these review findings').click();

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Wait for the turn to end first.',
    );
    expect(state.navigate).not.toHaveBeenCalled();
    screen.getByText('Fix these review findings').click();
    await vi.waitFor(() => expect(continueWithRole).toHaveBeenCalledTimes(2));
  });
});

describe('AgentFollowUps after a spawn', () => {
  it('replaces the suggestion of a spawned kind with its live status', () => {
    renderFollowUps({ followUps: [makeChild({})] });

    expect(screen.getByText('Plan the store split')).toBeDefined();
    expect(screen.queryByText('Turn the review findings into a plan')).toBeNull();
    expect(screen.getByText('Fix these review findings')).toBeDefined();
  });

  it('reads a spawned child that finished as done', () => {
    renderFollowUps({ followUps: [makeChild({ status: 'completed' })] });

    expect(screen.getByText('done')).toBeDefined();
  });

  it('reads a spawned child that was stopped as stopped, not ready', () => {
    renderFollowUps({ followUps: [makeChild({ status: 'stopped' })] });

    expect(screen.getByText('stopped')).toBeDefined();
    expect(screen.queryByText('ready')).toBeNull();
  });

  it('flags a spawned child that is waiting on an answer', () => {
    state.openQuestions = [
      {
        id: 'oq-1',
        sessionId,
        text: 'which module first?',
        status: 'open',
        createdByAgentId: 'agent-2' as AgentId,
      } as OpenQuestion,
    ];

    renderFollowUps({ followUps: [makeChild({})] });

    expect(screen.getByText('question')).toBeDefined();
  });

  it('opens the spawned child from its row', async () => {
    renderFollowUps({ followUps: [makeChild({})] });

    screen.getByRole('button', { name: 'Go to chat' }).click();
    await vi.waitFor(() => expect(state.navigate).toHaveBeenCalledTimes(1));

    expect(state.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: sessionId, agentId: 'agent-2' },
    });
  });
});
