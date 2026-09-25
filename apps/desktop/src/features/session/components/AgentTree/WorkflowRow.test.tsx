// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { TERMINAL_DIM } from '@goodboy/ui';
import type { WorkflowBlockReason } from '../../../workflows/advanceGate';

type WriteDestinationProps = {
  readonly fallback?: 'automatic';
};

const storeMocks = vi.hoisted(() => ({
  renameWorkflowRun: vi.fn(async () => undefined),
  orchestratingWorkflowRuns: {} as Record<string, boolean>,
  runSpendUsd: 0,
  sessions: [] as ReadonlyArray<Record<string, unknown>>,
  sessionProjectMounts: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
  sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
  closeWorkflowRun: vi.fn(async () => undefined),
  workspaceDurationHistory: {} as Record<string, unknown>,
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useRunSpendUsd: () => storeMocks.runSpendUsd,
  useExecutedAgentRouting: () => null,
  useAppStore: <T,>(selector: (state: unknown) => T) =>
    selector({
      renameWorkflowRun: storeMocks.renameWorkflowRun,
      orchestratingWorkflowRuns: storeMocks.orchestratingWorkflowRuns,
      agentEffortOverride: {},
      sessionMounts: {},
      sessions: storeMocks.sessions,
      sessionProjectMounts: storeMocks.sessionProjectMounts,
      sessionPhaseRuns: storeMocks.sessionPhaseRuns,
      closeWorkflowRun: storeMocks.closeWorkflowRun,
      workspaceDurationHistory: storeMocks.workspaceDurationHistory,
      sessionTurnSpans: { [SESSION_ID]: [] },
      agentTurnState: {},
      providers: [],
      cliRequirements: [],
    }),
}));

vi.mock('../../../chat/components/WriteDestinationControl', () => ({
  WriteDestinationControl: ({ fallback }: WriteDestinationProps) => (
    <div data-testid="write-destination-control">{fallback}</div>
  ),
}));

vi.mock('../../../context/components/ContextPanel/strips/GoalAttachmentsStrip', () => ({
  GoalAttachmentsStrip: () => <div data-testid="goal-attachments" />,
}));

type RunTreeProps = {
  readonly onSelect: (id: AgentId) => void;
};

vi.mock('../../../workflows/components/RunTree', () => ({
  RunTree: ({ onSelect }: RunTreeProps) => (
    <div data-testid="run-tree">
      <button type="button" onClick={() => onSelect('agent-1' as AgentId)}>
        Step 1, Scout
      </button>
    </div>
  ),
}));
vi.mock('../../../workflows/components/RunTree/useRunTree', () => ({
  useRunTree: () => null,
}));
vi.mock('../../../workflows/components/NextActionStrip', () => ({
  NextActionStrip: ({ subjectAgentId }: { readonly subjectAgentId: string | null }) => (
    <div data-testid="next-action-strip" data-subject={subjectAgentId ?? 'run'} />
  ),
}));

import { WorkflowRow } from './WorkflowRow';

const SESSION_ID = 'session-1' as SessionId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-07-25T00:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  name: 'Refactor',
  description: 'planner reasoning',
  goal: 'template goal',
  processText: 'scout, then plan, then implement',
  steps: [
    {
      id: 'step-1' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Scout',
      promptPrefix: 'map it',
    },
    {
      id: 'step-2' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      name: 'Plan',
      promptPrefix: 'plan it',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const run: WorkflowRun = {
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  goal: 'just the auth module',
};

const agents: ReadonlyArray<Agent> = [
  {
    id: 'agent-1' as AgentId,
    sessionId: SESSION_ID,
    stepId: 'step-1' as StepId,
    workflowRunId: RUN_ID,
    ordinal: 0,
    name: 'Scout',
    status: 'completed',
  },
  {
    id: 'agent-2' as AgentId,
    sessionId: SESSION_ID,
    stepId: 'step-2' as StepId,
    workflowRunId: RUN_ID,
    ordinal: 1,
    name: 'Plan',
    status: 'pending',
  },
];

const session = { id: SESSION_ID, workflowRuns: [run] } as unknown as Session;

type RenderParams = {
  readonly runOverride?: WorkflowRun;
  readonly workflowOverride?: Workflow;
  readonly agentsOverride?: ReadonlyArray<Agent>;
  readonly actionableStepId?: string | null;
  readonly blockReason?: WorkflowBlockReason | null;
  readonly childrenByParentId?: ReadonlyMap<string, Agent[]>;
  readonly onDeleteWorkflow?: (runId: WorkflowRunId) => Promise<void>;
  readonly onPickAgent?: (agentId: AgentId) => void;
  readonly startWorkflowRun?: (sessionId: SessionId, runId: WorkflowRunId) => Promise<void>;
  readonly setWorkflowRunAutoRun?: (
    sessionId: SessionId,
    runId: WorkflowRunId,
    autoRun: boolean,
  ) => Promise<void>;
  readonly focusedWorkflowRunId?: WorkflowRunId | null;
  readonly taskOverride?: Session;
};

const renderDetail = ({
  runOverride = run,
  workflowOverride = workflow,
  agentsOverride = agents,
  actionableStepId = 'step-2',
  blockReason = null,
  childrenByParentId = new Map(),
  onDeleteWorkflow = vi.fn(async () => undefined),
  onPickAgent = vi.fn(),
  startWorkflowRun = vi.fn(async () => undefined),
  setWorkflowRunAutoRun = vi.fn(async () => undefined),
  focusedWorkflowRunId = null,
  taskOverride = session,
}: RenderParams = {}) =>
  render(
    <WorkflowRow
      run={runOverride}
      workflow={workflowOverride}
      task={taskOverride}
      agentsByRunId={new Map([[RUN_ID, [...agentsOverride]]])}
      actionableStepIdByRunId={new Map([[RUN_ID, actionableStepId]])}
      blockReasonByRunId={new Map([[RUN_ID, blockReason]])}
      focusedWorkflowRunId={focusedWorkflowRunId}
      workflowExpand={undefined}
      workflowNameByRunId={new Map()}
      toggleWorkflowExpand={vi.fn()}
      startWorkflowRun={startWorkflowRun}
      setWorkflowRunAutoRun={setWorkflowRunAutoRun}
      onDiscardWorkflow={vi.fn(async () => undefined)}
      onDeleteWorkflow={onDeleteWorkflow}
      agentKindOverride={{}}
      agentModelOverride={{}}
      agentProviderOverride={{}}
      agentEffortOverride={{}}
      childrenByParentId={childrenByParentId}
      selectedAgentId={null}
      aggregatesByAgentId={
        new Map([
          ['agent-1', { inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.25, turns: 1 }],
        ])
      }
      onStartStepAgent={vi.fn(async () => undefined)}
      onPickAgent={onPickAgent}
      onAnswerQuestion={vi.fn()}
    />,
  );

beforeEach(() => {
  storeMocks.renameWorkflowRun.mockClear();
  storeMocks.sessionProjectMounts = {};
  storeMocks.sessionPhaseRuns = {};
  storeMocks.closeWorkflowRun.mockClear();
});

afterEach(() => {
  cleanup();
  storeMocks.orchestratingWorkflowRuns = {};
  storeMocks.runSpendUsd = 0;
  storeMocks.workspaceDurationHistory = {};
});

describe('WorkflowRow detail dashboard', () => {
  it('shows the automatic write destination when the session has two mounts', () => {
    storeMocks.sessionProjectMounts = { [SESSION_ID]: [{}, {}] };

    renderDetail();

    expect(screen.getByTestId('write-destination-control').textContent).toBe('automatic');
  });

  it('hides the write destination when the session has one mount', () => {
    storeMocks.sessionProjectMounts = { [SESSION_ID]: [{}] };

    renderDetail();

    expect(screen.queryByTestId('write-destination-control')).toBeNull();
  });

  it('hides the write destination when the run is discarded', () => {
    storeMocks.sessionProjectMounts = { [SESSION_ID]: [{}, {}] };

    renderDetail({ runOverride: { ...run, discardedAt: NOW } });

    expect(screen.queryByTestId('write-destination-control')).toBeNull();
  });

  it('declares navigation and lifecycle action slots', () => {
    renderDetail();

    const navigationSlot = screen.getByRole('group', { name: 'Workflow navigation actions' });
    const lifecycleSlot = screen.getByRole('group', { name: 'Workflow lifecycle actions' });

    expect(
      navigationSlot.contains(screen.getByRole('button', { name: 'Collapse Refactor workflow' })),
    ).toBe(true);
    expect(lifecycleSlot.contains(screen.getByRole('switch', { name: 'Autorun' }))).toBe(true);
    expect(
      lifecycleSlot.contains(screen.getByRole('button', { name: 'Refactor workflow actions' })),
    ).toBe(true);
  });

  it('renames the run from its own header', () => {
    renderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Edit workflow name' }));
    const field = screen.getByRole('textbox', { name: 'Workflow name' });
    fireEvent.change(field, { target: { value: 'Language id remap' } });
    fireEvent.blur(field);

    expect(storeMocks.renameWorkflowRun).toHaveBeenCalledWith(
      SESSION_ID,
      RUN_ID,
      'Language id remap',
    );
  });

  it('heads the detail with the run title instead of the workflow name', () => {
    renderDetail({ runOverride: { ...run, title: 'Remap language ids' } });

    expect(screen.getByRole('heading', { name: 'Remap language ids' })).toBeDefined();
  });

  it('renames only this run on a shared preset, without touching the preset', () => {
    renderDetail({ workflowOverride: { ...workflow, isPreset: true } });

    fireEvent.click(screen.getByRole('button', { name: 'Edit workflow name' }));

    expect(screen.queryByText(/This preset is shared/i)).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Workflow name' })).toHaveProperty(
      'value',
      workflow.name,
    );
  });

  it('puts the lifecycle actions in the header, ahead of the run body', () => {
    renderDetail();

    const lifecycleSlot = screen.getByRole('group', { name: 'Workflow lifecycle actions' });
    const title = screen.getByRole('heading', { name: 'Refactor' });
    const steps = screen.getByTestId('run-tree');

    expect(title.compareDocumentPosition(lifecycleSlot)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(lifecycleSlot.compareDocumentPosition(steps)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('separates the autorun toggle from the destructive cluster', () => {
    renderDetail();

    const lifecycleSlot = screen.getByRole('group', { name: 'Workflow lifecycle actions' });
    const toggle = screen.getByTestId('workflow-autorun-toggle');
    const remove = screen.getByRole('button', { name: 'Refactor workflow actions' });

    expect(within(toggle).getByRole('switch').getAttribute('aria-checked')).toBe('false');
    expect(toggle.parentElement).not.toBe(remove.parentElement);
    expect(toggle.compareDocumentPosition(remove)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('turns autorun off with no confirm when nothing is in flight', () => {
    const setAutoRun = vi.fn(async () => undefined);
    renderDetail({ runOverride: { ...run, autoRun: true }, setWorkflowRunAutoRun: setAutoRun });

    fireEvent.click(screen.getByRole('switch', { name: 'Autorun' }));

    expect(setAutoRun).toHaveBeenCalledWith(SESSION_ID, RUN_ID, false);
    expect(screen.queryByRole('group', { name: 'Stop now?' })).toBeNull();
  });

  it('turns autorun off immediately while a step is in flight', () => {
    const setAutoRun = vi.fn(async () => undefined);
    const running = agents.map((agent, index) =>
      index === 1 ? { ...agent, status: 'running' as const } : agent,
    );
    renderDetail({
      runOverride: { ...run, autoRun: true },
      agentsOverride: running,
      setWorkflowRunAutoRun: setAutoRun,
    });

    fireEvent.click(screen.getByRole('switch', { name: 'Autorun' }));

    expect(setAutoRun).toHaveBeenCalledWith(SESSION_ID, RUN_ID, false);
    expect(screen.queryByRole('group', { name: 'Stop now?' })).toBeNull();
  });

  it('keeps completed detail navigation non-empty without lifecycle actions in it', () => {
    const completedAgents = agents.map((agent) => ({ ...agent, status: 'completed' as const }));
    renderDetail({ agentsOverride: completedAgents });

    const navigationSlot = screen.getByRole('group', { name: 'Workflow navigation actions' });
    const lifecycleSlot = screen.getByRole('group', { name: 'Workflow lifecycle actions' });

    expect(navigationSlot.children).toHaveLength(1);
    expect(
      navigationSlot.contains(screen.getByRole('button', { name: 'Collapse Refactor workflow' })),
    ).toBe(true);
    expect(screen.queryByRole('switch', { name: 'Autorun' })).toBeNull();
    expect(
      lifecycleSlot.contains(screen.getByRole('button', { name: 'Refactor workflow actions' })),
    ).toBe(true);
  });

  it('answers where the run is and what it cost, leaving the step name to the strip', () => {
    renderDetail();

    const meta = screen.getByText('Step 2 of 2').parentElement;

    expect(meta?.textContent).not.toContain('Plan');
    expect(screen.getByTitle('$0.2500 for this run')).toBeDefined();
  });

  it('gives the time the steps left usually take, and nothing without enough history', () => {
    renderDetail({
      taskOverride: { ...session, workspaceId: 'workspace-1' as WorkspaceId },
    });
    expect(screen.queryByTestId('run-time-left')).toBeNull();
    cleanup();

    storeMocks.workspaceDurationHistory = {
      'workspace-1': {
        steps: [4, 5, 6, 7, 8, 9, 10, 12].map((minutes) => ({
          role: 'custom',
          provider: 'anthropic',
          model: 'claude-sonnet-5',
          effort: null,
          activeMs: minutes * 60_000,
          costUsd: null,
          endedAtMs: Date.now() - 60_000,
        })),
        turns: [],
        everyWorkspace: { steps: [], turns: [] },
        orchestratedRuns: [],
      },
    };
    renderDetail({
      taskOverride: { ...session, workspaceId: 'workspace-1' as WorkspaceId },
    });

    const meta = screen.getByText('Step 2 of 2').parentElement;
    expect(within(meta as HTMLElement).getByTestId('run-time-left').textContent).toBe(
      'usually 6-9m',
    );
  });

  it('shows the run goal it was started with', () => {
    renderDetail();

    expect(screen.getByText('just the auth module')).toBeDefined();
    expect(screen.queryByText('template goal')).toBeNull();
    const goal = screen.getByRole('region', { name: 'What you asked for' });
    expect(goal.className).not.toContain('rounded');
    expect(goal.className).not.toContain('bg-');
    expect(goal.className).not.toContain('ring-');
  });

  it('falls back to the template goal when the run carries none', () => {
    renderDetail({ runOverride: { ...run, goal: undefined } });

    expect(screen.getByText('template goal')).toBeDefined();
  });

  it('keeps the described process behind a disclosure', () => {
    renderDetail();

    expect(screen.queryByText('scout, then plan, then implement')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /how you described the process/i }));
    expect(screen.getByText('scout, then plan, then implement')).toBeDefined();
  });

  it('offers the next step CTA in the dashboard, not only when blocked', () => {
    renderDetail();

    expect(screen.getByTestId('workflow-next-step-cta')).toBeDefined();
  });

  it('carries the run next action above the steps, scoped to the run', () => {
    renderDetail();

    const strip = screen.getByTestId('next-action-strip');
    expect(strip.getAttribute('data-subject')).toBe('run');
    const steps = screen.getByTestId('run-tree');
    expect(strip.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('drops the next action on a discarded run', () => {
    renderDetail({ runOverride: { ...run, discardedAt: NOW } });

    expect(screen.queryByTestId('next-action-strip')).toBeNull();
  });

  it('puts the goal and its attachments after the steps and the recap', () => {
    renderDetail({ runOverride: { ...run, orchestratorSummary: '- shipped the gate' } });

    const steps = screen.getByTestId('run-tree');
    const recap = screen.getByTestId('workflow-run-summary');
    const goal = screen.getByRole('region', { name: 'What you asked for' });
    const attachments = screen.getByTestId('goal-attachments');

    expect(steps.compareDocumentPosition(recap)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(recap.compareDocumentPosition(goal)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(goal.compareDocumentPosition(attachments)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('opens the chat of a step when its chip is clicked', () => {
    const onPickAgent = vi.fn();
    renderDetail({ onPickAgent });

    fireEvent.click(screen.getByRole('button', { name: 'Step 1, Scout' }));

    expect(onPickAgent).toHaveBeenCalledWith(agents[0]!.id);
  });

  it('closes the dashboard with the recap the orchestrator kept', () => {
    renderDetail({ runOverride: { ...run, orchestratorSummary: '- shipped the gate' } });

    const steps = screen.getByTestId('run-tree');
    const recap = screen.getByTestId('workflow-run-summary');

    expect(recap.textContent).toContain('shipped the gate');
    expect(steps.compareDocumentPosition(recap)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('takes no room on a run the orchestrator never recapped', () => {
    renderDetail();

    expect(screen.queryByTestId('workflow-run-summary')).toBeNull();
  });

  it('deletes the workflow run after confirmation', () => {
    const onDeleteWorkflow = vi.fn(async () => undefined);
    renderDetail({ onDeleteWorkflow });

    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Refactor workflow actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete workflow run' }));
    const confirm = screen.getByRole('group', { name: 'Delete workflow run?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(onDeleteWorkflow).toHaveBeenCalledWith(RUN_ID);
  });
});

describe('WorkflowRow step-in-flight predicate', () => {
  it('turns autorun off while the orchestrator is deciding, even with no agent running', () => {
    const setAutoRun = vi.fn(async () => undefined);
    storeMocks.orchestratingWorkflowRuns[RUN_ID] = true;
    renderDetail({
      runOverride: { ...run, autoRun: true },
      setWorkflowRunAutoRun: setAutoRun,
    });

    fireEvent.click(screen.getByRole('switch', { name: 'Autorun' }));

    expect(setAutoRun).toHaveBeenCalledWith(SESSION_ID, RUN_ID, false);
  });

  it('reads the collapsed row as stopping while the decision is still in flight', () => {
    storeMocks.orchestratingWorkflowRuns[RUN_ID] = true;
    renderDetail({
      runOverride: {
        ...run,
        executionMode: 'dynamic',
        orchestrationStop: { kind: 'operator', message: 'you stopped it' },
      },
      focusedWorkflowRunId: 'run-2' as WorkflowRunId,
    });

    expect(screen.getByText('Stopping')).toBeDefined();
    expect(screen.queryByText('Stopped')).toBeNull();
  });

  it('reads the collapsed row as stopped once nothing is in flight', () => {
    renderDetail({
      runOverride: {
        ...run,
        executionMode: 'dynamic',
        orchestrationStop: { kind: 'operator', message: 'you stopped it' },
      },
      focusedWorkflowRunId: 'run-2' as WorkflowRunId,
    });

    expect(screen.getByText('Stopped')).toBeDefined();
    expect(screen.queryByText('Stopping')).toBeNull();
  });
});

describe('WorkflowRow manual start gate', () => {
  const queuedRun: WorkflowRun = { ...run, triggerMode: 'manual' };

  it('starts a queued run straight away when nothing blocks it', async () => {
    const startWorkflowRun = vi.fn(async () => undefined);
    renderDetail({ runOverride: queuedRun, agentsOverride: [], startWorkflowRun });

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await Promise.resolve();

    expect(startWorkflowRun).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('names the blocker and starts only after an explicit override', async () => {
    const startWorkflowRun = vi.fn(async () => undefined);
    renderDetail({
      runOverride: queuedRun,
      agentsOverride: [],
      blockReason: 'questions',
      startWorkflowRun,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    const confirm = screen.getByRole('group', { name: 'Start this workflow anyway?' });

    expect(confirm.textContent).toMatch(/open questions are waiting/i);
    expect(startWorkflowRun).not.toHaveBeenCalled();

    fireEvent.click(within(confirm).getByRole('button', { name: 'Start anyway' }));
    await Promise.resolve();

    expect(startWorkflowRun).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });
});

describe('WorkflowRow dynamic runs', () => {
  const dynamicRun: WorkflowRun = { ...run, executionMode: 'dynamic' };
  const doneAgents: ReadonlyArray<Agent> = [
    { ...agents[0]! },
    { ...agents[1]!, status: 'completed' },
  ];

  it('keeps an in-between dynamic run out of the completed state', () => {
    renderDetail({ runOverride: dynamicRun, agentsOverride: doneAgents, actionableStepId: null });

    expect(screen.queryByText('Completed')).toBeNull();
    expect(screen.getByTestId('orchestrator-state').textContent).toContain(
      'Paused · autorun is off',
    );
  });

  it('gives an orchestrated run the same next action as a static one', () => {
    renderDetail({ runOverride: dynamicRun, agentsOverride: doneAgents, actionableStepId: null });

    expect(screen.getByTestId('next-action-strip').getAttribute('data-subject')).toBe('run');
    expect(screen.queryByTestId('workflow-next-step-cta')).toBeNull();
  });

  it('leaves the orchestrator phase to the strip instead of a second pill', () => {
    renderDetail({
      runOverride: {
        ...dynamicRun,
        orchestrationStop: { kind: 'failure', message: 'usage limit reached' },
      },
      agentsOverride: doneAgents,
      actionableStepId: null,
    });

    expect(screen.queryByTestId('workflow-orchestrator-failed')).toBeNull();
    expect(screen.getByTestId('orchestrator-state').textContent).toContain('Last decision failed');
  });

  it('counts the steps a dynamic run took instead of promising a total it never had', () => {
    renderDetail({ runOverride: dynamicRun, agentsOverride: doneAgents, actionableStepId: null });

    expect(screen.getByText('2 steps')).toBeDefined();
    expect(screen.queryByText(/step 2 of 2/i)).toBeNull();
  });

  it('adds the agent count only when it differs from the step count', () => {
    renderDetail({ runOverride: dynamicRun, agentsOverride: doneAgents, actionableStepId: null });
    expect(screen.queryByText(/agents?$/)).toBeNull();
    cleanup();

    renderDetail({
      runOverride: dynamicRun,
      agentsOverride: [
        ...doneAgents,
        { ...agents[0]!, id: 'agent-extra' as AgentId, name: 'Extra', ordinal: 9 },
      ],
      actionableStepId: null,
    });
    expect(screen.getByText('3 agents')).toBeDefined();
  });

  it('bills a dynamic run on the spend enforcement reads, not on the step aggregates', () => {
    storeMocks.runSpendUsd = 3.5;
    renderDetail({ runOverride: dynamicRun, agentsOverride: doneAgents, actionableStepId: null });

    expect(screen.getByTitle('$3.5000 for this run')).toBeDefined();
  });

  it('offers the spend limit next to what the dynamic run has cost', () => {
    renderDetail({
      runOverride: { ...dynamicRun, spendLimitUsd: 20 },
      agentsOverride: doneAgents,
      actionableStepId: null,
    });

    const [trigger] = screen.getAllByTestId('run-spend-limit-trigger');
    expect(trigger?.textContent).toContain('Spend limit $20.00');
  });

  it('marks the dynamic run completed only on a persisted done outcome', () => {
    renderDetail({
      runOverride: { ...dynamicRun, orchestrationOutcome: 'done' },
      agentsOverride: doneAgents,
    });

    expect(screen.getByText('Completed')).toBeDefined();
    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();
  });

  it('offers add step on a blocked dynamic run, which the action still accepts', () => {
    renderDetail({
      runOverride: {
        ...dynamicRun,
        orchestrationOutcome: 'blocked',
        orchestrationReason: 'it needs a decision',
      },
      agentsOverride: doneAgents,
    });

    expect(screen.getByRole('button', { name: /add step/i })).toBeDefined();
  });

  it('withholds add step while the orchestrator is choosing the next one', () => {
    storeMocks.orchestratingWorkflowRuns = { [dynamicRun.id]: true };
    renderDetail({ runOverride: dynamicRun, agentsOverride: doneAgents });

    expect(screen.getByRole('button', { name: /add step/i }).hasAttribute('disabled')).toBe(true);
  });

  it('dims a discarded run with the same token the workflows lens card quotes', () => {
    const { container } = renderDetail({ runOverride: { ...run, discardedAt: NOW } });

    expect((container.firstChild as HTMLElement).className).toContain(TERMINAL_DIM);
  });

  it('leaves a live run undimmed', () => {
    const { container } = renderDetail();

    expect((container.firstChild as HTMLElement).className).not.toContain(TERMINAL_DIM);
  });

  it('offers Close workflow on a started run and closes it once confirmed', () => {
    storeMocks.sessionPhaseRuns = { [SESSION_ID]: agents };
    renderDetail();

    const lifecycleSlot = screen.getByRole('group', { name: 'Workflow lifecycle actions' });
    fireEvent.click(within(lifecycleSlot).getByRole('button', { name: 'Close workflow' }));
    const panel = screen.getByRole('group', { name: 'Close this workflow?' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Close workflow' }));

    expect(storeMocks.closeWorkflowRun).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('reads a closed run as closed by you, with no Close, autorun or next action', () => {
    const closedAgents: ReadonlyArray<Agent> = [
      { ...agents[0]!, status: 'failed' },
      { ...agents[1]!, status: 'skipped' },
    ];
    storeMocks.sessionPhaseRuns = { [SESSION_ID]: closedAgents };
    renderDetail({
      runOverride: {
        ...run,
        orchestrationOutcome: 'done',
        orchestrationStop: { kind: 'closed', message: 'Closed by you' },
      },
      agentsOverride: closedAgents,
    });

    expect(screen.getByTitle('Closed by you').textContent).toBe('Closed');
    expect(screen.queryByRole('button', { name: 'Close workflow' })).toBeNull();
    expect(screen.queryByTestId('workflow-autorun-toggle')).toBeNull();
  });

  it('keeps Discard in the actions menu, next to Delete', () => {
    renderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Refactor workflow actions' }));

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Discard workflow',
      'Delete workflow run',
    ]);
  });
});
