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
import { runIdentity } from '../../../../timeline/runIdentity';

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

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: typedString<WorkspaceId>({ value: 'workspace-1' }),
  name: 'Release workflow',
  description: '',
  steps: [PLAN, IMPLEMENT],
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

const childOf = ({ target }: { readonly target: Agent }): TimelineAgentEntry => ({
  kind: 'agent',
  id: `agent:${target.id}`,
  at: '2026-08-17T09:00:00Z',
  ordinal: target.ordinal,
  agent: target,
  agentKind: 'planner',
  stepLabel: `${target.ordinal + 1}`,
  openQuestions: [],
  terminalQuestions: [],
  children: [],
  answers: [],
  hasDuration: true,
});

const runEntry = (): TimelineRunEntry => ({
  kind: 'run',
  id: `run:${RUN.id}`,
  at: '2026-08-17T08:00:00Z',
  run: RUN,
  workflow: WORKFLOW,
  identity: runIdentity({ runId: RUN.id }),
  children: [childOf({ target: DONE_AGENT }), childOf({ target: NEXT_AGENT })],
  producedPlan: null,
});

type RenderParams = {
  readonly onAdvance?: (params: { readonly agentId: string }) => void;
  readonly onToggle?: () => void;
  readonly isExpanded?: boolean;
  readonly hasStalledStep?: boolean;
};

const renderRow = ({
  onAdvance = vi.fn(),
  onToggle = vi.fn(),
  isExpanded = false,
  hasStalledStep = false,
}: RenderParams = {}) =>
  render(
    <TimelineRunRow
      entry={runEntry()}
      sessionId={SESSION_ID}
      timeLabel="09:30"
      advanceState={{ kind: 'ready', step: IMPLEMENT }}
      hasStalledStep={hasStalledStep}
      isExpanded={isExpanded}
      onToggle={onToggle}
      onAdvance={onAdvance}
    />,
  );

beforeEach(() => {
  store.setFocusedWorkflowRun.mockClear();
  store.setActiveLens.mockClear();
  store.selectAgent.mockClear();
});

afterEach(cleanup);

describe('TimelineRunRow', () => {
  it('says what the run is before it says its name, and drops step counts', () => {
    renderRow();

    expect(screen.getByText('workflow')).toBeDefined();
    expect(screen.getByText('Release workflow')).toBeDefined();
    expect(screen.queryByText('1/2')).toBeNull();
  });

  it('keeps the kind chip from shrinking so it cannot wrap', () => {
    renderRow();

    expect(screen.getByText('workflow').className).toContain('shrink-0');
  });

  it('offers the next step inline and starts it', () => {
    const onAdvance = vi.fn();
    renderRow({ onAdvance });

    fireEvent.click(screen.getByRole('button', { name: 'Start Implement' }));
    expect(onAdvance).toHaveBeenCalledWith({ agentId: NEXT_AGENT.id });
  });

  it('separates the disclosure target from the navigation target', () => {
    const onToggle = vi.fn();
    renderRow({ onToggle });

    const disclosure = screen.getByRole('button', { name: 'Expand Release workflow' });
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(disclosure);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(store.setActiveLens).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Open run' }));
    expect(store.setFocusedWorkflowRun).toHaveBeenCalledWith(SESSION_ID, RUN.id);
    expect(store.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'workflows');
  });

  it('offers a restart when a step has stalled', () => {
    renderRow({ hasStalledStep: true });

    expect(screen.getByRole('button', { name: 'Restart the step' })).toBeDefined();
  });
});
