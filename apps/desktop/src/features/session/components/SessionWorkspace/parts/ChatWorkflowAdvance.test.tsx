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
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

type StoreSession = {
  id: string;
  workflowRuns: ReadonlyArray<{ id: string; autoRun: boolean }>;
};

type Store = {
  sessionPhaseRuns: Record<string, ReadonlyArray<Agent>>;
  agentTurnState: Record<string, { kind: string }>;
  summarizerStatus: Record<string, { status: string }>;
  sessions: ReadonlyArray<StoreSession>;
  agentModelOverride: Record<string, string>;
  agentProviderOverride: Record<string, ProviderId>;
  agentEffortOverride: Record<string, string>;
  activateWorkflowAgent: ReturnType<typeof vi.fn>;
  skipStuckStepAndAdvance: ReturnType<typeof vi.fn>;
  emitNotification: ReturnType<typeof vi.fn>;
};

const { store, gate } = vi.hoisted(() => ({
  store: {
    sessionPhaseRuns: {},
    agentTurnState: {},
    summarizerStatus: {},
    sessions: [],
    agentModelOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
    activateWorkflowAgent: vi.fn(async () => undefined),
    skipStuckStepAndAdvance: vi.fn(async () => undefined),
    emitNotification: vi.fn(async () => undefined),
  } as Store,
  gate: { hasOpenQuestions: false },
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: Store) => T) => selector(store),
  useSessionOpenQuestions: () => [],
}));

vi.mock('../../../../context/openQuestionsGate', () => ({
  workflowRunHasOpenQuestions: () => gate.hasOpenQuestions,
}));

import { ChatWorkflowAdvance } from './ChatWorkflowAdvance';
import { WorkflowGateError } from '../../../../../store/slices/workflows/workflowActivationGate';

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

const renderStrip = () =>
  render(<ChatWorkflowAdvance sessionId={SESSION_ID} workflowRunId={RUN_ID} workflow={workflow} />);

const withAutoRun = (autoRun: boolean): ReadonlyArray<StoreSession> => [
  { id: SESSION_ID, workflowRuns: [{ id: RUN_ID, autoRun }] },
];

beforeEach(() => {
  store.sessionPhaseRuns = {};
  store.agentTurnState = {};
  store.summarizerStatus = {};
  store.sessions = withAutoRun(false);
  store.agentModelOverride = {};
  store.agentProviderOverride = {};
  store.agentEffortOverride = {};
  store.activateWorkflowAgent.mockReset();
  store.activateWorkflowAgent.mockResolvedValue(undefined);
  store.skipStuckStepAndAdvance.mockReset();
  store.emitNotification.mockReset();
  store.emitNotification.mockResolvedValue(undefined);
  gate.hasOpenQuestions = false;
});

afterEach(cleanup);

describe('ChatWorkflowAdvance', () => {
  it('starts the next step agent when nothing blocks', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'pending')] };
    renderStrip();

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
    renderStrip();

    expect(screen.getByTestId('workflow-next-step-blocked')).toBeDefined();
    expect(screen.getByTestId('workflow-next-step-cta').getAttribute('title')).toMatch(
      /step summary is still being written/i,
    );
  });

  it('warns and confirms while the predecessor turn is still running', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'pending')] };
    store.agentTurnState = { 'agent-0': { kind: 'running' } };
    renderStrip();

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
    renderStrip();

    fireEvent.click(screen.getByTestId('workflow-force-next-step-cta'));
    expect(store.skipStuckStepAndAdvance).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText(/skip and continue/i));
    expect(store.skipStuckStepAndAdvance).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      onlyWhenBlocked: true,
    });
  });

  it('offers no manual advance while autorun drives the run', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'pending')] };
    store.sessions = withAutoRun(true);
    const { container } = renderStrip();

    expect(container.innerHTML).toBe('');
  });

  it('keeps the skip control under autorun once a step has failed', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'failed'), agent(1, 'pending')] };
    store.sessions = withAutoRun(true);
    renderStrip();

    expect(screen.getByTestId('workflow-force-next-step-cta')).toBeDefined();
  });

  it('names the blocker and frees the button when the engine rejects the advance', async () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'pending')] };
    store.activateWorkflowAgent.mockRejectedValue(new WorkflowGateError({ reason: 'questions' }));
    renderStrip();

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
      <ChatWorkflowAdvance sessionId={SESSION_ID} workflowRunId={RUN_ID} workflow={workflow} />,
    );
    const defaultLabel = withoutOverride
      .getByTestId('workflow-next-step-cta')
      .getAttribute('aria-label');
    withoutOverride.unmount();

    store.agentModelOverride = { 'agent-1': FROZEN_MODEL };
    store.agentEffortOverride = { 'agent-1': 'xhigh' };
    renderStrip();

    const label = screen.getByTestId('workflow-next-step-cta').getAttribute('aria-label');
    expect(label).toContain(getModelDescriptor(FROZEN_MODEL)?.label ?? FROZEN_MODEL);
    expect(label).toContain('xhigh effort');
    expect(label).not.toBe(defaultLabel);
  });

  it('renders nothing once every step is done', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [agent(0, 'completed'), agent(1, 'completed')] };
    const { container } = renderStrip();

    expect(container.innerHTML).toBe('');
  });
});
