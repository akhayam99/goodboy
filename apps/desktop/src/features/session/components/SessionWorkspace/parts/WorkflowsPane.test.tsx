// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, Session, Workflow } from '@goodboy/types';

type Store = {
  phaseTemplates: Record<string, ReadonlyArray<Workflow>>;
  sessionWorkflows: Record<string, ReadonlyArray<Workflow>>;
  sessionPhaseRuns: Record<string, ReadonlyArray<Agent>>;
  focusedWorkflowRunId: Record<string, string | null>;
  setFocusedWorkflowRun: ReturnType<typeof vi.fn>;
};

type ButtonMockProps = React.ComponentProps<'button'>;
type DividerMockProps = { readonly orientation?: string };
type ChildrenMockProps = { readonly children: React.ReactNode };
type AgentsSectionMockProps = { readonly workflowRunId?: string };
type BuildWorkflowParams = { readonly id: string; readonly name: string };
type BuildSessionParams = { readonly runIds: ReadonlyArray<string> };

const store: Store = {
  phaseTemplates: {},
  sessionWorkflows: {},
  sessionPhaseRuns: {},
  focusedWorkflowRunId: {},
  setFocusedWorkflowRun: vi.fn(),
};

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: Store) => T) => selector(store),
}));

vi.mock('@goodboy/ui', () => ({
  Button: ({ children, onClick, className }: ButtonMockProps) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
  Divider: ({ orientation }: DividerMockProps) => (
    <div data-testid="divider" data-orientation={orientation ?? 'horizontal'} />
  ),
  EmptyState: ({ title }: { readonly title: string }) => (
    <div data-testid="workflow-empty">{title}</div>
  ),
  ScrollFade: ({ children }: ChildrenMockProps) => <div>{children}</div>,
  StatusDot: () => <span data-testid="status-dot" />,
  cn: (...values: ReadonlyArray<unknown>) => values.filter(Boolean).join(' '),
}));

vi.mock('../../../../workspace/components/WorkspacesSidebar/parts/AgentsSection', () => ({
  AgentsSection: ({ workflowRunId }: AgentsSectionMockProps) => (
    <div data-testid="workflow-detail" data-run-id={workflowRunId} />
  ),
}));

import { WorkflowsPane } from './WorkflowsPane';

const SESSION_ID = 'session-1';
const WORKSPACE_ID = 'workspace-1';

const buildWorkflow = ({ id, name }: BuildWorkflowParams) =>
  ({
    id,
    workspaceId: WORKSPACE_ID,
    name,
    description: '',
    steps: [
      { id: `${id}-step-1`, workflowId: id, ordinal: 0, name: 'First', promptPrefix: '' },
      { id: `${id}-step-2`, workflowId: id, ordinal: 1, name: 'Second', promptPrefix: '' },
    ],
    createdAt: '2026-07-21T00:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z',
  }) as unknown as Workflow;

const firstWorkflow = buildWorkflow({ id: 'workflow-1', name: 'First workflow' });
const secondWorkflow = buildWorkflow({ id: 'workflow-2', name: 'Second workflow' });

const buildSession = ({ runIds }: BuildSessionParams) =>
  ({
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    workflowRuns: runIds.map((id, ordinal) => ({
      id,
      workflowId: id === 'run-1' ? firstWorkflow.id : secondWorkflow.id,
      ordinal,
      currentStep: 0,
      autoRun: true,
      triggerMode: 'immediate',
    })),
  }) as unknown as Session;

beforeEach(() => {
  store.phaseTemplates = { [WORKSPACE_ID]: [firstWorkflow, secondWorkflow] };
  store.sessionWorkflows = {};
  store.sessionPhaseRuns = {};
  store.focusedWorkflowRunId = {};
  store.setFocusedWorkflowRun.mockReset();
});

afterEach(cleanup);

describe('WorkflowsPane', () => {
  it('offers only the empty state when no workflow is attached', () => {
    render(<WorkflowsPane session={buildSession({ runIds: [] })} />);

    expect(screen.getByTestId('workflow-empty')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Attach another workflow' })).toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Attached workflows' })).toBeNull();
  });

  it('keeps one layout for a single run: no rail, attach lives in the section header', () => {
    render(<WorkflowsPane session={buildSession({ runIds: ['run-1'] })} />);

    expect(screen.queryByRole('complementary', { name: 'Attached workflows' })).toBeNull();
    expect(screen.getByTestId('workflow-detail').getAttribute('data-run-id')).toBe('run-1');
    expect(screen.getByRole('heading', { name: 'Workflows' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Attach another workflow' })).toBeDefined();
  });

  it('adds the rail for multiple runs and shows the next step instead of the step counter', () => {
    store.focusedWorkflowRunId = { [SESSION_ID]: 'run-2' };
    render(<WorkflowsPane session={buildSession({ runIds: ['run-1', 'run-2'] })} />);

    expect(screen.getByRole('complementary', { name: 'Attached workflows' })).toBeDefined();
    expect(screen.getAllByText('Next: First')).toHaveLength(2);
    expect(screen.queryByText('0/2 steps')).toBeNull();
    expect(screen.getByTestId('workflow-detail').getAttribute('data-run-id')).toBe('run-2');
    expect(screen.getAllByRole('button', { name: 'Attach another workflow' })).toHaveLength(1);
  });

  it('focuses a run when its rail card is clicked', () => {
    store.focusedWorkflowRunId = { [SESSION_ID]: 'run-2' };
    render(<WorkflowsPane session={buildSession({ runIds: ['run-1', 'run-2'] })} />);

    fireEvent.click(screen.getByText('First workflow'));

    expect(store.setFocusedWorkflowRun).toHaveBeenCalledWith(SESSION_ID, 'run-1');
  });

  it('falls back to the first run when focus is stale', () => {
    store.focusedWorkflowRunId = { [SESSION_ID]: 'missing-run' };
    render(<WorkflowsPane session={buildSession({ runIds: ['run-1', 'run-2'] })} />);

    expect(screen.getByTestId('workflow-detail').getAttribute('data-run-id')).toBe('run-1');
    expect(screen.getByText('First workflow').closest('button')?.getAttribute('aria-current')).toBe(
      'true',
    );
  });
});
