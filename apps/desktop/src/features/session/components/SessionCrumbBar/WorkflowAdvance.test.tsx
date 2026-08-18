// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getModelDescriptor } from '@goodboy/core';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderId,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

type Store = {
  sessionPhaseRuns: Record<string, ReadonlyArray<Agent>>;
  agentTurnState: Record<string, { kind: string }>;
  summarizerStatus: Record<string, { status: string }>;
  agentModelOverride: Record<string, string>;
  agentProviderOverride: Record<string, ProviderId>;
  agentEffortOverride: Record<string, string>;
  activateWorkflowAgent: ReturnType<typeof vi.fn>;
  skipStuckStepAndAdvance: ReturnType<typeof vi.fn>;
  recoverStuckStep: ReturnType<typeof vi.fn>;
  emitNotification: ReturnType<typeof vi.fn>;
};

const { store, gate } = vi.hoisted(() => ({
  store: {
    sessionPhaseRuns: {},
    agentTurnState: {},
    summarizerStatus: {},
    agentModelOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
    activateWorkflowAgent: vi.fn(async () => undefined),
    skipStuckStepAndAdvance: vi.fn(async () => undefined),
    recoverStuckStep: vi.fn(async () => undefined),
    emitNotification: vi.fn(async () => undefined),
  } as Store,
  gate: { hasOpenQuestions: false },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: Store) => T) => selector(store),
  useSessionOpenQuestions: () => [],
}));

vi.mock('../../../context/openQuestionsGate', () => ({
  workflowRunHasOpenQuestions: () => gate.hasOpenQuestions,
}));

import { WorkflowAdvance } from './WorkflowAdvance';
import { WorkflowGateError } from '../../../../store/slices/workflows/workflowActivationGate';

const SESSION_ID = 'session-1' as SessionId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-07-25T00:00:00.000Z' as IsoDateTime;
const FROZEN_MODEL = 'opus-5';

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  name: 'Refactor',
  description: '',
  steps: [
    {
      id: 'step-1' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Scout',
      promptPrefix: '',
    },
    { id: 'step-2' as StepId, workflowId: WORKFLOW_ID, ordinal: 1, name: 'Plan', promptPrefix: '' },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const agent = (index: number, status: Agent['status']): Agent => ({
  id: `agent-${index}` as AgentId,
  sessionId: SESSION_ID,
  stepId: workflow.steps[index]!.id,
  workflowRunId: RUN_ID,
  ordinal: index,
  name: workflow.steps[index]!.name,
  status,
});

const buildRun = (overrides: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  ...overrides,
});

const renderAdvance = (run: WorkflowRun = buildRun()) =>
  render(<WorkflowAdvance sessionId={SESSION_ID} run={run} workflow={workflow} />);

beforeEach(() => {
  store.sessionPhaseRuns = {};
  store.agentTurnState = {};
  store.summarizerStatus = {};
  store.agentModelOverride = {};
  store.agentProviderOverride = {};
  store.agentEffortOverride = {};
  store.activateWorkflowAgent.mockReset();
  store.activateWorkflowAgent.mockResolvedValue(undefined);
  store.skipStuckStepAndAdvance.mockReset();
  store.recoverStuckStep.mockReset();
  store.recoverStuckStep.mockResolvedValue(undefined);
  store.emitNotification.mockReset();
  store.emitNotification.mockResolvedValue(undefined);
  gate.hasOpenQuestions = false;
});

afterEach(cleanup);

describe('WorkflowAdvance', () => {
  it('starts the next step agent when nothing blocks', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'pending')] };
    renderAdvance();

    fireEvent.click(screen.getByTestId('workflow-next-step-cta'));

    expect(store.activateWorkflowAgent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: 'agent-1',
      focus: 'agent',
      bypassGate: false,
    });
  });

  it('names the blocker instead of hiding the CTA while the summarizer runs', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'pending')] };
    store.summarizerStatus = { [SESSION_ID]: { status: 'running' } };
    renderAdvance();

    expect(screen.getByTestId('workflow-next-step-blocked')).toBeDefined();
    expect(screen.getByTestId('workflow-next-step-cta').getAttribute('title')).toMatch(
      /step summary is still being written/i,
    );
  });

  it('warns and confirms while the predecessor turn is still running', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'pending')] };
    store.agentTurnState = { 'agent-0': { kind: 'running' } };
    renderAdvance();

    const cta = screen.getByTestId('workflow-next-step-cta');
    expect(cta.className).toContain('border-warning');
    fireEvent.click(cta);
    expect(store.activateWorkflowAgent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Start anyway' }));
    expect(store.activateWorkflowAgent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: 'agent-1',
      focus: 'agent',
      bypassGate: true,
    });
  });

  it('forces past a stuck step only after an explicit confirmation', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'failed'), agent(1, 'pending')] };
    renderAdvance();

    fireEvent.click(screen.getByTestId('workflow-force-next-step-cta'));
    expect(store.skipStuckStepAndAdvance).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText(/skip and continue/i));
    expect(store.skipStuckStepAndAdvance).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      onlyWhenBlocked: true,
    });
  });

  it('asks the failed agent to check completion without skipping its output', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'failed'), agent(1, 'pending')] };
    renderAdvance();

    fireEvent.click(screen.getByRole('button', { name: 'Check completion' }));

    expect(store.recoverStuckStep).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
    });
    expect(store.skipStuckStepAndAdvance).not.toHaveBeenCalled();
  });

  it('renders nothing at all while autorun drives the run, controls live on the run card', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'pending')] };
    const { container } = renderAdvance(buildRun({ autoRun: true }));

    expect(container.innerHTML).toBe('');
    expect(screen.queryByTestId('workflow-autorun-toggle')).toBeNull();
    expect(screen.queryByTestId('workflow-next-step-cta')).toBeNull();
    expect(screen.queryByTestId('workflow-force-next-step-cta')).toBeNull();
    expect(screen.queryByTestId('workflow-next-step-blocked')).toBeNull();
  });

  it('offers the manual advance on a stopped run instead of an autorun switch', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'pending')] };
    renderAdvance(
      buildRun({ autoRun: false, orchestrationStop: { kind: 'operator', message: 'stopped' } }),
    );

    expect(screen.queryByTestId('workflow-autorun-toggle')).toBeNull();
    expect(screen.getByTestId('workflow-next-step-cta')).toBeDefined();
  });

  it('offers no resume of its own on a stopped dynamic run, the orchestrator card owns it', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'pending')] };
    renderAdvance(
      buildRun({
        autoRun: false,
        executionMode: 'dynamic',
        orchestrationStop: { kind: 'operator', message: 'stopped' },
      }),
    );

    expect(screen.queryByTestId('chat-workflow-orchestrator-resume')).toBeNull();
    expect(screen.getByTestId('workflow-next-step-cta')).toBeDefined();
  });

  it('falls through to the manual advance CTA on a provider-failure stop, same as before this PR', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'pending')] };
    renderAdvance(
      buildRun({
        autoRun: false,
        orchestrationStop: { kind: 'failure', message: 'provider died' },
      }),
    );

    expect(screen.queryByTestId('workflow-autorun-toggle')).toBeNull();
    expect(screen.queryByTestId('chat-workflow-orchestrator-resume')).toBeNull();
    expect(screen.getByTestId('workflow-next-step-cta')).toBeDefined();
  });

  it('falls through to the manual advance CTA on a budget stop, same as before this PR', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'pending')] };
    renderAdvance(
      buildRun({ autoRun: false, orchestrationStop: { kind: 'budget', message: 'cap' } }),
    );

    expect(screen.queryByTestId('workflow-autorun-toggle')).toBeNull();
    expect(screen.getByTestId('workflow-next-step-cta')).toBeDefined();
  });

  it('keeps the skip control under autorun once a step has failed', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'failed'), agent(1, 'pending')] };
    renderAdvance(buildRun({ autoRun: true }));

    expect(screen.getByTestId('workflow-force-next-step-cta')).toBeDefined();
  });

  it('names the blocker and frees the button when the engine rejects the advance', async () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'pending')] };
    store.activateWorkflowAgent.mockRejectedValue(new WorkflowGateError({ reason: 'questions' }));
    renderAdvance();

    fireEvent.click(screen.getByTestId('workflow-next-step-cta'));

    await waitFor(() => expect(store.emitNotification).toHaveBeenCalledTimes(1));
    expect(store.emitNotification).toHaveBeenCalledWith(
      'error',
      'warning',
      'workflow step held back',
      'Open questions are waiting for an answer.',
      { sessionId: SESSION_ID },
    );
    await waitFor(() =>
      expect(screen.getByTestId('workflow-next-step-cta').hasAttribute('disabled')).toBe(false),
    );
  });

  it('shows the routing frozen on the pending agent, not the one preferences resolve today', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'pending')] };
    const withoutOverride = render(
      <WorkflowAdvance sessionId={SESSION_ID} run={buildRun()} workflow={workflow} />,
    );
    const defaultLabel = withoutOverride
      .getByTestId('workflow-next-step-cta')
      .getAttribute('aria-label');
    withoutOverride.unmount();

    store.agentModelOverride = { 'agent-1': FROZEN_MODEL };
    store.agentEffortOverride = { 'agent-1': 'xhigh' };
    renderAdvance();

    const label = screen.getByTestId('workflow-next-step-cta').getAttribute('aria-label');
    expect(label).toContain(getModelDescriptor(FROZEN_MODEL)?.label ?? FROZEN_MODEL);
    expect(label).toContain('xhigh effort');
    expect(label).not.toBe(defaultLabel);
  });

  it('renders nothing once every step is done', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'completed')] };
    const { container } = renderAdvance();

    expect(container.innerHTML).toBe('');
  });
});
