// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  SessionId,
  Step,
  StepId,
  WorkflowId,
  WorkflowRoutingDecision,
  WorkflowRunId,
} from '@goodboy/types';

const { storeState, setLockSpy, resetLockSpy } = vi.hoisted(() => ({
  storeState: {} as Record<string, unknown>,
  setLockSpy: vi.fn(),
  resetLockSpy: vi.fn(),
}));

vi.mock('../../../../store/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector(storeState),
}));

import { WorkflowNodeRouting } from './index';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const STEP_ID = 'step-1' as StepId;

const childDecision: WorkflowRoutingDecision = {
  version: 1,
  proposal: {
    pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
    reason: 'Heavy refactor area, so a stronger reasoning model was chosen.',
    source: 'agent',
    profile: { taskType: 'implementation', difficulty: 'heavy', basis: 'agent' },
  },
  selected: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
  source: 'agent',
  reason: 'Heavy refactor area, so a stronger reasoning model was chosen.',
  adjustment: 'none',
  executed: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
};

const rootAgent: Agent = {
  id: 'agent-root' as AgentId,
  sessionId: SESSION_ID,
  stepId: STEP_ID,
  workflowRunId: RUN_ID,
  ordinal: 0,
  name: 'Plan the work',
  status: 'completed',
  providerOverride: 'anthropic',
  modelOverride: 'opus-5',
  effort: 'high',
};

const childAgent: Agent = {
  id: 'agent-child' as AgentId,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  parentAgentId: 'agent-root' as AgentId,
  ordinal: 1,
  name: 'Scout the parser',
  status: 'running',
  providerOverride: 'codex',
  modelOverride: 'gpt-5.6-sol',
  effort: 'high',
  routingDecision: childDecision,
  taskProfile: { taskType: 'implementation', difficulty: 'heavy', basis: 'agent' },
};

const step: Step = {
  id: STEP_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  name: 'Plan the work',
  promptPrefix: 'plan',
  role: 'planner',
};

const seedStore = (agents: ReadonlyArray<Agent>) => {
  Object.assign(storeState, {
    sessionPhaseRuns: { [SESSION_ID]: agents },
    providers: [{ id: 'codex', connection: 'connected' }],
    workflowNodeRoutingPending: {},
    workflowNodeRoutingErrors: {},
    setWorkflowNodeRoutingLock: setLockSpy,
    resetWorkflowNodeRoutingLock: resetLockSpy,
    selectAgent: vi.fn(),
  });
};

const openSection = () => {
  render(<WorkflowNodeRouting sessionId={SESSION_ID} workflowRunId={RUN_ID} steps={[step]} />);
  fireEvent.click(screen.getByRole('button', { name: /model choice/ }));
};

describe('WorkflowNodeRouting', () => {
  beforeEach(() => {
    seedStore([rootAgent, childAgent]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('child reason and actual provider are visible after reload', () => {
    openSection();

    expect(screen.getByRole('button', { name: 'Scout the parser' })).toBeTruthy();
    const section = screen.getByTestId('workflow-node-routing');
    expect(section.textContent).toContain(
      'Heavy refactor area, so a stronger reasoning model was chosen.',
    );
    expect(section.textContent).toContain('Heavy work');
    expect(section.textContent).toContain('Codex');
  });

  it('refuses to change a running node and offers a picker on a pending one', () => {
    openSection();

    expect(screen.queryByRole('button', { name: /Routing for Scout the parser/ })).toBeNull();
    expect(screen.getByTestId('workflow-node-routing').textContent).toContain(
      'Fixed once the step started',
    );

    cleanup();
    seedStore([{ ...childAgent, status: 'pending' }]);
    openSection();

    expect(screen.getByRole('button', { name: /Routing for Scout the parser/ })).toBeTruthy();
  });

  it('surfaces a refusal raised by the persistence layer', () => {
    Object.assign(storeState, {
      workflowNodeRoutingErrors: {
        'agent:agent-child': 'This step has already started, so its model stays as it ran.',
      },
    });
    openSection();

    expect(screen.getByRole('alert').textContent).toContain('already started');
  });
});
