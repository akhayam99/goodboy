// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Workspace, WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    workspaces: [] as ReadonlyArray<Workspace>,
    projects: [] as ReadonlyArray<{
      id: string;
      workspaceId: string;
      kind: string;
      rootPath: string;
    }>,
    currentWorkspace: null as Workspace | null,
    shown: new Set<WorkspaceId>(),
    openWorkspace: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useWorkspaces: () => state.workspaces,
  useWorkspaceHasUnread: () => false,
  useAppStore: (
    selector: (s: {
      openWorkspace: typeof state.openWorkspace;
      projects: typeof state.projects;
    }) => unknown,
  ) => selector({ openWorkspace: state.openWorkspace, projects: state.projects }),
}));

import { WorkspaceSwitcher } from './index';

beforeEach(() => {
  state.workspaces = [
    { id: 'ws-a', name: 'alpha', slug: 'alpha', sessionsRoot: '/repos/alpha' } as Workspace,
    { id: 'ws-b', name: 'bravo', slug: 'bravo', sessionsRoot: '/repos/bravo' } as Workspace,
  ];
  state.projects = [
    { id: 'proj-a', workspaceId: 'ws-a', kind: 'repo', rootPath: '/repos/alpha' },
    { id: 'proj-b', workspaceId: 'ws-b', kind: 'repo', rootPath: '/repos/bravo' },
  ];
  state.currentWorkspace = state.workspaces[0] ?? null;
  state.shown = new Set();
  state.openWorkspace = vi.fn(async () => undefined);
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('WorkspaceSwitcher', () => {
  it('lists workspaces and opens one on click', () => {
    const onClose = vi.fn();
    render(<WorkspaceSwitcher onClose={onClose} />);
    fireEvent.click(screen.getByText('bravo'));
    expect(state.openWorkspace).toHaveBeenCalledWith('ws-b', 'bravo');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('filters by query', () => {
    render(<WorkspaceSwitcher onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/switch or open/i), {
      target: { value: 'brav' },
    });
    expect(screen.queryByText('alpha')).toBeNull();
    expect(screen.getByText('bravo')).toBeDefined();
  });

  it('requests a new workspace via the global event', () => {
    const onClose = vi.fn();
    const spy = vi.fn();
    window.addEventListener('goodboy:add-workspace', spy);
    render(<WorkspaceSwitcher onClose={onClose} />);
    fireEvent.click(screen.getByText('New workspace'));
    expect(spy).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:add-workspace', spy);
  });

  it('does not duplicate workspace settings inside the selector', () => {
    render(<WorkspaceSwitcher onClose={vi.fn()} />);
    expect(screen.queryByText('Workspace settings')).toBeNull();
  });

  it('renders panel content only, leaving anchoring to the popover primitive', () => {
    const { container } = render(<WorkspaceSwitcher onClose={vi.fn()} />);
    expect(container.querySelector('.fixed')).toBeNull();
    expect(screen.getByPlaceholderText(/switch or open/i)).toBeDefined();
  });
});
