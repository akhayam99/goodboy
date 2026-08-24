// @vitest-environment happy-dom

import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionId, WorkspaceId } from '@goodboy/types';

type Mount = {
  readonly projectId: string;
  readonly mountName: string;
  readonly worktreePath: string;
  readonly branch: string;
};

type Stat = { readonly additions: number; readonly deletions: number };

const { store, stats } = vi.hoisted(() => ({
  store: {
    sessions: [] as ReadonlyArray<{ id: string; activeProjectId?: string }>,
    projects: [] as ReadonlyArray<{
      id: string;
      workspaceId: string;
      name: string;
      kind: string;
    }>,
    sessionProjectMounts: {} as Record<string, ReadonlyArray<Mount>>,
    sessionActiveProject: {} as Record<string, string>,
    setSessionActiveProject: vi.fn(),
    detachProject: vi.fn(async () => undefined),
    materializeProject: vi.fn(async () => undefined),
    emitNotification: vi.fn(),
  },
  stats: { current: new Map<string, Stat>() },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: typeof store) => T) => selector(store),
  useMountDiffStats: () => stats.current,
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    ScrollFade: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Tooltip: ({ content, children }: { content: string; children: ReactElement }) => (
      <span data-tooltip={content}>{children as ReactNode}</span>
    ),
  };
});

import { ProjectChip } from './ProjectChip';

const SESSION_ID = 'sess-1' as SessionId;
const WORKSPACE_ID = 'ws-1' as WorkspaceId;

const mount = (over: Partial<Mount> = {}): Mount => ({
  projectId: 'project-1',
  mountName: 'api',
  worktreePath: '/worktrees/api',
  branch: 'goodboy/x',
  ...over,
});

const WEB_MOUNT = mount({
  projectId: 'project-2',
  mountName: 'web',
  worktreePath: '/worktrees/web',
  branch: 'goodboy/y',
});

const project = (id: string, name: string, kind = 'repo') => ({
  id,
  workspaceId: 'ws-1',
  name,
  kind,
});

const renderChip = (onSelectLens = vi.fn()) => {
  render(
    <ProjectChip sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} onSelectLens={onSelectLens} />,
  );
  return onSelectLens;
};

beforeEach(() => {
  vi.clearAllMocks();
  store.sessions = [];
  store.projects = [project('project-1', 'api'), project('project-2', 'web')];
  store.sessionProjectMounts = { [SESSION_ID]: [mount(), WEB_MOUNT] };
  store.sessionActiveProject = { [SESSION_ID]: 'project-1' };
  stats.current = new Map();
});

afterEach(cleanup);

describe('ProjectChip', () => {
  it('stays out of a workspace with no projects', () => {
    store.projects = [];
    renderChip();

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('labels the chip with the primary name and the extra-mount count', () => {
    renderChip();

    expect(screen.getByRole('button', { name: 'api +1' })).toBeDefined();
  });

  it('drops the count when a single project is mounted', () => {
    store.sessionProjectMounts = { [SESSION_ID]: [mount()] };
    renderChip();

    expect(screen.getByRole('button', { name: 'api' })).toBeDefined();
  });

  it('lists every mount and marks the primary one', () => {
    renderChip();
    fireEvent.click(screen.getByRole('button', { name: 'api +1' }));

    const primaryRow = screen.getByRole('button', { name: 'api, primary project' });
    expect(primaryRow.getAttribute('aria-current')).toBe('true');
    expect(primaryRow.className).toContain('bg-muted/30');
    const otherRow = screen.getByRole('button', { name: 'Make web primary' });
    expect(otherRow.getAttribute('aria-current')).toBeNull();
    expect(screen.queryByText('Primary')).toBeNull();
  });

  it('makes a mount primary from its row and closes the popover', () => {
    renderChip();
    fireEvent.click(screen.getByRole('button', { name: 'api +1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Make web primary' }));

    expect(store.setSessionActiveProject).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      projectId: 'project-2',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('leaves the primary untouched when its own row is clicked', () => {
    renderChip();
    fireEvent.click(screen.getByRole('button', { name: 'api +1' }));
    fireEvent.click(screen.getByRole('button', { name: 'api, primary project' }));

    expect(store.setSessionActiveProject).not.toHaveBeenCalled();
  });

  it('detaches a clean mount from its row', async () => {
    renderChip();
    fireEvent.click(screen.getByRole('button', { name: 'api +1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Detach web' }));

    await waitFor(() =>
      expect(store.detachProject).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        projectId: 'project-2',
      }),
    );
  });

  it('pre-signals a dirty mount by disabling its detach action', () => {
    stats.current = new Map([['/worktrees/web', { additions: 3, deletions: 1 }]]);
    renderChip();
    fireEvent.click(screen.getByRole('button', { name: 'api +1' }));

    const detach = screen.getByRole('button', { name: 'Detach web' });
    expect(detach.getAttribute('aria-disabled')).toBe('true');
    expect(detach.closest('[data-tooltip]')?.getAttribute('data-tooltip')).toBe(
      'Uncommitted changes keep this mount in place',
    );
    fireEvent.click(detach);
    expect(store.detachProject).not.toHaveBeenCalled();
  });

  it('mounts another project with the manual reason from the swapped view', async () => {
    store.projects = [
      project('project-1', 'api'),
      project('project-2', 'web'),
      project('project-3', 'docs'),
    ];
    renderChip();
    fireEvent.click(screen.getByRole('button', { name: 'api +1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mount another project' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mount docs' }));

    await waitFor(() =>
      expect(store.materializeProject).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        projectId: 'project-3',
        reason: 'added manually by the user',
      }),
    );
  });

  it('hides the mount affordance when every project is mounted', () => {
    renderChip();
    fireEvent.click(screen.getByRole('button', { name: 'api +1' }));

    expect(screen.queryByRole('button', { name: 'Mount another project' })).toBeNull();
  });

  it('opens the projects lens from the quiet footer link', () => {
    const onSelectLens = renderChip();
    fireEvent.click(screen.getByRole('button', { name: 'api +1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open projects page' }));

    expect(onSelectLens).toHaveBeenCalledWith('projects');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers only the mount list and the footer link when nothing is mounted', () => {
    store.sessionProjectMounts = { [SESSION_ID]: [] };
    store.sessionActiveProject = {};
    renderChip();
    fireEvent.click(screen.getByRole('button', { name: 'No project mounted' }));

    expect(screen.getByRole('button', { name: 'Mount api' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Mount web' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open projects page' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mount another project' })).toBeNull();
    expect(screen.queryByText('Primary')).toBeNull();
  });
});
