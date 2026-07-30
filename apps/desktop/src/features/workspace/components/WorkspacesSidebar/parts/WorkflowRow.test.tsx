// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

const { orchestrateNextStepSpy, retryWorkflowOrchestrationSpy } = vi.hoisted(() => ({
  orchestrateNextStepSpy: vi.fn(async () => undefined),
  retryWorkflowOrchestrationSpy: vi.fn(async () => undefined),
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: unknown) => T) =>
    selector({
      orchestrateNextStep: orchestrateNextStepSpy,
      retryWorkflowOrchestration: retryWorkflowOrchestrationSpy,
    }),
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
  readonly childrenByParentId?: ReadonlyMap<string, Agent[]>;
  readonly clusterExpand?: ReadonlyMap<string, boolean>;
  readonly onDeleteWorkflow?: (runId: WorkflowRunId) => Promise<void>;
};

const renderDetail = ({
  runOverride = run,
  agentsOverride = agents,
  actionableStepId = 'step-2',
  childrenByParentId = new Map(),
  clusterExpand = new Map(),
  onDeleteWorkflow = vi.fn(async () => undefined),
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
      blockReasonByRunId={new Map([[RUN_ID, null]])}
      countUnread={() => 0}
      focusedWorkflowRunId={null}
      workflowExpand={undefined}
      workflowNameByRunId={new Map()}
      forceExpanded
      variant="detail"
      toggleWorkflowExpand={vi.fn()}
      startWorkflowRun={vi.fn(async () => undefined)}
      setWorkflowRunAutoRun={vi.fn(async () => undefined)}
      onReorderWorkflow={vi.fn(async () => undefined)}
      onDiscardWorkflow={vi.fn(async () => undefined)}
      onDeleteWorkflow={onDeleteWorkflow}
      agentKindOverride={{}}
      agentModelOverride={{}}
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
      onPickAgent={vi.fn()}
      setEditingId={vi.fn()}
      onRenameCommit={vi.fn(async () => undefined)}
      onResolveFirstForRun={vi.fn()}
      toggleClusterExpand={vi.fn()}
      skipStuckStepAndAdvance={vi.fn(async () => undefined)}
    />,
  );

afterEach(cleanup);

describe('WorkflowRow detail dashboard', () => {
  it('answers where the run is and what it cost', () => {
    renderDetail();

    const meta = screen.getByText('Step 2 of 2').parentElement;

    expect(meta?.textContent).toContain('Plan');
    expect(screen.getByTitle('$0.2500 for this run')).toBeDefined();
  });

  it('shows the run goal it was started with', () => {
    renderDetail();

    expect(screen.getByText('just the auth module')).toBeDefined();
    expect(screen.queryByText('template goal')).toBeNull();
    const goal = screen.getByRole('region', { name: 'what you asked for' });
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

    const goal = screen.getByRole('region', { name: 'what you asked for' });
    const attachments = screen.getByTestId('goal-attachments');
    const steps = screen.getByTestId('workflow-step-strip');

    expect(goal.compareDocumentPosition(attachments)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(attachments.compareDocumentPosition(steps)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('deletes the workflow run after confirmation', () => {
    const onDeleteWorkflow = vi.fn(async () => undefined);
    renderDetail({ onDeleteWorkflow });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onDeleteWorkflow).toHaveBeenCalledWith(RUN_ID);
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
    expect(screen.getByText('Deciding next step')).toBeDefined();
    expect(screen.getByText('deciding next step')).toBeDefined();
  });

  it('marks the dynamic run completed only on a persisted done outcome', () => {
    renderDetail({
      runOverride: { ...dynamicRun, orchestrationOutcome: 'done' },
      agentsOverride: doneAgents,
    });

    expect(screen.getByText('Completed')).toBeDefined();
    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();
  });

  it('asks the orchestrator for the next step from the CTA', () => {
    renderDetail({ runOverride: dynamicRun, agentsOverride: doneAgents });

    fireEvent.click(screen.getByTestId('workflow-orchestrate-next-cta'));

    expect(orchestrateNextStepSpy).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('retries a blocked run through the retry affordance', () => {
    renderDetail({
      runOverride: { ...dynamicRun, orchestrationOutcome: 'blocked' },
      agentsOverride: doneAgents,
    });

    fireEvent.click(screen.getByTestId('workflow-orchestrate-retry-cta'));

    expect(retryWorkflowOrchestrationSpy).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });
});
