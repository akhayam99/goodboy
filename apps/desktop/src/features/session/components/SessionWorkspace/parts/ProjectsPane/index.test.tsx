// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProjectId, Session, SessionId, SessionProjectMount } from '@goodboy/types';

const { store, diffStats } = vi.hoisted(() => ({
  diffStats: {
    current: new Map<string, { additions: number; deletions: number }>(),
  },
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
    openMountDiff: vi.fn(),
    materializeProject: vi.fn(async () => undefined),
    detachProject: vi.fn(async () => undefined),
    emitNotification: vi.fn(),
  },
}));

vi.mock('../../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
  useMountDiffStats: () => diffStats.current,
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

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    ScrollFade: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

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
  diffStats.current = new Map([['/worktrees/api', { additions: 9, deletions: 2 }]]);
});

afterEach(cleanup);

describe('ProjectsPane', () => {
  it('titles the page and lists only the mounted projects', () => {
    render(<ProjectsPane session={session} />);

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeDefined();
    const names = screen.getAllByText(/^(api|web|docs)$/).map((node) => node.textContent);
    expect(names).toEqual(['api', 'web']);
    expect(screen.queryByRole('button', { name: 'Mount' })).toBeNull();
  });

  it('shows branch, mount path and the primary marker on mounted rows', () => {
    render(<ProjectsPane session={session} />);

    expect(screen.getAllByText('ak/project-scope')).toHaveLength(2);
    expect(screen.getByText('/worktrees/api')).toBeDefined();
    expect(screen.getByText('/worktrees/web')).toBeDefined();
    const primary = screen.getByText('Primary');
    expect(primary.closest('[class*="rounded-lg"]')?.textContent).toContain('web');
    expect(screen.queryByText('Active')).toBeNull();
  });

  it('counts the changes of each mount, and says so when a mount is clean', () => {
    render(<ProjectsPane session={session} />);

    const apiRow = screen.getByText('/worktrees/api').closest('[class*="rounded-lg"]');
    const webRow = screen.getByText('/worktrees/web').closest('[class*="rounded-lg"]');

    expect(apiRow?.textContent).toContain('+9');
    expect(apiRow?.textContent).toContain('-2');
    expect(apiRow?.textContent).not.toContain('No changes');
    expect(webRow?.textContent).toContain('No changes');
  });

  it('opens the diff of a mount that is not the active project, and leaves the active one alone', () => {
    render(<ProjectsPane session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'View the diff of api' }));

    expect(store.openMountDiff).toHaveBeenCalledWith(SESSION_ID, '/worktrees/api');
    expect(store.setSessionActiveProject).not.toHaveBeenCalled();
  });

  it('mounts an unmounted project from the CTA popover with the manual reason', async () => {
    render(<ProjectsPane session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mount another project' }));
    const dialog = screen.getByRole('dialog', { name: 'Mount another project' });
    expect(dialog.textContent).toContain('docs');
    expect(dialog.textContent).not.toContain('api');

    fireEvent.click(screen.getByRole('button', { name: 'Mount docs' }));

    expect(store.materializeProject).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      projectId: DOCS_PROJECT_ID,
      reason: 'added manually by the user',
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Mount another project' })).toBeNull();
    });
  });

  it('hides the CTA once every workspace project is mounted', () => {
    store.sessionProjectMounts = {
      [SESSION_ID]: [
        mount(API_PROJECT_ID, 'api'),
        mount(WEB_PROJECT_ID, 'web'),
        mount(DOCS_PROJECT_ID, 'docs'),
      ],
    };

    render(<ProjectsPane session={session} />);

    expect(screen.queryByRole('button', { name: 'Mount another project' })).toBeNull();
  });

  it('keeps the CTA prominent under the empty state when nothing is mounted', () => {
    store.sessionProjectMounts = {};

    render(<ProjectsPane session={session} />);

    expect(screen.getByText('No projects mounted yet')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Mount another project' })).toBeDefined();
  });

  it('offers a search input only past eight unmounted projects, and filters with it', () => {
    store.projects = [
      project(API_PROJECT_ID, 'api'),
      ...Array.from({ length: 9 }, (_, index) =>
        project(`project-extra-${index}` as ProjectId, `extra-${index}`),
      ),
    ];
    store.sessionProjectMounts = { [SESSION_ID]: [mount(API_PROJECT_ID, 'api')] };
    store.sessionActiveProject = { [SESSION_ID]: API_PROJECT_ID };

    render(<ProjectsPane session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mount another project' }));
    const search = screen.getByRole('textbox', { name: 'Search projects' });
    fireEvent.change(search, { target: { value: 'extra-3' } });

    expect(screen.getByRole('button', { name: 'Mount extra-3' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mount extra-1' })).toBeNull();
  });

  it('keeps the popover unsearchable for a short unmounted list', () => {
    render(<ProjectsPane session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mount another project' }));

    expect(screen.queryByRole('textbox', { name: 'Search projects' })).toBeNull();
  });

  it('detaches only after the inline confirm, never straight away', () => {
    render(<ProjectsPane session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Detach api' }));
    expect(store.detachProject).not.toHaveBeenCalled();
    expect(screen.getByText('Detach api?')).toBeDefined();
    expect(
      screen.getByText('Removes the clean checkout; uncommitted work stays on disk.'),
    ).toBeDefined();

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

  it('switches the primary project from a mounted row', () => {
    render(<ProjectsPane session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Make primary' }));

    expect(store.setSessionActiveProject).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      projectId: API_PROJECT_ID,
    });
  });

  it('explains what the primary project drives on hover of the pill and the switch', async () => {
    vi.useFakeTimers();
    try {
      render(<ProjectsPane session={session} />);
      const hint =
        'New agents and turns work in this project by default; other mounts stay writable';
      const pillAnchor = screen.getByText('Primary').parentElement!;

      fireEvent.mouseEnter(pillAnchor);
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      expect(screen.getByRole('tooltip').textContent).toBe(hint);
      fireEvent.mouseLeave(pillAnchor);

      fireEvent.mouseEnter(screen.getByRole('button', { name: 'Make primary' }));
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      expect(screen.getByRole('tooltip').textContent).toBe(hint);
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides the switch action when only one project is mounted', () => {
    store.sessionProjectMounts = { [SESSION_ID]: [mount(API_PROJECT_ID, 'api')] };
    store.sessionActiveProject = { [SESSION_ID]: API_PROJECT_ID };

    render(<ProjectsPane session={session} />);

    expect(screen.queryByRole('button', { name: 'Make primary' })).toBeNull();
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
    expect(screen.queryByRole('button', { name: 'Mount another project' })).toBeNull();
  });
});
