// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime, ProviderRunId, Session, Workspace, WorkspaceId } from '@goodboy/types';

interface MockState {
  pendingWorkspaceSwitch: { targetId: WorkspaceId | null } | null;
  sessions: ReadonlyArray<Session>;
  workspaces: ReadonlyArray<Workspace>;
  confirmWorkspaceSwitch: ReturnType<typeof vi.fn>;
  cancelWorkspaceSwitch: ReturnType<typeof vi.fn>;
}

const { state } = vi.hoisted<{ state: MockState }>(() => ({
  state: {
    pendingWorkspaceSwitch: null,
    sessions: [],
    workspaces: [],
    confirmWorkspaceSwitch: vi.fn(async () => undefined),
    cancelWorkspaceSwitch: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: MockState) => T) => selector(state),
  useWorkspaces: () => state.workspaces,
}));

import { WorkspaceSwitchDialog } from './index';

const NOW = '2026-06-05T00:00:00.000Z' as IsoDateTime;

function buildRunningSession(id: string, goal: string): Session {
  return {
    id,
    workspaceId: 'ws-a',
    goal,
    state: { kind: 'running', runId: 'run-1' as ProviderRunId, startedAt: NOW },
    workflowRuns: [],
  } as unknown as Session;
}

beforeEach(() => {
  state.pendingWorkspaceSwitch = { targetId: 'ws-b' as WorkspaceId };
  state.sessions = [buildRunningSession('session-1', 'ship the thing')];
  state.workspaces = [
    { id: 'ws-a', name: 'alpha' } as Workspace,
    { id: 'ws-b', name: 'bravo' } as Workspace,
  ];
  state.confirmWorkspaceSwitch = vi.fn(async () => undefined);
  state.cancelWorkspaceSwitch = vi.fn();
});
afterEach(cleanup);

describe('WorkspaceSwitchDialog', () => {
  it('renders nothing when no switch is pending', () => {
    state.pendingWorkspaceSwitch = null;
    render(<WorkspaceSwitchDialog />);
    expect(screen.queryByText('Switch workspace?')).toBeNull();
  });

  it('warns about the running agents and lists each one', () => {
    render(<WorkspaceSwitchDialog />);
    expect(screen.getByText('Switch workspace?')).toBeDefined();
    expect(screen.getByText(/1 agent is still running/i)).toBeDefined();
    expect(screen.getByText('ship the thing')).toBeDefined();
  });

  it('confirms the switch with the target workspace name on the action button', () => {
    render(<WorkspaceSwitchDialog />);
    fireEvent.click(screen.getByText('Switch to bravo'));
    expect(state.confirmWorkspaceSwitch).toHaveBeenCalledOnce();
  });

  it('cancels the switch when the user chooses to stay', () => {
    render(<WorkspaceSwitchDialog />);
    fireEvent.click(screen.getByText('Stay here'));
    expect(state.cancelWorkspaceSwitch).toHaveBeenCalledOnce();
  });
});
