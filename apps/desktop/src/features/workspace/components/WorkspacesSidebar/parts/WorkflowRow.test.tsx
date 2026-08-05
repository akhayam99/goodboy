// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
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
import type { WorkflowBlockReason } from '../../../../workflows/advanceGate';

const storeMocks = vi.hoisted(() => ({ renameWorkflow: vi.fn(async () => undefined) }));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: unknown) => T) =>
    selector({ renameWorkflow: storeMocks.renameWorkflow }),
}));

vi.mock(
  '../../../../../features/context/components/ContextPanel/strips/GoalAttachmentsStrip',
  () => ({
    GoalAttachmentsStrip: () => <div data-testid="goal-attachments" />,
  }),
);

vi.mock('./WorkflowStepRow', () => ({
  WorkflowStepRow: ({ run }: { readonly run: Agent }) => (
    <div data-testid={`step-${run.id}`}>{run.name}</div>
  ),
}));

vi.mock('./ScoutSubtree', () => ({
  ScoutSubtree: () => <div data-testid="scout-subtree" />,
}));
vi.mock('./ClusterChildRow', () => ({ ClusterChildRow: () => null }));
vi.mock('./WorkflowKillButton', () => ({ WorkflowKillButton: () => null }));

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
  readonly agentsOverride?: ReadonlyArray<Agent>;
  readonly actionableStepId?: string | null;
  readonly blockReason?: WorkflowBlockReason | null;
  readonly childrenByParentId?: ReadonlyMap<string, Agent[]>;
  readonly clusterExpand?: ReadonlyMap<string, boolean>;
  readonly onDeleteWorkflow?: (runId: WorkflowRunId) => Promise<void>;
  readonly onPickAgent?: (agentId: AgentId) => void;
  readonly startWorkflowRun?: (sessionId: SessionId, runId: WorkflowRunId) => Promise<void>;
  readonly variant?: 'sidebar' | 'detail';
};

const renderDetail = ({
  runOverride = run,
  agentsOverride = agents,
  actionableStepId = 'step-2',
  blockReason = null,
  childrenByParentId = new Map(),
  clusterExpand = new Map(),
  onDeleteWorkflow = vi.fn(async () => undefined),
  onPickAgent = vi.fn(),
  startWorkflowRun = vi.fn(async () => undefined),
  variant = 'detail',
}: RenderParams = {}) =>
  render(
    <WorkflowRow
      run={runOverride}
      workflow={workflow}
      index={0}
      task={session}
      attachedRuns={[{ run: runOverride, workflow }]}
      agentsByRunId={new Map([[RUN_ID, [...agentsOverride]]])}
      actionableStepIdByRunId={new Map([[RUN_ID, actionableStepId]])}
      blockReasonByRunId={new Map([[RUN_ID, blockReason]])}
      countUnread={() => 0}
      focusedWorkflowRunId={null}
      workflowExpand={undefined}
      workflowNameByRunId={new Map()}
      forceExpanded
      variant={variant}
      toggleWorkflowExpand={vi.fn()}
      startWorkflowRun={startWorkflowRun}
      setWorkflowRunAutoRun={vi.fn(async () => undefined)}
      onReorderWorkflow={vi.fn(async () => undefined)}
      onDiscardWorkflow={vi.fn(async () => undefined)}
      onDeleteWorkflow={onDeleteWorkflow}
      agentKindOverride={{}}
      agentModelOverride={{}}
      agentProviderOverride={{}}
      childrenByParentId={childrenByParentId}
      clusterExpand={clusterExpand}
      selectedAgentId={null}
      isTaskActive
      editingId={null}
      latestTelemetryByAgentId={new Map()}
      aggregatesByAgentId={
        new Map([
          ['agent-1', { inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.25, turns: 1 }],
        ])
      }
      providerUsageByAgentId={new Map()}
      turnsByAgentId={new Map()}
      isTranscriptLoading={false}
      onStartStepAgent={vi.fn(async () => undefined)}
      onPickAgent={onPickAgent}
      setEditingId={vi.fn()}
      onRenameCommit={vi.fn(async () => undefined)}
      onResolveFirstForRun={vi.fn()}
      toggleClusterExpand={vi.fn()}
      skipStuckStepAndAdvance={vi.fn(async () => undefined)}
    />,
  );

afterEach(cleanup);

describe('WorkflowRow detail dashboard', () => {
  it('declares navigation and lifecycle action slots', () => {
    renderDetail();

    const navigationSlot = screen.getByRole('group', { name: 'Workflow navigation actions' });
    const lifecycleSlot = screen.getByRole('group', { name: 'Workflow lifecycle actions' });

    expect(
      navigationSlot.contains(screen.getByRole('button', { name: 'Collapse Refactor workflow' })),
    ).toBe(true);
    expect(lifecycleSlot.contains(screen.getByRole('button', { name: 'Autorun off' }))).toBe(true);
    expect(lifecycleSlot.contains(screen.getByRole('button', { name: 'Delete' }))).toBe(true);
  });

  it('renames the run from its own header', () => {
    renderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Edit workflow name' }));
    const field = screen.getByRole('textbox', { name: 'Workflow name' });
    fireEvent.change(field, { target: { value: 'Language id remap' } });
    fireEvent.blur(field);

    expect(storeMocks.renameWorkflow).toHaveBeenCalledWith(
      'workspace-1',
      WORKFLOW_ID,
      'Language id remap',
    );
  });

  it('puts the lifecycle actions in the header, ahead of the run body', () => {
    renderDetail();

    const lifecycleSlot = screen.getByRole('group', { name: 'Workflow lifecycle actions' });
    const title = screen.getByRole('heading', { name: 'Refactor' });
    const steps = screen.getByTestId('workflow-step-graph');

    expect(title.compareDocumentPosition(lifecycleSlot)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(lifecycleSlot.compareDocumentPosition(steps)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('separates the autorun toggle from the destructive cluster', () => {
    renderDetail();

    const lifecycleSlot = screen.getByRole('group', { name: 'Workflow lifecycle actions' });
    const toggle = screen.getByTestId('workflow-autorun-toggle');
    const remove = screen.getByRole('button', { name: 'Delete' });

    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.className).toContain('rounded-full');
    expect(lifecycleSlot.querySelector('[role="separator"]')).not.toBeNull();
    expect(toggle.compareDocumentPosition(remove)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
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
    expect(screen.queryByRole('button', { name: 'Autorun off' })).toBeNull();
    expect(lifecycleSlot.contains(screen.getByRole('button', { name: 'Delete' }))).toBe(true);
  });

  it('answers where the run is and what it cost, leaving the step name to the strip', () => {
    renderDetail();

    const meta = screen.getByText('Step 2 of 2').parentElement;

    expect(meta?.textContent).not.toContain('Plan');
    expect(screen.getByTitle('$0.2500 for this run')).toBeDefined();
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

  it('places workflow attachments between the goal and the steps', () => {
    renderDetail();

    const goal = screen.getByRole('region', { name: 'What you asked for' });
    const attachments = screen.getByTestId('goal-attachments');
    const steps = screen.getByTestId('workflow-step-graph');

    expect(goal.compareDocumentPosition(attachments)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(attachments.compareDocumentPosition(steps)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('opens the chat of a step when its chip is clicked', () => {
    const onPickAgent = vi.fn();
    renderDetail({ onPickAgent });

    const steps = screen.getByTestId('workflow-step-graph');
    const chips = steps.querySelectorAll('button');
    fireEvent.click(chips[0] as HTMLElement);

    expect(onPickAgent).toHaveBeenCalledWith(agents[0]!.id);
  });

  it('deletes the workflow run after confirmation', () => {
    const onDeleteWorkflow = vi.fn(async () => undefined);
    renderDetail({ onDeleteWorkflow });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = screen.getByRole('group', { name: 'Delete workflow run?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(onDeleteWorkflow).toHaveBeenCalledWith(RUN_ID);
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

  it('gates the sidebar start action the same way', () => {
    const startWorkflowRun = vi.fn(async () => undefined);
    renderDetail({
      runOverride: queuedRun,
      agentsOverride: [],
      blockReason: 'questions',
      startWorkflowRun,
      variant: 'sidebar',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start workflow now' }));

    expect(screen.getByRole('group', { name: 'Start this workflow anyway?' })).toBeDefined();
    expect(startWorkflowRun).not.toHaveBeenCalled();
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
    expect(screen.getByTestId('orchestrator-state').textContent).toContain('ready to continue');
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

  it('marks the dynamic run completed only on a persisted done outcome', () => {
    renderDetail({
      runOverride: { ...dynamicRun, orchestrationOutcome: 'done' },
      agentsOverride: doneAgents,
    });

    expect(screen.getByText('Completed')).toBeDefined();
    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();
  });
});
