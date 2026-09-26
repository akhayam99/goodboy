// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  IsoDateTime,
  Session,
  SessionId,
  WorkflowRun,
  WorkspaceId,
} from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    openArtifactCreation: vi.fn(),
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<Agent>>,
  },
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../CreateAgentPopover', () => ({
  CreateAgentPopover: () => <button type="button">Start agent</button>,
}));

import { OverviewActions } from './index';

const SESSION_ID: SessionId = JSON.parse(JSON.stringify('session-1'));
const NOW = '2026-08-01T00:00:00.000Z' as IsoDateTime;

const SESSION = {
  id: SESSION_ID,
  workspaceId: JSON.parse(JSON.stringify('workspace-1')) as WorkspaceId,
  goal: 'Ship the thing',
  state: { kind: 'draft' },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'bypassPermissions',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
} satisfies Session;

const RUN = {
  id: JSON.parse(JSON.stringify('run-1')),
  workflowId: JSON.parse(JSON.stringify('workflow-1')),
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'manual',
  executionMode: 'static',
} satisfies WorkflowRun;

beforeEach(() => {
  vi.clearAllMocks();
  state.sessionPhaseRuns = {};
});

afterEach(cleanup);

describe('OverviewActions', () => {
  it('offers Run workflow and Start agent when the session has no active run', () => {
    render(
      <OverviewActions session={SESSION} onOpenWorkflowBuilder={vi.fn()} onOpenRun={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Start agent' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Run workflow/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Open run/ })).toBeNull();
  });

  it('calls onOpenWorkflowBuilder from Run workflow', () => {
    const onOpenWorkflowBuilder = vi.fn();
    render(
      <OverviewActions
        session={SESSION}
        onOpenWorkflowBuilder={onOpenWorkflowBuilder}
        onOpenRun={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Run workflow/ }));

    expect(onOpenWorkflowBuilder).toHaveBeenCalledOnce();
  });

  it('swaps to Open run when the session has an active workflow run', () => {
    const onOpenRun = vi.fn();
    const session = { ...SESSION, workflowRuns: [RUN] } satisfies Session;
    render(
      <OverviewActions session={session} onOpenWorkflowBuilder={vi.fn()} onOpenRun={onOpenRun} />,
    );

    expect(screen.queryByRole('button', { name: /Run workflow/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Open run/ }));

    expect(onOpenRun).toHaveBeenCalledOnce();
  });

  it('treats a run whose agents all concluded as inactive', () => {
    state.sessionPhaseRuns[SESSION_ID] = [
      {
        id: JSON.parse(JSON.stringify('agent-1')),
        workflowRunId: RUN.id,
        status: 'completed',
      } as Agent,
    ];
    const session = { ...SESSION, workflowRuns: [RUN] } satisfies Session;
    render(
      <OverviewActions session={session} onOpenWorkflowBuilder={vi.fn()} onOpenRun={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /Run workflow/ })).toBeDefined();
  });

  it('puts Report and Wireframe in the Create menu, not Workflow', () => {
    render(
      <OverviewActions session={SESSION} onOpenWorkflowBuilder={vi.fn()} onOpenRun={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.querySelector('.font-medium')?.textContent)).toEqual([
      'Report',
      'Wireframe',
    ]);
  });

  it.each([
    ['Report', 'report'],
    ['Wireframe', 'wireframe'],
  ] as const)('opens the %s creation from its item', (label, kind) => {
    render(
      <OverviewActions session={SESSION} onOpenWorkflowBuilder={vi.fn()} onOpenRun={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(`^${label}`) }));

    expect(state.openArtifactCreation).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind,
      workflowRunId: null,
    });
  });
});
