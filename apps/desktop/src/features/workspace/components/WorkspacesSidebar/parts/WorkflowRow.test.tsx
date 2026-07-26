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

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: unknown) => T) => selector({}),
}));

vi.mock(
  '../../../../../features/context/components/ContextPanel/strips/GoalAttachmentsStrip',
  () => ({
    GoalAttachmentsStrip: () => null,
  }),
);

vi.mock('./WorkflowStepRow', () => ({
  WorkflowStepRow: ({
    run,
    detailContent,
  }: {
    readonly run: Agent;
    readonly detailContent?: React.ReactNode;
  }) => (
    <div data-testid={`step-${run.id}`}>
      {run.name}
      {detailContent}
    </div>
  ),
}));

vi.mock('./ScoutSubtree', () => ({
  ScoutSubtree: ({ variant }: { readonly variant?: string }) => (
    <div data-testid={`scout-subtree-${variant ?? 'sidebar'}`} />
  ),
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
  readonly childrenByParentId?: ReadonlyMap<string, Agent[]>;
  readonly clusterExpand?: ReadonlyMap<string, boolean>;
};

const renderDetail = ({
  runOverride = run,
  childrenByParentId = new Map(),
  clusterExpand = new Map(),
}: RenderParams = {}) =>
  render(
    <WorkflowRow
      run={runOverride}
      workflow={workflow}
      index={0}
      task={session}
      attachedRuns={[{ run: runOverride, workflow }]}
      agentsByRunId={new Map([[RUN_ID, [...agents]]])}
      actionableStepIdByRunId={new Map([[RUN_ID, 'step-2']])}
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
      forceAdvanceWorkflowStep={vi.fn(async () => undefined)}
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

  it('places non-scout runs inside the owning step without an indented rail', () => {
    const child = {
      ...agents[1]!,
      id: 'cluster-1' as AgentId,
      name: 'Plan run',
      status: 'completed',
      parentAgentId: agents[1]!.id,
    } as Agent;
    renderDetail({
      childrenByParentId: new Map([[agents[1]!.id, [child]]]),
    });

    const stepRow = screen.getByTestId(`step-${agents[1]!.id}`);
    expect(within(stepRow).getByRole('button', { name: 'expand runs for Plan' })).toBeDefined();
    expect(within(stepRow).getByText('Runs (1/1)')).toBeDefined();
    expect(stepRow.querySelector('.ml-3')).toBeNull();
    expect(stepRow.querySelector('.border-l')).toBeNull();
  });

  it('places scout subtrees inside the owning step in detail mode', () => {
    const child = {
      ...agents[0]!,
      id: 'scout-child-1' as AgentId,
      name: 'Scout run',
      parentAgentId: agents[0]!.id,
    } as Agent;
    renderDetail({
      childrenByParentId: new Map([[agents[0]!.id, [child]]]),
    });

    const stepRow = screen.getByTestId(`step-${agents[0]!.id}`);
    expect(within(stepRow).getByTestId('scout-subtree-detail')).toBeDefined();
  });
});
