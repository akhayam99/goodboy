// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime, Workspace, WorkspaceId } from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import type { OpenWorkspaceResult } from '../../../../store/slices/presence/openWorkspace';

const { state } = vi.hoisted(() => ({
  state: {
    workspaces: [] as ReadonlyArray<Workspace>,
    disconnectedWorkspaces: [] as ReadonlyArray<Workspace>,
    projects: [] as ReadonlyArray<{
      id: string;
      workspaceId: string;
      kind: string;
      rootPath: string;
    }>,
    currentWorkspace: null as Workspace | null,
    windowPresence: {} as Record<string, WorkspaceId | null>,
    running: 0,
    openWorkspace: vi.fn<() => Promise<OpenWorkspaceResult>>(async () => ({ kind: 'opened' })),
    switchWorkspaceHere: vi.fn(async () => undefined),
    reconnectWorkspaceById: vi.fn(async () => undefined),
    loadDisconnectedWorkspaces: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useWorkspaces: () => state.workspaces,
  useDisconnectedWorkspaces: () => state.disconnectedWorkspaces,
  useCurrentWorkspace: () => state.currentWorkspace,
  useWorkspaceHasUnread: () => false,
  useRunningHere: () => state.running,
  useAppStore: (
    selector: (s: {
      openWorkspace: typeof state.openWorkspace;
      switchWorkspaceHere: typeof state.switchWorkspaceHere;
      reconnectWorkspaceById: typeof state.reconnectWorkspaceById;
      loadDisconnectedWorkspaces: typeof state.loadDisconnectedWorkspaces;
      projects: typeof state.projects;
      windowPresence: typeof state.windowPresence;
    }) => unknown,
  ) =>
    selector({
      openWorkspace: state.openWorkspace,
      switchWorkspaceHere: state.switchWorkspaceHere,
      reconnectWorkspaceById: state.reconnectWorkspaceById,
      loadDisconnectedWorkspaces: state.loadDisconnectedWorkspaces,
      projects: state.projects,
      windowPresence: state.windowPresence,
    }),
}));

import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { WorkspaceSwitcher } from './index';

type DigitParams = {
  readonly name: string;
};

beforeEach(() => {
  state.workspaces = [
    { id: 'ws-a', name: 'alpha', slug: 'alpha' } as Workspace,
    { id: 'ws-b', name: 'bravo', slug: 'bravo' } as Workspace,
  ];
  state.disconnectedWorkspaces = [];
  state.projects = [
    { id: 'proj-a', workspaceId: 'ws-a', kind: 'repo', rootPath: '/repos/alpha' },
    { id: 'proj-b', workspaceId: 'ws-b', kind: 'repo', rootPath: '/repos/bravo' },
  ];
  state.currentWorkspace = state.workspaces[0] ?? null;
  state.windowPresence = {};
  state.running = 0;
  state.openWorkspace = vi.fn(async () => ({ kind: 'opened' as const }));
  state.switchWorkspaceHere = vi.fn(async () => undefined);
  state.reconnectWorkspaceById = vi.fn(async () => undefined);
  state.loadDisconnectedWorkspaces = vi.fn(async () => undefined);
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('WorkspaceSwitcher', () => {
  it('lists other workspaces and opens one on click', async () => {
    const onClose = vi.fn();
    render(<WorkspaceSwitcher onClose={onClose} />);
    fireEvent.click(screen.getByText('bravo'));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(state.openWorkspace).toHaveBeenCalledWith({ id: 'ws-b', title: 'bravo' });
  });

  it.each([{ metaKey: true }, { ctrlKey: true }])(
    'opens the picked workspace in a new window on %o and Enter',
    async (modifier) => {
      const onClose = vi.fn();
      render(<WorkspaceSwitcher onClose={onClose} />);

      fireEvent.keyDown(screen.getByPlaceholderText('Find a workspace or project'), {
        key: 'Enter',
        ...modifier,
      });

      await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
      expect(state.openWorkspace).toHaveBeenCalledWith({
        id: 'ws-b',
        title: 'bravo',
        target: 'new-window',
      });
    },
  );

  it('numbers the rows with the keys that open them, most recent first', () => {
    state.workspaces = [
      aWorkspace({ name: 'alpha', lastAccessedAt: '2026-09-01T10:00:00Z' as IsoDateTime }),
      aWorkspace({ name: 'bravo', lastAccessedAt: '2026-09-02T10:00:00Z' as IsoDateTime }),
      aWorkspace({ name: 'charlie', lastAccessedAt: '2026-09-03T10:00:00Z' as IsoDateTime }),
      aWorkspace({ name: 'delta', lastAccessedAt: '2026-09-04T10:00:00Z' as IsoDateTime }),
    ];
    state.currentWorkspace = state.workspaces[0] ?? null;
    render(<WorkspaceSwitcher onClose={vi.fn()} />);

    const digits = ({ name }: DigitParams): string =>
      screen.getByText(name).closest('[data-workspace-row]')?.querySelector('kbd')?.textContent ??
      '';

    expect(digits({ name: 'delta' })).toBe(shortcutGlyphs('workspace.1'));
    expect(digits({ name: 'charlie' })).toBe(shortcutGlyphs('workspace.2'));
    expect(digits({ name: 'bravo' })).toBe(shortcutGlyphs('workspace.3'));
  });

  it('hides the numbers while a search narrows the list', () => {
    render(<WorkspaceSwitcher onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Find a workspace or project'), {
      target: { value: 'bra' },
    });

    expect(
      screen.getByText('bravo').closest('[data-workspace-row]')?.querySelector('kbd')?.textContent,
    ).not.toBe(shortcutGlyphs('workspace.1'));
  });

  it('opens the picked workspace here on a bare Enter', async () => {
    const onClose = vi.fn();
    render(<WorkspaceSwitcher onClose={onClose} />);

    fireEvent.keyDown(screen.getByPlaceholderText('Find a workspace or project'), {
      key: 'Enter',
    });

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(state.openWorkspace).toHaveBeenCalledWith({ id: 'ws-b', title: 'bravo' });
  });

  it('shows an inline confirm instead of switching when opening asks for one', async () => {
    state.openWorkspace = vi.fn(async () => ({ kind: 'needs-confirm' as const, running: 2 }));
    const onClose = vi.fn();
    render(<WorkspaceSwitcher onClose={onClose} />);
    fireEvent.click(screen.getByText('bravo'));

    expect(await screen.findByText('2 sessions are active in alpha.')).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();

    const openInNewWindowButtons = screen.getAllByRole('button', { name: 'Open in new window' });
    fireEvent.click(openInNewWindowButtons[openInNewWindowButtons.length - 1]!);
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(state.openWorkspace).toHaveBeenCalledWith({
      id: 'ws-b',
      title: 'bravo',
      target: 'new-window',
    });
  });

  it('stops the active sessions and switches here from the confirm', async () => {
    state.openWorkspace = vi.fn(async () => ({ kind: 'needs-confirm' as const, running: 1 }));
    const onClose = vi.fn();
    render(<WorkspaceSwitcher onClose={onClose} />);
    fireEvent.click(screen.getByText('bravo'));

    fireEvent.click(await screen.findByText('Stop them and open here'));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(state.switchWorkspaceHere).toHaveBeenCalledWith({ id: 'ws-b', title: 'bravo' });
  });

  it('filters other workspaces by query', () => {
    state.workspaces = [
      ...state.workspaces,
      { id: 'ws-c', name: 'charlie', slug: 'charlie' } as Workspace,
    ];
    render(<WorkspaceSwitcher onClose={vi.fn()} />);
    expect(screen.getByText('bravo')).not.toBeNull();
    expect(screen.getByText('charlie')).not.toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Find a workspace or project'), {
      target: { value: 'brav' },
    });

    expect(screen.getByText('bravo')).not.toBeNull();
    expect(screen.queryByText('charlie')).toBeNull();
  });

  it('shows no empty row when the current workspace is the only one', () => {
    state.workspaces = [aWorkspace({ name: 'alpha' })];
    state.currentWorkspace = state.workspaces[0] ?? null;
    render(<WorkspaceSwitcher onClose={vi.fn()} />);

    expect(screen.queryByText(/No workspaces/)).toBeNull();
    expect(screen.queryByText(/No other workspaces/)).toBeNull();
    expect(screen.getByText('alpha')).toBeDefined();
  });

  it('says No other workspaces match when a search finds none', () => {
    render(<WorkspaceSwitcher onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Find a workspace or project'), {
      target: { value: 'zzz' },
    });

    expect(screen.getByText('No other workspaces match')).toBeDefined();
  });

  it('requests a new workspace via the global event', () => {
    const onClose = vi.fn();
    const spy = vi.fn();
    window.addEventListener('goodboy:add-workspace', spy);
    render(<WorkspaceSwitcher onClose={onClose} />);
    fireEvent.click(screen.getByText('Open a folder'));
    expect(spy).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:add-workspace', spy);
  });

  it('opens workspace settings from the current row gear, closing the popover', () => {
    const onClose = vi.fn();
    const spy = vi.fn();
    window.addEventListener('goodboy:open-settings', spy);
    render(<WorkspaceSwitcher onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Workspace settings'));
    expect(spy).toHaveBeenCalledOnce();
    expect((spy.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      scope: 'workspace',
      section: undefined,
    });
    expect(onClose).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:open-settings', spy);
  });

  it('offers no current-workspace row or manage-projects action without a workspace', () => {
    state.currentWorkspace = null;
    render(<WorkspaceSwitcher onClose={vi.fn()} />);
    expect(screen.queryByLabelText('Workspace settings')).toBeNull();
    expect(screen.queryByText('Manage projects')).toBeNull();
  });

  it('lists disconnected workspaces in the same list, each with Reconnect one click away', () => {
    state.disconnectedWorkspaces = [
      { id: 'ws-c', name: 'cascadia', slug: 'cascadia' } as Workspace,
    ];
    render(<WorkspaceSwitcher onClose={vi.fn()} />);

    const rows = Array.from(document.querySelectorAll('[data-workspace-row]')).map((row) =>
      row.getAttribute('data-workspace-row'),
    );
    expect(rows).toEqual(['bravo', 'cascadia']);
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect cascadia' }));
    expect(state.reconnectWorkspaceById).toHaveBeenCalledWith('ws-c');
  });

  it('keeps the current workspace on top, apart from the list of the others', () => {
    render(<WorkspaceSwitcher onClose={vi.fn()} />);

    const current = screen.getByRole('region', { name: 'Current workspace: alpha' });
    expect(current.querySelector('[data-workspace-tile]')?.textContent).toBe('A');
    expect(current.compareDocumentPosition(screen.getByText('bravo'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.queryByRole('button', { name: 'Switch to alpha' })).toBeNull();
  });

  it('switches to another workspace with one click on its row', async () => {
    const onClose = vi.fn();
    render(<WorkspaceSwitcher onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Switch to bravo' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(state.openWorkspace).toHaveBeenCalledWith({ id: 'ws-b', title: 'bravo' });
  });

  it('opens another workspace in a new window from its row in one click', async () => {
    const onClose = vi.fn();
    render(<WorkspaceSwitcher onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open bravo in a new window' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(state.openWorkspace).toHaveBeenCalledWith({
      id: 'ws-b',
      title: 'bravo',
      target: 'new-window',
    });
  });

  it('opens the workspace projects from Manage projects in one click', () => {
    const onClose = vi.fn();
    const details: Array<unknown> = [];
    const listener = (event: Event) => {
      if (event instanceof CustomEvent) {
        details.push(event.detail);
      }
    };
    window.addEventListener('goodboy:open-settings', listener);
    render(<WorkspaceSwitcher onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Manage projects' }));

    expect(details).toEqual([{ scope: 'workspace', section: 'projects' }]);
    expect(onClose).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:open-settings', listener);
  });

  it('starts a new project via the global event in one click', () => {
    const onClose = vi.fn();
    const spy = vi.fn();
    window.addEventListener('goodboy:start-new-project', spy);
    render(<WorkspaceSwitcher onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start a new project' }));

    expect(spy).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:start-new-project', spy);
  });

  it('renders panel content only, leaving anchoring to the popover primitive', () => {
    const { container } = render(<WorkspaceSwitcher onClose={vi.fn()} />);
    expect(container.querySelector('.fixed')).toBeNull();
    expect(screen.getByPlaceholderText('Find a workspace or project')).toBeDefined();
  });
});
