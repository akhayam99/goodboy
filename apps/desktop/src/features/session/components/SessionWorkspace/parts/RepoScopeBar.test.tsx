// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    sessionProjectMounts: {} as Record<string, ReadonlyArray<SessionProjectMount>>,
    sessionActiveProject: {} as Record<string, string>,
    sessions: [] as ReadonlyArray<{ id: string; workspaceId: string }>,
    projects: [] as ReadonlyArray<{ id: string; workspaceId: string }>,
    setSessionActiveProject: vi.fn(),
    materializeProject: vi.fn(),
    emitNotification: vi.fn(),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

import { RepoScopeBar } from './RepoScopeBar';

const SESSION_ID = 'session-1' as SessionId;
const API_PROJECT_ID = 'project-api' as ProjectId;
const WEB_PROJECT_ID = 'project-web' as ProjectId;

const mount = (projectId: ProjectId, mountName: string): SessionProjectMount => ({
  projectId,
  mountName,
  worktreePath: `/worktrees/${mountName}`,
  repoRoot: `/repos/${mountName}`,
  branch: 'ak/project-scope',
});

beforeEach(() => {
  store.sessionProjectMounts = {
    [SESSION_ID]: [mount(API_PROJECT_ID, 'api'), mount(WEB_PROJECT_ID, 'web')],
  };
  store.sessionActiveProject = { [SESSION_ID]: WEB_PROJECT_ID };
  store.setSessionActiveProject.mockReset();
});

afterEach(cleanup);

describe('RepoScopeBar', () => {
  it('scopes the content below from its own row', () => {
    render(<RepoScopeBar sessionId={SESSION_ID} />);

    expect(screen.getByTestId('repo-scope-bar').textContent).toContain('Scoped to');
    fireEvent.click(screen.getByRole('tab', { name: 'api' }));

    expect(store.setSessionActiveProject).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      projectId: API_PROJECT_ID,
    });
  });

  it('costs no row at all on a single-repo session', () => {
    store.sessionProjectMounts = { [SESSION_ID]: [mount(API_PROJECT_ID, 'api')] };

    render(<RepoScopeBar sessionId={SESSION_ID} />);

    expect(screen.queryByTestId('repo-scope-bar')).toBeNull();
  });
});
