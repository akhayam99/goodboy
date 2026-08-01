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
  restoreWorkflow: ReturnType<typeof vi.fn>;
};

type ButtonMockProps = React.ComponentProps<'button'>;
type DividerMockProps = { readonly orientation?: string };
type ResizeHandleMockProps = { readonly ariaLabel: string };
type ChildrenMockProps = { readonly children: React.ReactNode };
type AgentsSectionMockProps = { readonly workflowRunId?: string };
type BuildWorkflowParams = { readonly id: string; readonly name: string };
type BuildSessionParams = {
  readonly runIds: ReadonlyArray<string>;
  readonly runOverrides?: Readonly<Record<string, Record<string, unknown>>>;
};

const store: Store = {
  phaseTemplates: {},
  sessionWorkflows: {},
  sessionPhaseRuns: {},
  focusedWorkflowRunId: {},
  setFocusedWorkflowRun: vi.fn(),
  restoreWorkflow: vi.fn(),
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
  EmptyState: ({
    title,
    action,
  }: {
    readonly title: string;
    readonly action?: React.ReactNode;
  }) => (
    <div data-testid="workflow-empty">
      {title}
      {action}
    </div>
  ),
  ResizeHandle: ({ ariaLabel }: ResizeHandleMockProps) => (
    <div role="separator" aria-label={ariaLabel} />
  ),
  ScrollFade: ({ children }: ChildrenMockProps) => <div>{children}</div>,
  StatusDot: () => <span data-testid="status-dot" />,
  cn: (...values: ReadonlyArray<unknown>) => values.filter(Boolean).join(' '),
}));

vi.mock('./WorkflowRunDetail', () => ({
  WorkflowRunDetail: ({ workflowRunId }: AgentsSectionMockProps) => (
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

const buildSession = ({ runIds, runOverrides }: BuildSessionParams) =>
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
      ...(runOverrides?.[id] ?? {}),
    })),
  }) as unknown as Session;

beforeEach(() => {
  store.phaseTemplates = { [WORKSPACE_ID]: [firstWorkflow, secondWorkflow] };
  store.sessionWorkflows = {};
  store.sessionPhaseRuns = {};
  store.focusedWorkflowRunId = {};
  store.setFocusedWorkflowRun.mockReset();
  store.restoreWorkflow.mockReset();
});

afterEach(cleanup);

describe('WorkflowsPane', () => {
  it('offers only the empty state when no workflow is attached', () => {
    render(<WorkflowsPane session={buildSession({ runIds: [] })} />);

    expect(screen.getByTestId('workflow-empty')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Attach another workflow' })).toBeNull();
    expect(screen.queryByTestId('workflow-detail')).toBeNull();
  });

  it('lists the attached runs instead of opening one of them', () => {
    render(<WorkflowsPane session={buildSession({ runIds: ['run-1', 'run-2'] })} />);

    expect(screen.getByText('First workflow')).toBeDefined();
    expect(screen.getByText('Second workflow')).toBeDefined();
    expect(screen.getAllByText('Next: First')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Attach another workflow' })).toHaveLength(1);
    expect(screen.queryByTestId('workflow-detail')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Workflows' })).toBeDefined();
  });

  it('opens the detail of the focused run', () => {
    store.focusedWorkflowRunId = { [SESSION_ID]: 'run-2' };
    render(<WorkflowsPane session={buildSession({ runIds: ['run-1', 'run-2'] })} />);

    expect(screen.getByTestId('workflow-detail').getAttribute('data-run-id')).toBe('run-2');
    expect(screen.queryByText('First workflow')).toBeNull();
  });

  it('focuses a run when its card is clicked', () => {
    render(<WorkflowsPane session={buildSession({ runIds: ['run-1', 'run-2'] })} />);

    fireEvent.click(screen.getByText('First workflow'));

    expect(store.setFocusedWorkflowRun).toHaveBeenCalledWith(SESSION_ID, 'run-1');
  });

  it('stays on the list when the focused run no longer exists', () => {
    store.focusedWorkflowRunId = { [SESSION_ID]: 'missing-run' };
    render(<WorkflowsPane session={buildSession({ runIds: ['run-1', 'run-2'] })} />);

    expect(screen.queryByTestId('workflow-detail')).toBeNull();
    expect(screen.getByText('Second workflow')).toBeDefined();
  });

  it('shows the empty state when every run is completed and none is revealed', () => {
    render(
      <WorkflowsPane
        session={buildSession({
          runIds: ['run-1', 'run-2'],
          runOverrides: {
            'run-1': { executionMode: 'dynamic', orchestrationOutcome: 'done' },
            'run-2': { executionMode: 'dynamic', orchestrationOutcome: 'done' },
          },
        })}
      />,
    );

    expect(screen.getByTestId('workflow-empty').textContent).toContain('Nothing running');
    expect(screen.queryByText('First workflow')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Attach another workflow' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Completed (2)' }));

    expect(screen.queryByTestId('workflow-empty')).toBeNull();
    expect(screen.getByText('First workflow')).toBeDefined();
  });

  it('files a discarded run under its own toggle instead of the active list', () => {
    render(
      <WorkflowsPane
        session={buildSession({
          runIds: ['run-1', 'run-2'],
          runOverrides: { 'run-1': { discardedAt: '2026-07-21T10:00:00.000Z' } },
        })}
      />,
    );

    expect(screen.queryByText('First workflow')).toBeNull();
    expect(screen.getByText('Second workflow')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Discarded (1)' }));

    expect(screen.getByText('First workflow')).toBeDefined();
  });

  it('keeps the attach action when a revealed bucket is empty', () => {
    const { rerender } = render(
      <WorkflowsPane
        session={buildSession({
          runIds: ['run-1'],
          runOverrides: {
            'run-1': { executionMode: 'dynamic', orchestrationOutcome: 'done' },
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Completed (1)' }));
    rerender(
      <WorkflowsPane
        session={buildSession({
          runIds: ['run-1'],
          runOverrides: { 'run-1': { discardedAt: '2026-07-21T10:00:00.000Z' } },
        })}
      />,
    );

    expect(screen.getByTestId('workflow-empty')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Attach another workflow' })).toHaveLength(1);
  });

  it('restores a discarded run from its list card', () => {
    render(
      <WorkflowsPane
        session={buildSession({
          runIds: ['run-1', 'run-2'],
          runOverrides: { 'run-1': { discardedAt: '2026-07-21T10:00:00.000Z' } },
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Discarded (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    expect(store.restoreWorkflow).toHaveBeenCalledWith(SESSION_ID, 'run-1');
  });

  it('files a completed dynamic run under the completed toggle', () => {
    render(
      <WorkflowsPane
        session={buildSession({
          runIds: ['run-1', 'run-2'],
          runOverrides: {
            'run-1': { executionMode: 'dynamic', orchestrationOutcome: 'done' },
          },
        })}
      />,
    );

    expect(screen.queryByText('First workflow')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Completed (1)' }));

    expect(screen.getByText('First workflow')).toBeDefined();
  });
});
