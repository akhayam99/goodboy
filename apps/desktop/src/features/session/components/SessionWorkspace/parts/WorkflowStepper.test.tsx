import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

type Store = {
  sessionPhaseRuns: Record<string, ReadonlyArray<Agent>>;
  phaseTemplates: Record<string, ReadonlyArray<Workflow>>;
  sessionWorkflows: Record<string, ReadonlyArray<Workflow>>;
  selectAgent: ReturnType<typeof vi.fn>;
  agentTurnState: Record<string, unknown>;
  skipStuckStepAndAdvance: ReturnType<typeof vi.fn>;
};

const { store } = vi.hoisted(() => ({
  store: {
    sessionPhaseRuns: {},
    phaseTemplates: {},
    sessionWorkflows: {},
    selectAgent: vi.fn(async () => undefined),
    agentTurnState: {},
    skipStuckStepAndAdvance: vi.fn(async () => undefined),
  } as Store,
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: Store) => T) => selector(store),
}));

import { WorkflowStepper } from './WorkflowStepper';

const NOW = '2026-07-21T00:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;

const steps = ['Plan', 'Build', 'Verify', 'Ship', 'Later'].map(
  (name, index): Step => ({
    id: `step-${index + 1}` as StepId,
    workflowId: WORKFLOW_ID,
    ordinal: index,
    name,
    promptPrefix: '',
  }),
);

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Release flow',
  description: '',
  steps,
  createdAt: NOW,
  updatedAt: NOW,
};

const session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  workflowRuns: [
    {
      id: RUN_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      currentStep: 1,
      autoRun: true,
      triggerMode: 'immediate',
    },
  ],
} as unknown as Session;

type AgentParams = {
  readonly id: string;
  readonly stepIndex?: number;
  readonly name: string;
  readonly status: Agent['status'];
  readonly parentAgentId?: AgentId;
  readonly hasWorkflow?: boolean;
};

const createAgent = ({
  id,
  stepIndex,
  name,
  status,
  parentAgentId,
  hasWorkflow = true,
}: AgentParams): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  ordinal: stepIndex ?? 0,
  name,
  status,
  ...(stepIndex != null && { stepId: steps[stepIndex]?.id }),
  ...(hasWorkflow && { workflowRunId: RUN_ID }),
  ...(parentAgentId != null && { parentAgentId }),
});

const roots = [
  createAgent({ id: 'root-plan', stepIndex: 0, name: 'Plan agent', status: 'completed' }),
  createAgent({ id: 'root-build', stepIndex: 1, name: 'Build agent', status: 'running' }),
  createAgent({ id: 'root-verify', stepIndex: 2, name: 'Verify agent', status: 'failed' }),
  createAgent({ id: 'root-ship', stepIndex: 3, name: 'Ship agent', status: 'pending' }),
];
const selectedChild = createAgent({
  id: 'child-selected',
  name: 'Child selected',
  status: 'completed',
  parentAgentId: roots[1]?.id,
});
const runningChild = createAgent({
  id: 'child-running',
  name: 'Child running',
  status: 'running',
  parentAgentId: roots[1]?.id,
});

beforeEach(() => {
  store.sessionPhaseRuns = { [SESSION_ID]: [...roots, selectedChild, runningChild] };
  store.phaseTemplates = { [WORKSPACE_ID]: [workflow] };
  store.sessionWorkflows = {};
  store.selectAgent.mockReset();
  store.selectAgent.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('WorkflowStepper', () => {
  it('maps statuses and accents the selected child parent step', () => {
    render(
      <WorkflowStepper
        sessionId={SESSION_ID}
        session={session}
        selectedAgentId={selectedChild.id}
      />,
    );

    expect(screen.getByLabelText('Plan status: completed')).toBeDefined();
    expect(screen.getByLabelText('Build status: running')).toBeDefined();
    expect(screen.getByLabelText('Verify status: failed')).toBeDefined();
    expect(screen.getByLabelText('Ship status: pending')).toBeDefined();
    expect(screen.getByLabelText('Later status: pending')).toBeDefined();
    expect(screen.getByRole('button', { name: '2 Build' }).getAttribute('aria-current')).toBe(
      'step',
    );
    expect(screen.getByRole('button', { name: '2 Build' }).className).toContain('font-medium');
  });

  it('selects an available step root and keeps pending steps inert', () => {
    render(
      <WorkflowStepper
        sessionId={SESSION_ID}
        session={session}
        selectedAgentId={selectedChild.id}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '1 Plan' }));
    expect(store.selectAgent).toHaveBeenCalledWith(SESSION_ID, roots[0]?.id);

    store.selectAgent.mockClear();
    const pendingRoot = screen.getByRole('button', { name: '4 Ship' });
    const missingRoot = screen.getByRole('button', { name: '5 Later' });
    expect(pendingRoot).toHaveProperty('disabled', true);
    expect(missingRoot).toHaveProperty('disabled', true);
    fireEvent.click(pendingRoot);
    fireEvent.click(missingRoot);
    expect(store.selectAgent).not.toHaveBeenCalled();
  });

  it('opens clusters, marks the selected child, and selects another child', () => {
    render(
      <WorkflowStepper
        sessionId={SESSION_ID}
        session={session}
        selectedAgentId={selectedChild.id}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'clusters 1/2 for Build' }));
    expect(screen.getByRole('menu', { name: 'clusters for Build agent' })).toBeDefined();
    expect(
      screen.getByRole('menuitem', { name: /Child selected/ }).getAttribute('aria-current'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('menuitem', { name: /Child running/ }));
    expect(store.selectAgent).toHaveBeenCalledWith(SESSION_ID, runningChild.id);
  });

  it('renders nothing for a non-workflow agent', () => {
    const standalone = createAgent({
      id: 'standalone',
      name: 'Standalone',
      status: 'running',
      hasWorkflow: false,
    });
    store.sessionPhaseRuns = { [SESSION_ID]: [standalone] };
    const { container } = render(
      <WorkflowStepper sessionId={SESSION_ID} session={session} selectedAgentId={standalone.id} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
