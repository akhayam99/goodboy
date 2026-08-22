// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, SessionProjectMount } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    sessionProjectMounts: {} as Record<string, ReadonlyArray<SessionProjectMount>>,
    sessionActiveProject: {} as Record<string, string>,
    sessions: [{ id: 'session-1', workspaceId: 'workspace-1' }] as ReadonlyArray<{
      id: string;
      workspaceId: string;
    }>,
    projects: [] as ReadonlyArray<{ id: string; workspaceId: string; name: string; kind: string }>,
    setSessionActiveProject: vi.fn(),
    materializeProject: vi.fn(),
    emitNotification: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

import { ProjectSwitcher } from '.';

const API_PROJECT_ID = 'project-api' as ProjectId;
const WEB_PROJECT_ID = 'project-web' as ProjectId;

const API_MOUNT = {
  projectId: API_PROJECT_ID,
  mountName: 'api',
  worktreePath: '/worktrees/api',
  repoRoot: '/repos/api',
  branch: 'ak/project-scope',
} satisfies SessionProjectMount;

const WEB_MOUNT = {
  projectId: WEB_PROJECT_ID,
  mountName: 'web',
  worktreePath: '/worktrees/web',
  repoRoot: '/repos/web',
  branch: 'ak/project-scope',
} satisfies SessionProjectMount;

beforeEach(() => {
  store.sessionProjectMounts = { 'session-1': [API_MOUNT, WEB_MOUNT] };
  store.sessionActiveProject = { 'session-1': WEB_PROJECT_ID };
  store.setSessionActiveProject.mockReset();
});

afterEach(cleanup);

describe('ProjectSwitcher', () => {
  it('marks the active mount and selects another project', () => {
    render(<ProjectSwitcher sessionId={'session-1' as never} />);

    expect(screen.getByRole('tab', { name: 'web' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'api' }));
    expect(store.setSessionActiveProject).toHaveBeenCalledWith({
      sessionId: 'session-1',
      projectId: 'project-api',
    });
  });

  it('stays hidden for a session with one mount', () => {
    store.sessionProjectMounts = { 'session-1': [API_MOUNT] };

    render(<ProjectSwitcher sessionId={'session-1' as never} />);

    expect(screen.queryByRole('tablist', { name: 'Active project' })).toBeNull();
  });

  it('offers the unmaterialized projects and materializes the picked one manually', async () => {
    store.projects = [
      { id: 'project-api', workspaceId: 'workspace-1', name: 'api', kind: 'repo' },
      { id: 'project-web', workspaceId: 'workspace-1', name: 'web', kind: 'repo' },
      { id: 'project-docs', workspaceId: 'workspace-1', name: 'docs', kind: 'folder' },
    ];
    store.materializeProject.mockResolvedValue(API_MOUNT);

    render(<ProjectSwitcher sessionId={'session-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add a project to this session' }));
    fireEvent.click(screen.getByText('docs'));

    await waitFor(() =>
      expect(store.materializeProject).toHaveBeenCalledWith({
        sessionId: 'session-1',
        projectId: 'project-docs',
        reason: 'added manually by the user',
      }),
    );
  });

  it('shows no add control when every workspace project is already mounted', () => {
    store.projects = [
      { id: 'project-api', workspaceId: 'workspace-1', name: 'api', kind: 'repo' },
      { id: 'project-web', workspaceId: 'workspace-1', name: 'web', kind: 'repo' },
    ];

    render(<ProjectSwitcher sessionId={'session-1' as never} />);

    expect(screen.queryByRole('button', { name: 'Add a project to this session' })).toBeNull();
  });
});
