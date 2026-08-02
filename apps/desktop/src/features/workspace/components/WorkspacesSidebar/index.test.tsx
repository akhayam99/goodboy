import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, Workspace, WorkspaceId } from '@goodboy/types';

const { state, currentWorkspace, currentSessionRef } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    archivedSessions: {} as Record<string, ReadonlyArray<unknown>>,
    providers: [] as ReadonlyArray<{ connection: string }>,
    setCurrentSession: vi.fn(),
    loadArchivedSessions: vi.fn(),
  },
  currentWorkspace: {
    id: 'ws-1' as WorkspaceId,
    name: 'Test WS',
    rootPath: '/code/test-ws',
  } as Workspace,
  currentSessionRef: { value: null as Session | null },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useCurrentWorkspace: () => currentWorkspace,
  useHasUnreadElsewhere: () => false,
  useCurrentSession: () => currentSessionRef.value,
  useSessions: () => [],
  useWorkspaces: () => [currentWorkspace],
  useSessionLoading: () => false,
  useSessionOpenQuestions: () => [],
  useSessionPlans: () => [],
  agentHasUnread: () => false,
  EMPTY_ARRAY: [] as never[],
}));

vi.mock('../SessionActivityBar', () => ({ SessionActivityBar: () => null }));
vi.mock('../WorkspaceLinkDialog', () => ({ WorkspaceLinkDialog: () => null }));

afterEach(cleanup);

import { WorkspacesSidebar } from './index';

describe('WorkspacesSidebar', () => {
  it('keeps the back-to-board button on the primary tone', () => {
    currentSessionRef.value = { id: 'session-1' } as Session;
    render(<WorkspacesSidebar />);
    const back = screen.getByRole('button', { name: 'back to board' });
    expect(back.className).toContain('bg-primary text-primary-foreground');
    expect(back.className).not.toContain('text-accent');
    currentSessionRef.value = null;
  });

  it('renders without crashing when workspace is selected', () => {
    currentSessionRef.value = null;
    render(<WorkspacesSidebar />);
    expect(screen.queryByRole('button', { name: /collapse sidebar/i })).toBeNull();
  });

  it('leaves the column control to the workspace header', () => {
    currentSessionRef.value = { id: 'session-1' } as Session;
    render(<WorkspacesSidebar />);

    expect(screen.queryByRole('button', { name: /sessions column/i })).toBeNull();
    currentSessionRef.value = null;
  });

  it('tells the peek to close once the board takes over', () => {
    currentSessionRef.value = { id: 'session-1' } as Session;
    const onNavigate = vi.fn();
    render(<WorkspacesSidebar onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: 'back to board' }));
    expect(onNavigate).toHaveBeenCalledOnce();
    currentSessionRef.value = null;
  });
});
