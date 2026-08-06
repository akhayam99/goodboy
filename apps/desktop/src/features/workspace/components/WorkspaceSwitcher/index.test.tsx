// @vitest-environment happy-dom

import { createRef, type RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Workspace, WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    workspaces: [] as ReadonlyArray<Workspace>,
    currentWorkspace: null as Workspace | null,
    shown: new Set<WorkspaceId>(),
    openWorkspace: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useWorkspaces: () => state.workspaces,
  useWorkspaceHasUnread: () => false,
  useAppStore: (selector: (s: { openWorkspace: typeof state.openWorkspace }) => unknown) =>
    selector({ openWorkspace: state.openWorkspace }),
}));

import { WorkspaceSwitcher } from './index';

const anchored = (): RefObject<HTMLElement | null> => {
  const ref = createRef<HTMLElement>();
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  ref.current = anchor;
  return ref;
};

beforeEach(() => {
  state.workspaces = [
    { id: 'ws-a', name: 'alpha', rootPath: '/repos/alpha' } as Workspace,
    { id: 'ws-b', name: 'bravo', rootPath: '/repos/bravo' } as Workspace,
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
    render(<WorkspaceSwitcher anchorRef={anchored()} onClose={onClose} />);
    fireEvent.click(screen.getByText('bravo'));
    expect(state.openWorkspace).toHaveBeenCalledWith('ws-b', 'bravo');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('filters by query', () => {
    render(<WorkspaceSwitcher anchorRef={anchored()} onClose={vi.fn()} />);
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
    render(<WorkspaceSwitcher anchorRef={anchored()} onClose={onClose} />);
    fireEvent.click(screen.getByText('New workspace'));
    expect(spy).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:add-workspace', spy);
  });

  it('does not duplicate workspace settings inside the selector', () => {
    render(<WorkspaceSwitcher anchorRef={anchored()} onClose={vi.fn()} />);
    expect(screen.queryByText('Workspace settings')).toBeNull();
  });

  it('anchors to the trigger instead of covering the app', () => {
    render(<WorkspaceSwitcher anchorRef={anchored()} onClose={vi.fn()} />);
    const panel = screen.getByRole('dialog', { name: 'Switch or open a workspace' });
    expect(panel.className).toContain('fixed');
    expect(panel.className).toContain('z-popover');
    expect(panel.style.width).toBe('340px');
  });
});
