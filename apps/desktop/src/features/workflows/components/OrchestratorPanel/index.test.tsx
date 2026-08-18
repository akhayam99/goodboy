// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  SessionId,
  Step,
  StepId,
  WorkflowId,
  WorkflowOrchestrationStop,
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

const openQuestion = (): OpenQuestion => ({
  id: 'oq-1' as OpenQuestionId,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  text: 'which database?',
  suggestedAnswers: [],
  userAnswer: null,
  status: 'open',
  createdAt: '2025-01-01T00:00:00.000Z' as IsoDateTime,
});

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

const openHints = () => {
  fireEvent.click(screen.getByTestId('orchestrator-hints-toggle'));
};

beforeEach(() => {
  Object.assign(storeState, {
    orchestrateNextStep: vi.fn(async () => undefined),
    retryWorkflowOrchestration: vi.fn(async () => undefined),
    continueWorkflowRun: vi.fn(async () => undefined),
    setWorkflowOrchestratorHints: vi.fn(async () => undefined),
    setWorkflowOrchestratorRouting: vi.fn(async () => undefined),
    setWorkflowRoleModelOverrides: vi.fn(async () => undefined),
    skipStuckStepAndAdvance: vi.fn(async () => undefined),
    setWorkflowRunAutoRun: vi.fn(async () => undefined),
    stopWorkflowRunNow: vi.fn(async () => undefined),
    setWorkflowRunSpendLimit: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
    sessionOpenQuestions: {},
    budgetAlerts: [],
    sessionTelemetry: {},
    sessionPhaseRuns: {},
    agentRunHistory: {},
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
    fireEvent.click(screen.getByTestId('workflow-orchestrate-next-cta'));

    expect(storeState['orchestrateNextStep']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('says where the run got to before offering the next decision', () => {
    renderPanel({ agents: [agent(0, 'completed'), agent(1, 'completed')] });

    expect(sentence()).toContain('Step 2 done · ready to continue');
    fireEvent.click(screen.getByTestId('workflow-orchestrate-next-cta'));

    expect(storeState['orchestrateNextStep']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('offers no next step control while autorun drives the run', () => {
    renderPanel({ runOverride: run({ autoRun: true }), agents: [agent(0, 'completed')] });

    expect(sentence()).toContain('Continuing automatically');
    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();
  });

  it('says a step failed instead of claiming autorun is still continuing', () => {
    renderPanel({
      runOverride: run({ autoRun: true }),
      agents: [agent(0, 'completed'), agent(1, 'failed', { name: 'implement the remap' })],
    });

    expect(sentence()).not.toContain('Continuing automatically');
    expect(sentence()).toContain('Stopped · step 2 failed · implement the remap');
    expect(screen.getByTestId('orchestrator-panel').getAttribute('data-phase')).toBe('step-failed');
    expect(screen.getByTestId('orchestrator-detail').textContent).toContain(
      'Nothing advances until this step is skipped.',
    );
    expect(screen.getByTestId('orchestrator-panel').className).not.toContain('spin-border');
  });

  it('gets a run frozen on a failed step moving again', () => {
    renderPanel({
      runOverride: run({ autoRun: true }),
      agents: [agent(0, 'completed'), agent(1, 'failed')],
    });

    fireEvent.click(screen.getByTestId('orchestrator-skip-failed-step'));

    expect(storeState['skipStuckStepAndAdvance']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('moves its own border while it decides, with no manual control', () => {
    renderPanel({ isOrchestrating: true });

    expect(sentence()).toContain('Choosing the next step');
    expect(screen.getByTestId('orchestrator-panel').className).toContain('spin-border');
    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();
    expect(screen.getByRole('button', { name: /hints/i })).toBeDefined();
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

    expect(sentence()).toContain('Paused · budget cap reached');
    expect(screen.queryByTestId('orchestrator-retry')).toBeNull();
    fireEvent.click(screen.getByTestId('run-spend-limit-trigger'));

    expect(screen.getByRole('dialog', { name: 'Spend limit for this run' })).toBeDefined();
  });

  it('reads a budget pause worded differently as a pause all the same', () => {
    renderPanel({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'any other wording' } }),
    });

    expect(sentence()).toContain('Paused · budget cap reached');
    expect(screen.getByTestId('run-spend-limit-trigger').textContent).toContain(
      'Raise the spend limit',
    );
  });

  it('reads a question stop as a question to answer, with no retry on offer', () => {
    storeState['sessionOpenQuestions'] = { [SESSION_ID]: [openQuestion()] };
    renderPanel({
      runOverride: run({
        orchestrationStop: {
          kind: 'questions',
          message: 'Open questions are waiting for an answer.',
        },
      }),
    });

    expect(sentence()).toContain('Paused · an open question needs your answer');
    expect(screen.queryByTestId('orchestrator-retry')).toBeNull();
    fireEvent.click(screen.getByTestId('orchestrator-answer-question'));

    expect(storeState['setActiveLens']).toHaveBeenCalledWith(SESSION_ID, 'questions');
  });

  it('offers the next step again once the question behind the stop is answered', () => {
    renderPanel({
      runOverride: run({
        orchestrationStop: {
          kind: 'questions',
          message: 'Open questions are waiting for an answer.',
        },
      }),
      agents: [agent(0, 'completed')],
    });

    expect(sentence()).toContain('ready to continue');
    fireEvent.click(screen.getByTestId('workflow-orchestrate-next-cta'));

    expect(storeState['orchestrateNextStep']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('reads an operator stop as a stop, and resumes hands-free from it', () => {
    renderPanel({
      runOverride: run({
        orchestrationStop: {
          kind: 'operator',
          message: 'You stopped this run. The step in flight was skipped.',
        },
      }),
      agents: [agent(0, 'skipped')],
    });

    expect(sentence()).toContain('Stopped by you');
    expect(screen.queryByTestId('orchestrator-retry')).toBeNull();
    fireEvent.click(screen.getByTestId('orchestrator-resume'));

    expect(storeState['retryWorkflowOrchestration']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('says it is stopping instead of still choosing, when stopped mid-decision', () => {
    renderPanel({
      runOverride: run({
        orchestrationStop: {
          kind: 'operator',
          message: 'You stopped this run. The step in flight was skipped.',
        },
      }),
      agents: [agent(0, 'skipped')],
      isOrchestrating: true,
    });

    expect(sentence()).not.toContain('Choosing the next step');
    expect(sentence()).toContain('Stopping');
    expect(screen.getByTestId('orchestrator-panel').getAttribute('data-phase')).toBe('stopping');
    expect(screen.getByTestId('orchestrator-panel').className).not.toContain('spin-border');
    expect(screen.queryByTestId('orchestrator-resume')).toBeNull();

    const dot = screen.getByRole('img', { name: sentence() });
    expect(dot.className).toContain('bg-warning');
    expect(dot.className).not.toContain('bg-info');
  });

  it('falls back to a generic presentation for a stop kind it does not recognize', () => {
    renderPanel({
      runOverride: run({
        orchestrationStop: {
          kind: 'legacy-manual-hold' as WorkflowOrchestrationStop['kind'],
          message: 'written by a build this app no longer ships',
        },
      }),
    });

    expect(sentence()).toContain('Stopped · reason not recognized');
    expect(screen.getByTestId('orchestrator-detail').textContent).toContain(
      'written by a build this app no longer ships',
    );
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

  it('says who decides, so an empty note is never a dead end', () => {
    renderPanel({
      runOverride: run({ orchestrationOutcome: 'done' }),
      agents: [agent(0, 'completed')],
    });

    fireEvent.click(screen.getByTestId('orchestrator-continue-toggle'));
    const drawer = screen.getByTestId('orchestrator-continue-note').parentElement;
    expect(drawer?.textContent).toContain('Not done? Say what is missing');
    expect(drawer?.textContent).toContain('Leave it empty and the orchestrator decides');
    expect(screen.getByTestId('orchestrator-continue-confirm').textContent).toContain(
      'Continue, you decide',
    );

    fireEvent.change(screen.getByTestId('orchestrator-continue-note'), {
      target: { value: 'the tests are missing' },
    });
    expect(screen.getByTestId('orchestrator-continue-confirm').textContent).toContain(
      'Continue with this note',
    );
  });

  it('opens one drawer at a time, so two fields never stack', () => {
    renderPanel({
      runOverride: run({ orchestrationOutcome: 'done' }),
      agents: [agent(0, 'completed')],
    });

    fireEvent.click(screen.getByTestId('orchestrator-continue-toggle'));
    openHints();

    expect(screen.getByTestId('orchestrator-hints-input')).toBeDefined();
    expect(screen.queryByTestId('orchestrator-continue-note')).toBeNull();
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

    openHints();
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

  it('offers to clear standing hints only once there are some', () => {
    renderPanel();
    openHints();
    expect(screen.queryByTestId('orchestrator-hints-clear')).toBeNull();

    cleanup();
    renderPanel({ runOverride: run({ orchestratorHints: 'ignore the website' }) });
    openHints();
    fireEvent.click(screen.getByTestId('orchestrator-hints-clear'));

    expect(storeState['setWorkflowOrchestratorHints']).toHaveBeenCalledWith(SESSION_ID, RUN_ID, '');
  });

  it('carries autorun in its own header, so the chat header does not need one', () => {
    renderPanel({ runOverride: run({ autoRun: true }), agents: [agent(0, 'completed')] });

    const toggle = screen.getByTestId('workflow-autorun-toggle');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(toggle);
    expect(storeState['setWorkflowRunAutoRun']).toHaveBeenCalledWith(SESSION_ID, RUN_ID, false);
  });

  it('drops the autorun switch once the run is over', () => {
    renderPanel({
      runOverride: run({ orchestrationOutcome: 'done' }),
      agents: [agent(0, 'completed')],
    });

    expect(screen.queryByTestId('workflow-autorun-toggle')).toBeNull();
  });

  it('says standing hints are on without spending a button on it', () => {
    renderPanel({ runOverride: run({ orchestratorHints: 'ignore the website' }) });

    expect(screen.getByTestId('orchestrator-panel').textContent).toContain('Standing hints on');
  });

  it('puts every control in the open, with no overflow menu left to hunt through', () => {
    renderPanel({ agents: [agent(0, 'completed')] });

    expect(screen.queryByRole('button', { name: /orchestrator options/i })).toBeNull();
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(screen.getByRole('button', { name: /decide next step/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^hints$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^budget$/i })).toBeDefined();
    expect(screen.getByTestId('workflow-autorun-toggle')).toBeDefined();
  });

  it('opens the budget from the row instead of a second review button', () => {
    renderPanel();
    const opened = vi.fn();
    window.addEventListener('goodboy:open-budget-studio', opened);
    fireEvent.click(screen.getByTestId('orchestrator-budget'));
    window.removeEventListener('goodboy:open-budget-studio', opened);

    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('leaves one spend limit control on a budget pause, with the session budget still reachable', () => {
    renderPanel({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'cap reached' } }),
    });

    expect(screen.getAllByTestId('run-spend-limit-trigger')).toHaveLength(1);
    expect(screen.getByTestId('orchestrator-budget')).toBeDefined();
  });

  it('renders one budget control when the session budget pauses the run', () => {
    storeState['budgetAlerts'] = [{ kind: 'session-exceeded', sessionId: SESSION_ID }];
    renderPanel({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'cap reached' } }),
    });

    expect(screen.getByTestId('orchestrator-review-budget')).toBeDefined();
    expect(screen.queryByTestId('orchestrator-budget')).toBeNull();
  });

  it('says what the run is allowed to spend and what happens at the limit', () => {
    renderPanel({ runOverride: run({ spendLimitUsd: 12, spendLimitMode: 'notify' }) });

    expect(screen.getByTestId('orchestrator-spend-limit').textContent).toContain(
      'Spend limit $12.00 · notifies at the limit',
    );
  });

  it('sends a session budget pause to the session budget, not to the run limit', () => {
    storeState['budgetAlerts'] = [{ kind: 'session-exceeded', sessionId: SESSION_ID }];
    renderPanel({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'cap reached' } }),
    });
    const opened = vi.fn();
    window.addEventListener('goodboy:open-budget-studio', opened);
    fireEvent.click(screen.getByTestId('orchestrator-review-budget'));
    window.removeEventListener('goodboy:open-budget-studio', opened);

    expect(opened).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('run-spend-limit-trigger')).toBeNull();
    expect(screen.queryByTestId('orchestrator-budget')).toBeNull();
  });

  it('saves a spend limit for the run from the strip', () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('run-spend-limit-trigger'));
    fireEvent.change(screen.getByTestId('spend-limit-amount'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('tab', { name: /notify/i }));
    fireEvent.click(screen.getByTestId('run-spend-limit-save'));

    expect(storeState['setWorkflowRunSpendLimit']).toHaveBeenCalledWith(
      SESSION_ID,
      RUN_ID,
      8,
      'notify',
    );
  });

  it('keeps role models behind a drawer, one row per role the orchestrator can pick', () => {
    renderPanel();
    expect(screen.queryByTestId('orchestrator-role-models')).toBeNull();

    fireEvent.click(screen.getByTestId('orchestrator-role-models-toggle'));

    const drawer = screen.getByTestId('orchestrator-role-models');
    expect(drawer.textContent).toContain('for the rest of this run');
    expect(screen.getAllByRole('group', { name: /model$/i })).toHaveLength(7);
    expect(screen.getByRole('group', { name: /implementer model/i })).toBeDefined();
  });

  it('reads the role models a run already carries', () => {
    renderPanel({
      runOverride: run({
        roleModelOverrides: {
          implementer: { providerId: 'codex', model: 'gpt-5.6', effort: 'high' },
        },
      }),
    });

    expect(screen.getByTestId('orchestrator-role-models-count').textContent).toContain(
      '1 role on a chosen model',
    );

    fireEvent.click(screen.getByTestId('orchestrator-role-models-toggle'));

    const implementer = screen.getByRole('group', { name: /implementer model/i });
    expect(implementer.textContent).toContain('GPT-5.6');
    expect(screen.getByRole('group', { name: /scout model/i }).textContent).not.toContain(
      'GPT-5.6',
    );
  });

  it('drops a role back to the workspace default from the drawer', () => {
    renderPanel({
      runOverride: run({
        roleModelOverrides: {
          implementer: { providerId: 'codex', model: 'gpt-5.6', effort: 'high' },
          scout: { providerId: 'codex', model: 'gpt-5.6', effort: 'low' },
        },
      }),
    });

    fireEvent.click(screen.getByTestId('orchestrator-role-models-toggle'));
    const implementer = screen.getByRole('group', { name: /implementer model/i });
    fireEvent.click(within(implementer).getByRole('button', { name: /reset routing override/i }));

    expect(storeState['setWorkflowRoleModelOverrides']).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      scout: { providerId: 'codex', model: 'gpt-5.6', effort: 'low' },
    });
  });

  it('opens role models instead of hints, never both', () => {
    renderPanel();

    openHints();
    fireEvent.click(screen.getByTestId('orchestrator-role-models-toggle'));

    expect(screen.getByTestId('orchestrator-role-models')).toBeDefined();
    expect(screen.queryByTestId('orchestrator-hints-input')).toBeNull();
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
