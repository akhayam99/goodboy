// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  OrchestratorHint,
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
  isBlocking: false,
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

const HINT_AT = '2026-09-23T10:00:00.000Z' as IsoDateTime;

const hint = (over: Partial<OrchestratorHint>): OrchestratorHint => ({
  id: 'hint',
  text: 'keep it to one PR',
  createdAt: HINT_AT,
  ...over,
});

const sentence = () => screen.getByTestId('orchestrator-state').textContent ?? '';

const openHints = () => {
  fireEvent.click(screen.getByTestId('orchestrator-hints-toggle'));
};

beforeEach(() => {
  Object.assign(storeState, {
    orchestrateNextStep: vi.fn(async () => undefined),
    retryWorkflowOrchestration: vi.fn(async () => undefined),
    continueWorkflowRun: vi.fn(async () => undefined),
    addWorkflowOrchestratorHint: vi.fn(async () => undefined),
    removeWorkflowOrchestratorHint: vi.fn(async () => undefined),
    setWorkflowOrchestratorRouting: vi.fn(async () => undefined),
    setWorkflowRunAutoRun: vi.fn(async () => undefined),
    stopWorkflowRunNow: vi.fn(async () => undefined),
    setWorkflowRunSpendLimit: vi.fn(async () => undefined),
    sessionOpenQuestions: {},
    orchestratorReadingHints: {},
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

    expect(sentence()).toContain('Paused · autorun is off');
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

  it('leaves the failed step recovery to the next action strip above it', () => {
    renderPanel({
      runOverride: run({ autoRun: true }),
      agents: [agent(0, 'completed'), agent(1, 'failed')],
    });

    expect(screen.queryByRole('button', { name: /skip/i })).toBeNull();
    expect(screen.getByTestId('orchestrator-actions').textContent).toBe('Hints');
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
      runOverride: run({ autoRun: true }),
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

  it('confirms Stop now and dispatches the hard stop while autorun is on', () => {
    renderPanel({
      runOverride: run({ autoRun: true }),
      agents: [agent(0, 'running')],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Stop now' }));

    const confirm = screen.getByRole('group', { name: 'Stop now?' });
    expect(confirm.textContent).toContain(
      'The step in flight is cancelled and marked skipped. Everything it already wrote is kept.',
    );
    fireEvent.click(within(confirm).getByRole('button', { name: 'Stop now' }));

    expect(storeState['stopWorkflowRunNow']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('keeps Stop now available during a graceful pause', () => {
    renderPanel({ agents: [agent(0, 'running')] });

    expect(sentence()).toContain('Finishing the step in flight · autorun is off');
    expect(screen.getByRole('button', { name: 'Stop now' })).toBeDefined();
  });

  it('names a gating question and leaves the answer to the next action strip', () => {
    Object.assign(storeState, {
      sessionOpenQuestions: {
        [SESSION_ID]: [{ id: 'q-1', status: 'open', workflowRunId: RUN_ID }],
      },
    });
    renderPanel({ agents: [agent(0, 'completed')] });

    expect(sentence()).toContain('Paused · an open question needs your answer');
    expect(screen.queryByRole('button', { name: /answer/i })).toBeNull();
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
    expect(screen.queryByRole('button', { name: /answer/i })).toBeNull();
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

    expect(sentence()).toContain('Paused · autorun is off');
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

    fireEvent.click(screen.getByTestId('orchestrator-continue'));

    expect(storeState['continueWorkflowRun']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });
});

describe('OrchestratorPanel card', () => {
  it('keeps the model, autorun and stop in the header, and the call to action below', () => {
    renderPanel({ agents: [agent(0, 'running')], runOverride: run({ autoRun: true }) });

    const header = screen.getByTestId('orchestrator-header');
    expect(header.contains(screen.getByTestId('orchestrator-routing'))).toBe(true);
    expect(header.contains(screen.getByTestId('workflow-autorun-toggle'))).toBe(true);
    expect(header.contains(screen.getByRole('button', { name: 'Stop now' }))).toBe(true);
    expect(
      screen
        .getByTestId('orchestrator-actions')
        .contains(screen.getByTestId('orchestrator-hints-toggle')),
    ).toBe(true);
  });

  it('counts the hints on their toggle', () => {
    renderPanel({
      runOverride: run({ orchestratorHints: [hint({ id: 'a' }), hint({ id: 'b' })] }),
    });

    expect(screen.getByTestId('orchestrator-hints-toggle').textContent).toContain('Hints (2)');
  });
});

describe('OrchestratorPanel strip', () => {
  it('carries the routing pill on the orchestrator title row, unlabelled', () => {
    renderPanel();

    expect(screen.getByTestId('orchestrator-routing').textContent).not.toContain('decided by');
    expect(screen.queryByTestId('step-routing')).toBeNull();
  });

  it('queues a hint from the disclosure', () => {
    renderPanel();

    openHints();
    fireEvent.change(screen.getByTestId('orchestrator-hint-input'), {
      target: { value: 'ignore the website' },
    });
    fireEvent.click(screen.getByTestId('orchestrator-hint-queue'));

    expect(storeState['addWorkflowOrchestratorHint']).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      text: 'ignore the website',
      delivery: 'queue',
    });
  });

  it('sends a hint to be read now', () => {
    renderPanel();

    openHints();
    fireEvent.change(screen.getByTestId('orchestrator-hint-input'), {
      target: { value: 'look at the payout domain first' },
    });
    fireEvent.click(screen.getByTestId('orchestrator-hint-now'));

    expect(storeState['addWorkflowOrchestratorHint']).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      text: 'look at the payout domain first',
      delivery: 'now',
    });
  });

  it('says what read now does in the state the run is in', () => {
    renderPanel();
    openHints();
    expect(screen.getByTestId('orchestrator-hint-timing').textContent).toContain(
      'asks for a decision right away',
    );

    cleanup();
    renderPanel({ agents: [agent(0, 'running')] });
    openHints();
    expect(screen.getByTestId('orchestrator-hint-timing').textContent).toContain(
      'stops the step in flight',
    );

    cleanup();
    renderPanel({ isOrchestrating: true });
    openHints();
    expect(screen.getByTestId('orchestrator-hint-timing').textContent).toContain(
      'Read now restarts this one with your hint.',
    );
  });

  it('keeps hint delivery open while the orchestrator is deciding', () => {
    renderPanel({ isOrchestrating: true });

    openHints();
    const input = screen.getByTestId('orchestrator-hint-input');
    expect(input.hasAttribute('disabled')).toBe(false);
    fireEvent.change(input, { target: { value: 'skip the visual suite' } });
    expect(screen.getByTestId('orchestrator-hint-queue').hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByTestId('orchestrator-hint-now'));

    expect(storeState['addWorkflowOrchestratorHint']).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      text: 'skip the visual suite',
      delivery: 'now',
    });
  });

  it('clears the field as soon as a hint is sent, keeping the focus there', () => {
    storeState['addWorkflowOrchestratorHint'] = vi.fn(() => new Promise(() => undefined));
    renderPanel();

    openHints();
    const input = screen.getByTestId('orchestrator-hint-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ignore the website' } });
    fireEvent.click(screen.getByTestId('orchestrator-hint-queue'));

    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('puts the text back when the hint could not be saved', async () => {
    storeState['addWorkflowOrchestratorHint'] = vi.fn(async () => {
      throw new Error('disk full');
    });
    storeState['reportError'] = vi.fn(async () => undefined);
    renderPanel();

    openHints();
    const input = screen.getByTestId('orchestrator-hint-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ignore the website' } });
    fireEvent.click(screen.getByTestId('orchestrator-hint-now'));

    expect(input.value).toBe('');
    await waitFor(() => expect(input.value).toBe('ignore the website'));
    expect(storeState['reportError']).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't save the hint" }),
    );
  });

  it('tells a queued hint from one the decision is reading now', () => {
    storeState['orchestratorReadingHints'] = { [RUN_ID]: ['reading'] };
    renderPanel({
      isOrchestrating: true,
      runOverride: run({
        orchestratorHints: [
          hint({ id: 'reading', text: 'skip the visual suite' }),
          hint({ id: 'queued', text: 'prefer Sonnet 5 for the review' }),
        ],
      }),
    });

    openHints();

    const rows = screen.getAllByTestId('orchestrator-hint-row');
    expect(rows.map((row) => row.getAttribute('data-status'))).toEqual(['queued', 'reading']);
    expect(rows[0]?.textContent).toContain('Waits for the next decision');
    expect(rows[1]?.textContent).toContain('Reading now');
    const [queuedRemove, readingRemove] = screen.getAllByRole('button', { name: 'Remove hint' });
    expect(queuedRemove?.hasAttribute('disabled')).toBe(false);
    expect(readingRemove?.hasAttribute('disabled')).toBe(true);
    expect(sentence()).toContain('1 hint queued');
  });

  it('keeps read hints behind a count with the steps that read them', () => {
    renderPanel({
      runOverride: run({
        orchestratorHints: [
          hint({ id: 'read-1', text: 'keep it to one PR', consumedAt: HINT_AT, consumedAtStep: 2 }),
          hint({ id: 'read-2', text: 'map ledger first', consumedAt: HINT_AT, consumedAtStep: 3 }),
          hint({ id: 'queued', text: 'run a reviewer first' }),
        ],
      }),
    });

    openHints();

    expect(
      screen.getAllByTestId('orchestrator-hint-row').map((row) => row.getAttribute('data-status')),
    ).toEqual(['queued']);
    expect(screen.getByTestId('orchestrator-hint-read-steps').textContent).toBe(
      'Read at step 2, 3',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show read (2)' }));

    const rows = screen.getAllByTestId('orchestrator-hint-row');
    expect(rows.map((row) => row.getAttribute('data-status'))).toEqual(['queued', 'read', 'read']);
    expect(rows[1]?.textContent).toContain('Read at step 3');

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove hint' })[0]!);
    expect(storeState['removeWorkflowOrchestratorHint']).toHaveBeenCalledWith(
      SESSION_ID,
      RUN_ID,
      'queued',
    );
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

  it('counts queued hints without spending a button on them', () => {
    renderPanel({
      runOverride: run({
        orchestratorHints: [
          hint({ id: 'read', consumedAt: HINT_AT, consumedAtStep: 1 }),
          hint({ id: 'queued-1' }),
          hint({ id: 'queued-2' }),
        ],
      }),
    });

    const text = screen.getByTestId('orchestrator-panel').textContent ?? '';
    expect(text).toContain('2 hints queued');
  });

  it('puts every control in the open, with no overflow menu left to hunt through', () => {
    renderPanel({ agents: [agent(0, 'completed')] });

    expect(screen.queryByRole('button', { name: /orchestrator options/i })).toBeNull();
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(screen.getByRole('button', { name: /decide next step/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^hints$/i })).toBeDefined();
    expect(screen.getByTestId('workflow-autorun-toggle')).toBeDefined();
  });

  it('keeps money controls off the card while the run is not paused on budget', () => {
    renderPanel({ agents: [agent(0, 'completed')] });

    expect(screen.queryByTestId('orchestrator-budget')).toBeNull();
    expect(screen.queryByTestId('run-spend-limit-trigger')).toBeNull();
  });

  it('leaves one spend limit control on a budget pause and no budget button', () => {
    renderPanel({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'cap reached' } }),
    });

    expect(screen.getAllByTestId('run-spend-limit-trigger')).toHaveLength(1);
    expect(screen.queryByTestId('orchestrator-budget')).toBeNull();
  });

  it('renders one budget control when the session budget pauses the run', () => {
    storeState['budgetAlerts'] = [{ kind: 'session-exceeded', sessionId: SESSION_ID }];
    renderPanel({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'cap reached' } }),
    });

    expect(screen.getByTestId('orchestrator-review-budget')).toBeDefined();
    expect(screen.queryByTestId('orchestrator-budget')).toBeNull();
  });

  it('keeps the spend limit out of the state sentence', () => {
    renderPanel({ runOverride: run({ spendLimitUsd: 12, spendLimitMode: 'notify' }) });

    expect(screen.queryByTestId('orchestrator-spend-limit')).toBeNull();
    expect(screen.getByTestId('orchestrator-panel').textContent).not.toContain('Spend limit');
  });

  it('sends a session budget pause to the session spend scope, not to the run limit', () => {
    storeState['budgetAlerts'] = [{ kind: 'session-exceeded', sessionId: SESSION_ID }];
    renderPanel({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'cap reached' } }),
    });
    const opened = vi.fn();
    window.addEventListener('goodboy:open-impact-studio', opened);
    fireEvent.click(screen.getByTestId('orchestrator-review-budget'));
    window.removeEventListener('goodboy:open-impact-studio', opened);

    expect(opened).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('run-spend-limit-trigger')).toBeNull();
    expect(screen.queryByTestId('orchestrator-budget')).toBeNull();
  });

  it('saves a spend limit for the run from the budget pause', () => {
    renderPanel({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'cap reached' } }),
    });

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
