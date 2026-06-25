import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Workspace, WorkspaceId } from '@goodboy/types';

const { state, currentWorkspace } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    archivedSessions: {} as Record<string, ReadonlyArray<unknown>>,
    providers: [] as ReadonlyArray<{ connection: string }>,
    setCurrentSession: vi.fn(),
    loadArchivedSessions: vi.fn(),
  },
  currentWorkspace: { id: 'ws-1' as WorkspaceId, name: 'Test WS' } as Workspace,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useCurrentWorkspace: () => currentWorkspace,
  useCurrentSession: () => null,
  useSessions: () => [],
  useWorkspaces: () => [currentWorkspace],
  useSessionLoading: () => false,
  useSessionOpenQuestions: () => [],
  useSessionPlans: () => [],
  agentHasUnread: () => false,
  EMPTY_ARRAY: [] as never[],
}));

vi.mock('../WorkspaceHeader', () => ({ WorkspaceHeader: () => null }));
vi.mock('../SessionActivityBar', () => ({ SessionActivityBar: () => null }));
vi.mock('../WorkspaceLinkDialog', () => ({ WorkspaceLinkDialog: () => null }));

afterEach(cleanup);

import { WorkspacesSidebar } from './index';

describe('WorkspacesSidebar', () => {
  it('renders collapse toggle button', () => {
    render(<WorkspacesSidebar onToggleCollapse={vi.fn()} />);
    expect(screen.getByTitle('collapse sidebar (⌘B)')).toBeDefined();
  });

  describe('when collapsed', () => {
    it('renders the rail instead of the full sidebar', () => {
      render(<WorkspacesSidebar collapsed onToggleCollapse={vi.fn()} />);
      expect(screen.queryByTitle('collapse sidebar (⌘B)')).toBeNull();
    });
  });
});
