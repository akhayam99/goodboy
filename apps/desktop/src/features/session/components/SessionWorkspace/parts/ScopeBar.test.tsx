// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    sessionProjectMounts: {} as Record<string, ReadonlyArray<SessionProjectMount>>,
    sessionActiveProject: {} as Record<string, string>,
    sessions: [] as ReadonlyArray<{ id: string; workspaceId: string }>,
    projects: [] as ReadonlyArray<{
      id: string;
      workspaceId: string;
      name: string;
      kind: string;
      rootPath: string;
    }>,
    setSessionActiveProject: vi.fn(),
    materializeProject: vi.fn(async () => undefined),
    detachProject: vi.fn(async () => undefined),
    emitNotification: vi.fn(),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

import { ScopeBar } from './ScopeBar';

const SESSION_ID = 'session-1' as SessionId;
const API_PROJECT_ID = 'project-api' as ProjectId;
const WEB_PROJECT_ID = 'project-web' as ProjectId;
const DOCS_PROJECT_ID = 'project-docs' as ProjectId;

const mount = (projectId: ProjectId, mountName: string): SessionProjectMount => ({
  projectId,
  mountName,
  worktreePath: `/worktrees/${mountName}`,
  repoRoot: `/repos/${mountName}`,
  branch: 'ak/project-scope',
});

const project = (id: ProjectId, name: string) => ({
  id,
  workspaceId: 'ws-1',
  name,
  kind: 'repo',
  rootPath: `/repos/${name}`,
});

beforeEach(() => {
  vi.clearAllMocks();
  store.sessions = [{ id: SESSION_ID, workspaceId: 'ws-1' }];
  store.projects = [
    project(API_PROJECT_ID, 'api'),
    project(WEB_PROJECT_ID, 'web'),
    project(DOCS_PROJECT_ID, 'docs'),
  ];
  store.sessionProjectMounts = {
    [SESSION_ID]: [mount(API_PROJECT_ID, 'api'), mount(WEB_PROJECT_ID, 'web')],
  };
  store.sessionActiveProject = { [SESSION_ID]: WEB_PROJECT_ID };
});

afterEach(cleanup);

describe('ScopeBar', () => {
  it('lists every workspace project and tells mounted from unmounted', () => {
    render(<ScopeBar sessionId={SESSION_ID} />);

    expect(screen.getByTestId('repo-scope-bar').textContent).toContain('Scoped to');
    expect(screen.getByRole('button', { name: 'Detach api' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Detach web' })).toBeDefined();
    expect(screen.getByTitle('Mount docs into this session')).toBeDefined();
  });

  it('mounts an unmounted project on click', () => {
    render(<ScopeBar sessionId={SESSION_ID} />);

    fireEvent.click(screen.getByTitle('Mount docs into this session'));

    expect(store.materializeProject).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      projectId: DOCS_PROJECT_ID,
      reason: 'added manually by the user',
    });
  });

  it('switches the active project from a mounted chip', () => {
    render(<ScopeBar sessionId={SESSION_ID} />);

    fireEvent.click(screen.getByTitle('api on ak/project-scope'));

    expect(store.setSessionActiveProject).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      projectId: API_PROJECT_ID,
    });
  });

  it('detaches only after the inline confirm, never straight away', async () => {
    render(<ScopeBar sessionId={SESSION_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Detach api' }));
    expect(store.detachProject).not.toHaveBeenCalled();
    expect(screen.getByText('Detach api?')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Detach' }));

    expect(store.detachProject).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      projectId: API_PROJECT_ID,
    });
  });

  it('backs out of the confirm without detaching', () => {
    render(<ScopeBar sessionId={SESSION_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Detach api' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep the project mounted' }));

    expect(store.detachProject).not.toHaveBeenCalled();
    expect(screen.queryByText('Detach api?')).toBeNull();
  });

  it('keeps the strip on a single-project session so the mount stays visible', () => {
    store.projects = [project(API_PROJECT_ID, 'api')];
    store.sessionProjectMounts = { [SESSION_ID]: [mount(API_PROJECT_ID, 'api')] };
    store.sessionActiveProject = { [SESSION_ID]: API_PROJECT_ID };

    render(<ScopeBar sessionId={SESSION_ID} />);

    expect(screen.getByTestId('repo-scope-bar')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Detach api' })).toBeDefined();
  });

  it('renders nothing when the workspace has no projects', () => {
    store.projects = [];
    store.sessionProjectMounts = {};

    render(<ScopeBar sessionId={SESSION_ID} />);

    expect(screen.queryByTestId('repo-scope-bar')).toBeNull();
  });
});
