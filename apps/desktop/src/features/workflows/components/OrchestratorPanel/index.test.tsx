// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  SessionId,
  Step,
  StepId,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';

const { storeState } = vi.hoisted(() => ({
  storeState: {} as Record<string, unknown>,
}));

vi.mock('../../../../store/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector(storeState),
}));

import { OrchestratorPanel } from './index';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;

const run = (overrides: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  ...overrides,
});

const agent = (
  ordinal: number,
  status: Agent['status'],
  overrides: Partial<Agent> = {},
): Agent => ({
  id: `agent-${ordinal}` as AgentId,
  sessionId: SESSION_ID,
  stepId: `step-${ordinal}` as StepId,
  workflowRunId: RUN_ID,
  ordinal,
  name: `step ${ordinal}`,
  status,
  ...overrides,
});

const step = (ordinal: number, orchestratorReason: string): Step =>
  ({
    id: `step-${ordinal}` as StepId,
    workflowId: WORKFLOW_ID,
    ordinal,
    name: `step ${ordinal}`,
    promptPrefix: '',
    orchestratorReason,
  }) as Step;

const EMPTY_AGENTS: ReadonlyArray<Agent> = [];
const EMPTY_STEPS: ReadonlyArray<Step> = [];

type RenderParams = {
  readonly runOverride?: WorkflowRun;
  readonly agents?: ReadonlyArray<Agent>;
  readonly steps?: ReadonlyArray<Step>;
  readonly costUsd?: number;
  readonly isOrchestrating?: boolean;
};

const renderPanel = ({
  runOverride = run(),
  agents = EMPTY_AGENTS,
  steps = EMPTY_STEPS,
  costUsd = 0,
  isOrchestrating = false,
}: RenderParams = {}) =>
  render(
    <OrchestratorPanel
      sessionId={SESSION_ID}
      run={runOverride}
      agents={agents}
      steps={steps}
      costUsd={costUsd}
      isOrchestrating={isOrchestrating}
    />,
  );

const sentence = () => screen.getByTestId('orchestrator-state').textContent ?? '';

beforeEach(() => {
  Object.assign(storeState, {
    orchestrateNextStep: vi.fn(async () => undefined),
    retryWorkflowOrchestration: vi.fn(async () => undefined),
    continueWorkflowRun: vi.fn(async () => undefined),
    setWorkflowOrchestratorHints: vi.fn(async () => undefined),
    setWorkflowOrchestratorRouting: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
    sessionOpenQuestions: {},
    sessions: [],
    workspaceOverrides: {},
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'missing' },
    ],
  });
});

afterEach(cleanup);

describe('OrchestratorPanel state ladder', () => {
  it('asks for the first step on a run that has not started', () => {
    renderPanel();

    expect(sentence()).toContain('Ready to plan the first step');
    expect(screen.getByTestId('workflow-orchestrate-next-cta').textContent).toContain(
      'Decide next step',
    );
  });

  it('says where the run got to before offering the next decision', () => {
    renderPanel({ agents: [agent(0, 'completed'), agent(1, 'completed')] });

    expect(sentence()).toContain('Step 2 done · ready to continue');
    expect(screen.getByTestId('workflow-orchestrate-next-cta')).toBeDefined();
  });

  it('offers no next step control while autorun drives the run', () => {
    renderPanel({ runOverride: run({ autoRun: true }), agents: [agent(0, 'completed')] });

    expect(sentence()).toContain('Continuing automatically');
    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();
  });

  it('moves its own border while it decides, with no manual control', () => {
    renderPanel({ isOrchestrating: true });

    expect(sentence()).toContain('Choosing the next step');
    expect(screen.getByTestId('orchestrator-panel').className).toContain('spin-border');
    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();
    expect(screen.getByTestId('orchestrator-hints-toggle')).toBeDefined();
  });

  it('names the step it waits on and how long it has been running', () => {
    const startedAt = new Date(Date.now() - 90_000).toISOString() as IsoDateTime;
    renderPanel({
      agents: [
        agent(0, 'completed'),
        agent(1, 'running', { name: 'implement language-id remap', startedAt }),
      ],
    });

    expect(sentence()).toContain('Waiting on step 2 · implement language-id remap');
    expect(screen.getByTestId('orchestrator-elapsed').textContent).toContain('1m 30s');
    expect(screen.getByTestId('orchestrator-panel').className).not.toContain('spin-border');
    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();
  });

  it('sends the user to the questions lens when one gates the run', () => {
    Object.assign(storeState, {
      sessionOpenQuestions: {
        [SESSION_ID]: [{ id: 'q-1', status: 'open', workflowRunId: RUN_ID }],
      },
    });
    renderPanel({ agents: [agent(0, 'completed')] });

    expect(sentence()).toContain('Paused · an open question needs your answer');
    fireEvent.click(screen.getByTestId('orchestrator-answer-question'));

    expect(storeState['setActiveLens']).toHaveBeenCalledWith(SESSION_ID, 'questions');
  });

  it('reads a budget pause as a pause, not as a failure', () => {
    renderPanel({
      runOverride: run({
        orchestrationStop: {
          kind: 'budget',
          message: 'the budget cap is reached, raise it in Budget to keep this run going',
        },
      }),
    });

    expect(sentence()).toContain('Paused · session budget cap reached');
    expect(screen.getByTestId('orchestrator-review-budget')).toBeDefined();
    expect(screen.queryByTestId('orchestrator-retry')).toBeNull();
  });

  it('reads a budget pause worded differently as a pause all the same', () => {
    renderPanel({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'any other wording' } }),
    });

    expect(sentence()).toContain('Paused · session budget cap reached');
    expect(screen.getByTestId('orchestrator-review-budget')).toBeDefined();
  });

  it('shows the failure with its reason and offers a retry', () => {
    renderPanel({
      runOverride: run({
        orchestrationStop: {
          kind: 'failure',
          message: 'usage limit reached (anthropic/haiku-4.5)',
        },
      }),
    });

    expect(sentence()).toContain('Last decision failed');
    expect(screen.queryByTestId('orchestrator-review-budget')).toBeNull();
    expect(screen.getByTestId('orchestrator-detail').textContent).toContain('usage limit reached');
    fireEvent.click(screen.getByTestId('orchestrator-retry'));

    expect(storeState['retryWorkflowOrchestration']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('asks for a human call when the orchestrator stopped the run', () => {
    renderPanel({
      runOverride: run({
        orchestrationOutcome: 'blocked',
        orchestrationReason: 'the migration needs a human call',
      }),
    });

    expect(sentence()).toContain('Stopped · needs a human call');
    expect(screen.getByTestId('orchestrator-detail').textContent).toContain('needs a human call');
    expect(screen.getByTestId('orchestrator-retry')).toBeDefined();
  });

  it('closes a complete run with its step count and spend, still extendable', () => {
    renderPanel({
      runOverride: run({ orchestrationOutcome: 'done' }),
      agents: [agent(0, 'completed'), agent(1, 'completed'), agent(2, 'completed')],
      costUsd: 1.28,
    });

    expect(sentence()).toContain('Run complete · 3 steps · $1.28');
    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();

    fireEvent.click(screen.getByTestId('orchestrator-continue-toggle'));
    fireEvent.change(screen.getByTestId('orchestrator-continue-note'), {
      target: { value: 'tests are missing' },
    });
    fireEvent.click(screen.getByTestId('orchestrator-continue-confirm'));

    expect(storeState['continueWorkflowRun']).toHaveBeenCalledWith(
      SESSION_ID,
      RUN_ID,
      'tests are missing',
    );
  });
});

describe('OrchestratorPanel strip', () => {
  it('carries the routing pill on the orchestrator title row, unlabelled', () => {
    renderPanel();

    expect(screen.getByTestId('orchestrator-routing').textContent).not.toContain('decided by');
    expect(screen.queryByTestId('step-routing')).toBeNull();
  });

  it('saves runtime hints from the disclosure', () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('orchestrator-hints-toggle'));
    fireEvent.change(screen.getByTestId('orchestrator-hints-input'), {
      target: { value: 'ignore the website' },
    });
    fireEvent.click(screen.getByTestId('orchestrator-hints-save'));

    expect(storeState['setWorkflowOrchestratorHints']).toHaveBeenCalledWith(
      SESSION_ID,
      RUN_ID,
      'ignore the website',
    );
  });

  it('folds the decisions into the strip behind a count', () => {
    renderPanel({ steps: [step(0, 'the codebase is unknown'), step(1, 'the plan is settled')] });

    const strip = screen.getByTestId('orchestrator-panel');
    const decisions = screen.getByTestId('workflow-orchestrator-tldr');
    expect(strip.contains(decisions)).toBe(true);
    expect(screen.queryByText('the codebase is unknown')).toBeNull();

    const toggle = screen.getByTestId('workflow-orchestrator-decisions-toggle');
    expect(toggle.textContent).toContain('2 decisions');

    fireEvent.click(toggle);
    expect(screen.getByText('the codebase is unknown')).toBeDefined();

    fireEvent.click(toggle);
    expect(screen.queryByText('the codebase is unknown')).toBeNull();
  });
});
