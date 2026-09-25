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
import { selectSpawnedChildren } from '../../../../shared/utils/spawnedChildren';
import { useAppStore } from '../../../../store';
import { AgentBriefChildren } from './AgentBriefChildren';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-07-31T00:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Harden checkout',
  description: '',
  steps: [
    {
      id: 'step-1' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Scout',
      promptPrefix: '',
    },
    {
      id: 'step-2' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      name: 'Implement',
      promptPrefix: '',
      modelOverride: 'gpt-5.1-codex',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const run: WorkflowRun = {
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 1,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  createdAt: NOW,
};

const session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  workflowRuns: [run],
} as unknown as Session;

const agent = (patch: Partial<Agent> & Pick<Agent, 'id' | 'ordinal' | 'name'>): Agent => ({
  sessionId: SESSION_ID,
  status: 'completed',
  ...patch,
});

const scout = agent({
  id: 'agent-1' as AgentId,
  workflowRunId: RUN_ID,
  stepId: 'step-1' as StepId,
  ordinal: 0,
  name: 'Scout',
  kind: 'scout',
  startedAt: '2026-07-31T01:00:00.000Z' as IsoDateTime,
});
const implement = agent({
  id: 'agent-2' as AgentId,
  workflowRunId: RUN_ID,
  stepId: 'step-2' as StepId,
  ordinal: 1,
  name: 'Implement validators',
  kind: 'implementer',
  status: 'running',
  startedAt: '2026-07-31T02:00:00.000Z' as IsoDateTime,
});
const part = (index: number, patch: Partial<Agent> = {}): Agent =>
  agent({
    id: `part-${index}` as AgentId,
    workflowRunId: RUN_ID,
    parentAgentId: implement.id,
    ordinal: 10 + index,
    name: `Part ${index}`,
    kind: 'implementer',
    startedAt: `2026-07-31T02:0${index}:00.000Z` as IsoDateTime,
    ...patch,
  });

type RenderParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly root: Agent;
  readonly kind?: 'implementer' | 'scout' | 'planner';
};

const renderBrief = ({ agents, root, kind = 'implementer' }: RenderParams) => {
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION_ID]: [...agents] },
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
  });
  const children = selectSpawnedChildren({ runs: agents, parentAgentId: root.id, turnStates: {} });
  return render(
    <AgentBriefChildren session={session} agent={root} kind={kind} children={children} />,
  );
};

const rowOf = (id: string): HTMLElement => screen.getByTestId(`run-tree-row-${id}`);

const metaOf = (id: string, column: 'model' | 'effort'): string | null =>
  rowOf(id).querySelector(`[data-meta-column="${column}"]`)?.textContent ?? null;

const rowIds = (): ReadonlyArray<string> =>
  screen
    .getAllByTestId(/^run-tree-row-/u)
    .map((row) => row.dataset.testid?.replace('run-tree-row-', '') ?? '');

beforeEach(() => {
  useAppStore.setState({
    sessionTelemetry: {},
    agentRunHistory: {},
    sessionWorkflows: {},
    sessionOpenQuestions: {},
    orchestratingWorkflowRuns: {},
    agentTurnState: {},
    agentKindOverride: {},
    agentModelOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
  });
});

afterEach(cleanup);

describe('AgentBriefChildren', () => {
  it('draws the parts as a tree rooted on the step, first part just above the step', () => {
    renderBrief({
      agents: [
        scout,
        implement,
        part(1),
        part(2, { status: 'running' }),
        part(3, { status: 'pending' }),
      ],
      root: implement,
    });

    expect(rowIds()).toEqual(['part-3', 'part-2', 'part-1', 'agent-2']);
    expect(
      within(rowOf('agent-2')).getByRole('button', { name: 'Step 2, Implement validators' }),
    ).toBeDefined();
    expect(within(rowOf('part-1')).getByRole('button', { name: 'Step 2.1, Part 1' })).toBeDefined();
    expect(within(rowOf('part-3')).getByRole('button', { name: 'Step 2.3, Part 3' })).toBeDefined();
    expect(screen.queryByTestId('run-tree-row-agent-1')).toBeNull();
  });

  it('puts the parts one column right of the step, on the run colour', () => {
    renderBrief({ agents: [scout, implement, part(1), part(2)], root: implement });

    const columnOf = (id: string) =>
      rowOf(id).querySelector('[data-rail-column]')?.getAttribute('data-rail-column');
    expect(columnOf('agent-2')).toBe('0');
    expect(columnOf('part-1')).toBe('1');
    expect(columnOf('part-2')).toBe('1');
    const strokes = [...rowOf('part-1').querySelectorAll('line, path')].map((line) =>
      line.getAttribute('stroke'),
    );
    expect(strokes.some((stroke) => stroke != null && stroke !== 'var(--color-border)')).toBe(true);
  });

  it('shows the model and the effort each part runs with, part by part', () => {
    useAppStore.setState({
      agentModelOverride: {
        [part(1).id]: 'claude-opus-4-5',
        [part(2).id]: 'claude-sonnet-4-5',
      },
      agentEffortOverride: { [part(1).id]: 'high', [part(2).id]: 'medium' },
    });
    renderBrief({ agents: [scout, implement, part(1), part(2)], root: implement });

    expect(metaOf('part-1', 'model')).toBe('Opus 4.5');
    expect(metaOf('part-1', 'effort')).toBe('High');
    expect(metaOf('part-2', 'model')).toBe('Sonnet 4.5');
    expect(metaOf('part-2', 'effort')).toBe('Medium');
  });

  it('names the section Subagents and counts what is done in words', () => {
    renderBrief({
      agents: [scout, implement, part(1), part(2, { status: 'running' })],
      root: implement,
    });

    expect(screen.getByText('Subagents')).toBeDefined();
    expect(screen.getByText('1 of 2 done')).toBeDefined();
    expect(screen.queryByText('completed')).toBeNull();
  });

  it('marks the agent on screen and opens a part from its row', () => {
    const selectAgent = vi.fn(async () => undefined);
    useAppStore.setState({ selectAgent });
    renderBrief({ agents: [scout, implement, part(1)], root: implement });

    expect(
      screen
        .getByRole('button', { name: 'Step 2, Implement validators' })
        .getAttribute('aria-current'),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Step 2.1, Part 1' }));

    expect(selectAgent).toHaveBeenCalledWith(SESSION_ID, 'part-1');
  });

  it('numbers the subagents of an agent outside a workflow from 1', () => {
    const lead = agent({ id: 'lead' as AgentId, ordinal: 0, name: 'Map the store', kind: 'scout' });
    const sub = (index: number): Agent =>
      agent({
        id: `sub-${index}` as AgentId,
        parentAgentId: lead.id,
        ordinal: index,
        name: `Area ${index}`,
        kind: 'scout',
        startedAt: `2026-07-31T02:0${index}:00.000Z` as IsoDateTime,
      });
    renderBrief({ agents: [lead, sub(1), sub(2)], root: lead, kind: 'scout' });

    expect(
      within(rowOf('sub-1')).getByRole('button', { name: 'Subagent 1, Area 1' }),
    ).toBeDefined();
    expect(
      within(rowOf('sub-2')).getByRole('button', { name: 'Subagent 2, Area 2' }),
    ).toBeDefined();
    expect(within(rowOf('lead')).getByRole('button', { name: 'Map the store' })).toBeDefined();
  });

  it('says nothing for a planner', () => {
    const { container } = renderBrief({
      agents: [scout, implement, part(1)],
      root: implement,
      kind: 'planner',
    });

    expect(container.textContent).toBe('');
  });
});
