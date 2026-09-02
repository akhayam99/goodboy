// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Agent, AgentId, OpenQuestion, PlanId, SessionId } from '@goodboy/types';
import type { SpawnedChild } from '../../../../shared/utils/spawnedChildren';

const state = vi.hoisted(() => ({
  agentTurnState: {} as Record<string, unknown>,
  openQuestions: [] as ReadonlyArray<OpenQuestion>,
  spawnAgent: vi.fn(async () => 'agent-2' as AgentId),
  selectAgent: vi.fn(async () => undefined),
  setCurrentSession: vi.fn(async () => undefined),
  setActiveLens: vi.fn(() => undefined),
}));

const announce = vi.hoisted(() => vi.fn());

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (value: typeof state) => T) => selector(state),
  useSessionOpenQuestions: () => state.openQuestions,
}));

vi.mock('../../../../store/transcript', () => ({
  useTranscript: () => [],
}));

vi.mock('../../../../shared/hooks/useAgentStartedToast', () => ({
  useAgentStartedToast: () => announce,
}));

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

afterEach(cleanup);

beforeEach(() => {
  state.agentTurnState = {};
  state.openQuestions = [];
  state.spawnAgent.mockClear();
  state.selectAgent.mockClear();
  announce.mockClear();
});

describe('AgentFollowUps suggestions', () => {
  it('names the kind about to be spawned on every suggestion', () => {
    render(
      <AgentFollowUps
        sourceAgent={source}
        sourceKind="reviewer"
        summary="two findings"
        sessionId={sessionId}
        followUps={[]}
        activePlanId={null}
      />,
    );

    expect(screen.getByText('Plan')).toBeDefined();
    expect(screen.getByText('Implement')).toBeDefined();
    expect(screen.getByText('Turn the review findings into a plan')).toBeDefined();
  });

  it('links the spawned agent to the agent it continues', async () => {
    render(
      <AgentFollowUps
        sourceAgent={source}
        sourceKind="reviewer"
        summary="two findings"
        sessionId={sessionId}
        followUps={[]}
        activePlanId={null}
      />,
    );

    screen.getByText('Turn the review findings into a plan').click();
    await vi.waitFor(() => expect(state.spawnAgent).toHaveBeenCalledTimes(1));

    expect(state.spawnAgent).toHaveBeenCalledWith(
      sessionId,
      expect.objectContaining({ kindOverride: 'planner', parentAgentId: sourceId }),
    );
  });

  it('hands the active plan to an implementer instead of a seed so it can fan out', async () => {
    render(
      <AgentFollowUps
        sourceAgent={source}
        sourceKind="reviewer"
        summary="two findings"
        sessionId={sessionId}
        followUps={[]}
        activePlanId={'plan-1' as PlanId}
      />,
    );

    screen.getByText('Fix these review findings').click();
    await vi.waitFor(() => expect(state.spawnAgent).toHaveBeenCalledTimes(1));

    const options = (state.spawnAgent.mock.calls[0] as ReadonlyArray<unknown>)[1] as Record<
      string,
      unknown
    >;
    expect(options.kindOverride).toBe('implementer');
    expect(options.triggeredPlanId).toBe('plan-1');
    expect(options.initialPrompt).toBeUndefined();
    expect(options.parentAgentId).toBe(sourceId);
  });

  it('keeps the seed on an implementer when no plan exists', async () => {
    render(
      <AgentFollowUps
        sourceAgent={source}
        sourceKind="reviewer"
        summary="two findings"
        sessionId={sessionId}
        followUps={[]}
        activePlanId={null}
      />,
    );

    screen.getByText('Fix these review findings').click();
    await vi.waitFor(() => expect(state.spawnAgent).toHaveBeenCalledTimes(1));

    const options = (state.spawnAgent.mock.calls[0] as ReadonlyArray<unknown>)[1] as Record<
      string,
      unknown
    >;
    expect(options.triggeredPlanId).toBeUndefined();
    expect(typeof options.initialPrompt).toBe('string');
    expect((options.initialPrompt as string).length).toBeGreaterThan(0);
  });
});

describe('AgentFollowUps after a spawn', () => {
  it('replaces the suggestion of a spawned kind with its live status', () => {
    render(
      <AgentFollowUps
        sourceAgent={source}
        sourceKind="reviewer"
        summary="two findings"
        sessionId={sessionId}
        followUps={[makeChild({})]}
        activePlanId={null}
      />,
    );

    expect(screen.getByText('Plan the store split')).toBeDefined();
    expect(screen.queryByText('Turn the review findings into a plan')).toBeNull();
    expect(screen.getByText('Fix these review findings')).toBeDefined();
  });

  it('reads a spawned child that finished as done', () => {
    render(
      <AgentFollowUps
        sourceAgent={source}
        sourceKind="reviewer"
        summary="two findings"
        sessionId={sessionId}
        followUps={[makeChild({ status: 'completed' })]}
        activePlanId={null}
      />,
    );

    expect(screen.getByText('done')).toBeDefined();
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

    render(
      <AgentFollowUps
        sourceAgent={source}
        sourceKind="reviewer"
        summary="two findings"
        sessionId={sessionId}
        followUps={[makeChild({})]}
        activePlanId={null}
      />,
    );

    expect(screen.getByText('question')).toBeDefined();
  });

  it('opens the spawned child from its row', async () => {
    render(
      <AgentFollowUps
        sourceAgent={source}
        sourceKind="reviewer"
        summary="two findings"
        sessionId={sessionId}
        followUps={[makeChild({})]}
        activePlanId={null}
      />,
    );

    screen.getByRole('button', { name: 'Go to chat' }).click();
    await vi.waitFor(() => expect(state.selectAgent).toHaveBeenCalledTimes(1));

    expect(state.selectAgent).toHaveBeenCalledWith(sessionId, 'agent-2');
  });
});
