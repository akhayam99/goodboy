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
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type {
  TimelineAgentEntry,
  TimelineRunEntry,
} from '../../../../timeline/buildTimelineGroups';

type Store = {
  readonly setFocusedWorkflowRun: ReturnType<typeof vi.fn>;
  readonly setActiveLens: ReturnType<typeof vi.fn>;
  readonly selectAgent: ReturnType<typeof vi.fn>;
};

const { store } = vi.hoisted(() => ({
  store: {
    setFocusedWorkflowRun: vi.fn(),
    setActiveLens: vi.fn(),
    selectAgent: vi.fn(),
  } as Store,
}));

vi.mock('../../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: Store) => T) => selector(store),
}));

import { TimelineRunRow } from './TimelineRunRow';

type TypedStringParams = {
  readonly value: string;
};

const typedString = <Value extends string>({ value }: TypedStringParams): Value =>
  JSON.parse(JSON.stringify(value));

const SESSION_ID = typedString<SessionId>({ value: 'session-1' });
const WORKFLOW_ID = typedString<WorkflowId>({ value: 'workflow-1' });
const WORKFLOW_RUN_ID = typedString<WorkflowRunId>({ value: 'run-1' });

type StepParams = {
  readonly id: string;
  readonly ordinal: number;
  readonly name: string;
};

const step = ({ id, ordinal, name }: StepParams): Step => ({
  id: typedString<StepId>({ value: id }),
  workflowId: WORKFLOW_ID,
  ordinal,
  name,
  promptPrefix: '',
});

const PLAN = step({ id: 'step-plan', ordinal: 0, name: 'Plan' });
const IMPLEMENT = step({ id: 'step-implement', ordinal: 1, name: 'Implement' });
const REVIEW = step({ id: 'step-review', ordinal: 2, name: 'Review' });

type AgentParams = {
  readonly id: string;
  readonly stepId: StepId;
  readonly ordinal: number;
  readonly status: Agent['status'];
  readonly startedAt?: string;
  readonly completedAt?: string;
};

const agent = ({ id, stepId, ordinal, status, startedAt, completedAt }: AgentParams): Agent => ({
  id: typedString<AgentId>({ value: id }),
  sessionId: SESSION_ID,
  stepId,
  workflowRunId: WORKFLOW_RUN_ID,
  ordinal,
  name: id,
  status,
  ...(startedAt != null ? { startedAt: typedString<IsoDateTime>({ value: startedAt }) } : {}),
  ...(completedAt != null ? { completedAt: typedString<IsoDateTime>({ value: completedAt }) } : {}),
});

const DONE_AGENT = agent({
  id: 'plan-agent',
  stepId: PLAN.id,
  ordinal: 0,
  status: 'completed',
  startedAt: '2026-08-17T09:00:00Z',
  completedAt: '2026-08-17T09:30:00Z',
});

const NEXT_AGENT = agent({
  id: 'implement-agent',
  stepId: IMPLEMENT.id,
  ordinal: 1,
  status: 'pending',
});

const LATER_AGENT = agent({
  id: 'review-agent',
  stepId: REVIEW.id,
  ordinal: 2,
  status: 'pending',
});

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: typedString<WorkspaceId>({ value: 'workspace-1' }),
  name: 'Release workflow',
  description: '',
  steps: [PLAN, IMPLEMENT, REVIEW],
  createdAt: typedString<IsoDateTime>({ value: '2026-08-17T08:00:00Z' }),
  updatedAt: typedString<IsoDateTime>({ value: '2026-08-17T08:00:00Z' }),
};

const RUN: WorkflowRun = {
  id: WORKFLOW_RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'manual',
  executionMode: 'static',
  createdAt: typedString<IsoDateTime>({ value: '2026-08-17T08:00:00Z' }),
};

const doneChild: TimelineAgentEntry = {
  kind: 'agent',
  id: `agent:${DONE_AGENT.id}`,
  at: '2026-08-17T09:00:00Z',
  agent: DONE_AGENT,
  agentKind: 'planner',
  depth: 1,
  clusterIndex: null,
  terminalQuestions: [],
  answers: [],
  hasDuration: true,
};

type EntryParams = {
  readonly pendingAgents: ReadonlyArray<Agent>;
};

const runEntry = ({ pendingAgents }: EntryParams): TimelineRunEntry => ({
  kind: 'run',
  id: `run:${RUN.id}`,
  at: '2026-08-17T09:30:00Z',
  run: RUN,
  workflow: WORKFLOW,
  children: [doneChild],
  pendingAgents,
  producedPlan: null,
  depth: 0,
});

type RenderParams = {
  readonly pendingAgents: ReadonlyArray<Agent>;
  readonly onAdvance: (params: { readonly agentId: string }) => void;
};

const renderRow = ({ pendingAgents, onAdvance }: RenderParams) =>
  render(
    <TimelineRunRow
      entry={runEntry({ pendingAgents })}
      sessionId={SESSION_ID}
      timeLabel="09:30"
      advanceState={{ kind: 'ready', step: IMPLEMENT }}
      onAdvance={onAdvance}
      diffCommentByAgentId={new Map()}
    />,
  );

beforeEach(() => {
  store.setFocusedWorkflowRun.mockClear();
  store.setActiveLens.mockClear();
  store.selectAgent.mockClear();
});

afterEach(cleanup);

describe('TimelineRunRow', () => {
  it('keeps the workflow reference on one line and drops step counts', () => {
    renderRow({ pendingAgents: [NEXT_AGENT, LATER_AGENT], onAdvance: vi.fn() });

    expect(screen.getByText('Release workflow')).toBeDefined();
    expect(screen.queryByText('1/3')).toBeNull();
  });

  it('offers the pending next step and starts it', () => {
    const onAdvance = vi.fn();
    renderRow({ pendingAgents: [NEXT_AGENT, LATER_AGENT], onAdvance });

    expect(screen.getByText('Implement')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Start step' }));
    expect(onAdvance).toHaveBeenCalledWith({ agentId: NEXT_AGENT.id });
  });

  it('navigates the whole run row to the workflows lens', () => {
    renderRow({ pendingAgents: [NEXT_AGENT, LATER_AGENT], onAdvance: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /open Release workflow workflow/i }));
    expect(store.setFocusedWorkflowRun).toHaveBeenCalledWith(SESSION_ID, RUN.id);
    expect(store.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'workflows');
  });

  it('names the collapse action for the run it toggles', () => {
    renderRow({ pendingAgents: [NEXT_AGENT, LATER_AGENT], onAdvance: vi.fn() });
    const toggle = screen.getByRole('button', { name: 'Collapse Release workflow' });

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(screen.queryByRole('button', { name: 'Start step' })).toBeNull();
  });
});
