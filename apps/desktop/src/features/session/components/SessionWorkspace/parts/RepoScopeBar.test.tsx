// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId, SessionMount, WorkspaceId } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    sessionMounts: {} as Record<string, ReadonlyArray<SessionMount>>,
    sessionActiveMount: {} as Record<string, string>,
    setSessionActiveMount: vi.fn(),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

import { RepoScopeBar } from './RepoScopeBar';

const SESSION_ID = 'session-1' as SessionId;
const API_WORKSPACE_ID = 'workspace-api' as WorkspaceId;
const WEB_WORKSPACE_ID = 'workspace-web' as WorkspaceId;

const mount = (workspaceId: WorkspaceId, mountName: string): SessionMount => ({
  workspaceId,
  mountName,
  worktreePath: `/worktrees/${mountName}`,
  repoRoot: `/repos/${mountName}`,
  branch: 'ak/project-scope',
});

beforeEach(() => {
  store.sessionMounts = {
    [SESSION_ID]: [mount(API_WORKSPACE_ID, 'api'), mount(WEB_WORKSPACE_ID, 'web')],
  };
  store.sessionActiveMount = { [SESSION_ID]: WEB_WORKSPACE_ID };
  store.setSessionActiveMount.mockReset();
});

afterEach(cleanup);

describe('RepoScopeBar', () => {
  it('scopes the content below from its own row', () => {
    render(<RepoScopeBar sessionId={SESSION_ID} />);

    expect(screen.getByTestId('repo-scope-bar').textContent).toContain('Scoped to');
    fireEvent.click(screen.getByRole('tab', { name: 'api' }));

    expect(store.setSessionActiveMount).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      workspaceId: API_WORKSPACE_ID,
    });
  });

  it('costs no row at all on a single-repo session', () => {
    store.sessionMounts = { [SESSION_ID]: [mount(API_WORKSPACE_ID, 'api')] };

    render(<RepoScopeBar sessionId={SESSION_ID} />);

    expect(screen.queryByTestId('repo-scope-bar')).toBeNull();
  });
});
