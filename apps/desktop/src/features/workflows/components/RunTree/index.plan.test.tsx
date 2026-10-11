// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Agent, ArtifactId, PlanWithCount, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { aPlan } from '../../../../test/planFixtures';
import { RunTreeHarness } from './testing/RunTreeHarness';
import {
  SESSION_ID,
  WORKSPACE_ID,
  baseAgents,
  run,
  scouts,
  step,
  workflow,
} from './testing/runTreeFixtures';

const PLAN_ID = 'plan-refund-keys' as ArtifactId;

const planOf = (overrides: Partial<PlanWithCount> = {}): PlanWithCount =>
  aPlan({ id: PLAN_ID, sessionId: SESSION_ID, agentId: 'scout' as Agent['id'], ...overrides });

const heldRun: WorkflowRun = {
  ...run,
  orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
};

const seed = ({
  agents = baseAgents,
  plans,
}: {
  readonly agents?: ReadonlyArray<Agent>;
  readonly plans: ReadonlyArray<PlanWithCount>;
}) => {
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION_ID]: [...agents] },
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
    sessionOpenQuestions: { [SESSION_ID]: [] },
    sessionPlans: { [SESSION_ID]: [...plans] },
  });
};

const rowOf = (id: string): HTMLElement => screen.getByTestId(`run-tree-row-${id}`);

beforeEach(() => {
  useAppStore.setState({
    sessionTelemetry: {},
    agentRunHistory: {},
    sessionWorkflows: {},
    orchestratingWorkflowRuns: {},
    agentTurnState: {},
    drawer: null,
  });
});

afterEach(cleanup);

describe('RunTree planner row', () => {
  it('draws no plan button on the planner row while the run is held for its plan', () => {
    seed({ plans: [planOf()] });
    render(<RunTreeHarness routingRun={heldRun} />);

    expect(within(rowOf('scout')).queryByRole('button', { name: 'Review plan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open plan' })).toBeNull();
  });

  it('offers Open plan once the run is not held for it', () => {
    seed({ plans: [planOf()] });
    render(<RunTreeHarness routingRun={run} />);

    expect(within(rowOf('scout')).getByRole('button', { name: 'Open plan' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Review plan' })).toBeNull();
  });

  it('offers Open plan for a plan that was already consumed, even while the run is held', () => {
    seed({ plans: [planOf({ status: 'consumed', consumptionCount: 1 })] });
    render(<RunTreeHarness routingRun={heldRun} />);

    expect(within(rowOf('scout')).getByRole('button', { name: 'Open plan' })).toBeDefined();
  });

  it('opens the plan drawer on the click', () => {
    seed({ plans: [planOf()] });
    render(<RunTreeHarness routingRun={run} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open plan' }));

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'artifact-document',
      sessionId: SESSION_ID,
      payload: { artifactId: PLAN_ID },
    });
  });

  it('shows no plan button on a step that produced no plan, nor on a sub-agent row', () => {
    seed({ agents: [...baseAgents, ...scouts('running')], plans: [planOf()] });
    render(<RunTreeHarness routingRun={run} />);

    expect(screen.getAllByRole('button', { name: 'Open plan' })).toHaveLength(1);
    expect(within(rowOf('implement')).queryByRole('button', { name: 'Open plan' })).toBeNull();
    expect(within(rowOf('scout-a')).queryByRole('button', { name: 'Open plan' })).toBeNull();
  });

  it('keeps the button on a finished run, where no row is live', () => {
    const finished = [
      step({ id: 'scout', ordinal: 1, status: 'completed' }),
      step({ id: 'implement', ordinal: 2, status: 'completed' }),
      step({ id: 'review', ordinal: 3, status: 'completed' }),
    ];
    seed({ agents: finished, plans: [planOf({ status: 'consumed', consumptionCount: 1 })] });
    render(<RunTreeHarness routingRun={run} />);

    expect(within(rowOf('scout')).getByRole('button', { name: 'Open plan' })).toBeDefined();
  });

  it('shows no plan button when the session has no plan', () => {
    seed({ plans: [] });
    render(<RunTreeHarness routingRun={heldRun} />);

    expect(screen.queryByRole('button', { name: /plan$/u })).toBeNull();
  });
});
