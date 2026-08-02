// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionMount, WorkspaceId } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    sessionMounts: {} as Record<string, ReadonlyArray<SessionMount>>,
    sessionActiveMount: {} as Record<string, string>,
    setSessionActiveMount: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

import { ProjectSwitcher } from '.';

const API_WORKSPACE_ID = 'workspace-api' as WorkspaceId;
const WEB_WORKSPACE_ID = 'workspace-web' as WorkspaceId;

const API_MOUNT = {
  workspaceId: API_WORKSPACE_ID,
  mountName: 'api',
  worktreePath: '/worktrees/api',
  repoRoot: '/repos/api',
  branch: 'ak/project-scope',
} satisfies SessionMount;

const WEB_MOUNT = {
  workspaceId: WEB_WORKSPACE_ID,
  mountName: 'web',
  worktreePath: '/worktrees/web',
  repoRoot: '/repos/web',
  branch: 'ak/project-scope',
} satisfies SessionMount;

beforeEach(() => {
  store.sessionMounts = { 'session-1': [API_MOUNT, WEB_MOUNT] };
  store.sessionActiveMount = { 'session-1': WEB_WORKSPACE_ID };
  store.setSessionActiveMount.mockReset();
});

afterEach(cleanup);

describe('ProjectSwitcher', () => {
  it('marks the active mount and selects another project', () => {
    render(<ProjectSwitcher sessionId={'session-1' as never} />);

    expect(screen.getByRole('tab', { name: 'web' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'api' }));
    expect(store.setSessionActiveMount).toHaveBeenCalledWith({
      sessionId: 'session-1',
      workspaceId: 'workspace-api',
    });
  });

  it('stays hidden for a session with one mount', () => {
    store.sessionMounts = { 'session-1': [API_MOUNT] };

    render(<ProjectSwitcher sessionId={'session-1' as never} />);

    expect(screen.queryByRole('tablist', { name: 'Active project' })).toBeNull();
  });

  it('uses a compact trigger that keeps the active project name while choosing from a menu', () => {
    render(<ProjectSwitcher sessionId={'session-1' as never} density="compact" />);

    expect(screen.queryByRole('tablist', { name: 'Active project' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Active project' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'api' }));
    expect(store.setSessionActiveMount).toHaveBeenCalledWith({
      sessionId: 'session-1',
      workspaceId: 'workspace-api',
    });
  });
});
