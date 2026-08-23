// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProjectId, Session, SessionId, SessionProjectMount } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    sessionProjectMounts: {} as Record<string, ReadonlyArray<SessionProjectMount>>,
    sessionActiveProject: {} as Record<string, string>,
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

vi.mock('../../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

vi.mock('../../../../../../shared/components/PaneShell', () => ({
  PaneShell: ({
    title,
    description,
    children,
  }: {
    title: string;
    description?: string;
    children: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  ),
}));

vi.mock('../../../../../worktree/BranchSwitchPanel', () => ({
  BranchSwitchPanel: ({ onDone }: { onDone: () => void }) => (
    <button type="button" onClick={onDone}>
      Complete switch
    </button>
  ),
}));

import { ProjectsPane } from './index';

const SESSION_ID = 'session-1' as SessionId;
const API_PROJECT_ID = 'project-api' as ProjectId;
const WEB_PROJECT_ID = 'project-web' as ProjectId;
const DOCS_PROJECT_ID = 'project-docs' as ProjectId;

const session = { id: SESSION_ID, workspaceId: 'ws-1' } as unknown as Session;

const mount = (projectId: ProjectId, mountName: string): SessionProjectMount => ({
  projectId,
  mountName,
  worktreePath: `/worktrees/${mountName}`,
  repoRoot: `/repos/${mountName}`,
  branch: 'ak/project-scope',
});

const project = (id: ProjectId, name: string, kind = 'repo') => ({
  id,
  workspaceId: 'ws-1',
  name,
  kind,
  rootPath: `/repos/${name}`,
});

beforeEach(() => {
  vi.clearAllMocks();
  store.projects = [
    project(DOCS_PROJECT_ID, 'docs'),
    project(API_PROJECT_ID, 'api'),
    project(WEB_PROJECT_ID, 'web'),
  ];
  store.sessionProjectMounts = {
    [SESSION_ID]: [mount(API_PROJECT_ID, 'api'), mount(WEB_PROJECT_ID, 'web')],
  };
  store.sessionActiveProject = { [SESSION_ID]: WEB_PROJECT_ID };
});

afterEach(cleanup);

describe('ProjectsPane', () => {
  it('titles the page and lists every workspace project, mounted first', () => {
    render(<ProjectsPane session={session} />);

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeDefined();
    const names = screen.getAllByText(/^(api|web|docs)$/).map((node) => node.textContent);
    expect(names).toEqual(['api', 'web', 'docs']);
  });

  it('shows branch, mount path and the active marker on mounted rows only', () => {
    render(<ProjectsPane session={session} />);

    expect(screen.getAllByText('ak/project-scope')).toHaveLength(2);
    expect(screen.getByText('/worktrees/api')).toBeDefined();
    expect(screen.getByText('/worktrees/web')).toBeDefined();
    expect(screen.queryByText('/worktrees/docs')).toBeNull();
    const active = screen.getByText('Active');
    expect(active.closest('div')?.textContent).toContain('web');
  });

  it('mounts an unmounted project with the manual reason', () => {
    render(<ProjectsPane session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mount' }));

    expect(store.materializeProject).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      projectId: DOCS_PROJECT_ID,
      reason: 'added manually by the user',
    });
  });

  it('detaches only after the inline confirm, never straight away', () => {
    render(<ProjectsPane session={session} />);

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
    render(<ProjectsPane session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Detach api' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep the project mounted' }));

    expect(store.detachProject).not.toHaveBeenCalled();
    expect(screen.queryByText('Detach api?')).toBeNull();
  });

  it('switches the active project from a mounted row', () => {
    render(<ProjectsPane session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Make active' }));

    expect(store.setSessionActiveProject).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      projectId: API_PROJECT_ID,
    });
  });

  it('hides the switch action when only one project is mounted', () => {
    store.sessionProjectMounts = { [SESSION_ID]: [mount(API_PROJECT_ID, 'api')] };
    store.sessionActiveProject = { [SESSION_ID]: API_PROJECT_ID };

    render(<ProjectsPane session={session} />);

    expect(screen.queryByRole('button', { name: 'Make active' })).toBeNull();
  });

  it('notifies when a detach fails', async () => {
    store.detachProject.mockRejectedValueOnce(new Error('worktree busy'));
    render(<ProjectsPane session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Detach api' }));
    fireEvent.click(screen.getByRole('button', { name: 'Detach' }));
    await screen.findByText('Detach api?');

    expect(store.emitNotification).toHaveBeenCalledWith(
      'error',
      'warning',
      'could not detach the project',
      'worktree busy',
      { sessionId: SESSION_ID, workspaceId: 'ws-1' },
    );
  });

  it('offers branch switching on the active mounted row only', () => {
    render(<ProjectsPane session={session} />);

    const switches = screen.getAllByRole('button', { name: 'Switch branch' });
    expect(switches).toHaveLength(1);
    expect(switches[0]?.closest('[class*="rounded-lg"]')?.textContent).toContain('web');

    fireEvent.click(switches[0]!);
    expect(screen.getByRole('dialog', { name: 'Switch branch' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Complete switch' }));
    expect(screen.queryByRole('dialog', { name: 'Switch branch' })).toBeNull();
  });

  it('keeps branch switching off a branchless mounted row', () => {
    store.sessionProjectMounts = {
      [SESSION_ID]: [{ ...mount(API_PROJECT_ID, 'api'), branch: '' }],
    };
    store.sessionActiveProject = { [SESSION_ID]: API_PROJECT_ID };

    render(<ProjectsPane session={session} />);

    expect(screen.queryByRole('button', { name: 'Switch branch' })).toBeNull();
  });

  it('shows an empty state when the workspace has no projects', () => {
    store.projects = [];
    store.sessionProjectMounts = {};

    render(<ProjectsPane session={session} />);

    expect(screen.getByText('No projects in this workspace')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mount' })).toBeNull();
  });
});
