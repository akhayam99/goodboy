// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, Workspace } from '@goodboy/types';

type DialogProps = {
  workspaceId: string;
  workspaceName: string;
  open: boolean;
  initialSection?: string;
};

const { state, dialog } = vi.hoisted(() => ({
  state: {
    currentWorkspace: null as Workspace | null,
    workspaces: [] as ReadonlyArray<{ id: string; name: string }>,
    sessions: [] as ReadonlyArray<Session>,
    unreadElsewhere: false,
  },
  dialog: { props: null as DialogProps | null },
}));

vi.mock('../../../../store', () => ({
  useAppStore: (selector: (s: { workspaces: typeof state.workspaces }) => unknown) =>
    selector({ workspaces: state.workspaces }),
  useCurrentWorkspace: () => state.currentWorkspace,
  useSessions: () => state.sessions,
  useHasUnreadElsewhere: () => state.unreadElsewhere,
}));

vi.mock('../WorkspaceSettingsDialog', () => ({
  WorkspaceSettingsDialog: (props: DialogProps) => {
    dialog.props = props;
    return props.open ? (
      <div
        data-testid="settings-dialog-mock"
        data-workspace-id={props.workspaceId}
        data-workspace-name={props.workspaceName}
        data-section={props.initialSection ?? ''}
      />
    ) : null;
  },
}));

import { WorkspaceHeader } from './index';

const SETTINGS_EVENT = 'goodboy:open-workspace-settings';

beforeEach(() => {
  state.currentWorkspace = { id: 'ws-a', name: 'alpha', rootPath: '/code/alpha-app' } as Workspace;
  state.workspaces = [
    { id: 'ws-a', name: 'alpha' },
    { id: 'ws-b', name: 'beta' },
  ];
  state.sessions = [];
  state.unreadElsewhere = false;
  dialog.props = null;
});
afterEach(cleanup);

const fireSettings = (detail: { workspaceId?: string; section?: string }) => {
  act(() => {
    window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail }));
  });
};

describe('WorkspaceHeader', () => {
  it('renders the current workspace name', () => {
    render(<WorkspaceHeader />);
    expect(screen.getByText('alpha')).toBeDefined();
  });

  it('opens the switcher via the global event', () => {
    const spy = vi.fn();
    window.addEventListener('goodboy:open-workspace-switcher', spy);
    render(<WorkspaceHeader />);
    fireEvent.click(screen.getByLabelText(/switch or open a workspace/i));
    expect(spy).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:open-workspace-switcher', spy);
  });

  it('renders nothing without a current workspace', () => {
    state.currentWorkspace = null;
    const { container } = render(<WorkspaceHeader />);
    expect(container.firstChild).toBeNull();
  });

  it('keeps the settings dialog closed until triggered', () => {
    render(<WorkspaceHeader />);
    expect(screen.queryByTestId('settings-dialog-mock')).toBeNull();
  });

  it('opens settings for the current workspace via the gear button', () => {
    render(<WorkspaceHeader />);
    fireEvent.click(screen.getByLabelText(/open workspace settings for alpha/i));
    const node = screen.getByTestId('settings-dialog-mock');
    expect(node.getAttribute('data-workspace-id')).toBe('ws-a');
    expect(node.getAttribute('data-workspace-name')).toBe('alpha');
    expect(node.getAttribute('data-section')).toBe('');
  });

  it('routes settings to the workspace named in the event detail, not the current one', () => {
    render(<WorkspaceHeader />);
    fireSettings({ workspaceId: 'ws-b' });
    const node = screen.getByTestId('settings-dialog-mock');
    expect(node.getAttribute('data-workspace-id')).toBe('ws-b');
    expect(node.getAttribute('data-workspace-name')).toBe('beta');
  });

  it('falls back to the current workspace when the event omits a workspaceId', () => {
    render(<WorkspaceHeader />);
    fireSettings({ section: 'members' });
    const node = screen.getByTestId('settings-dialog-mock');
    expect(node.getAttribute('data-workspace-id')).toBe('ws-a');
    expect(node.getAttribute('data-section')).toBe('members');
  });

  it('falls back to the current workspace when the target id is unknown', () => {
    render(<WorkspaceHeader />);
    fireSettings({ workspaceId: 'ws-ghost' });
    const node = screen.getByTestId('settings-dialog-mock');
    expect(node.getAttribute('data-workspace-id')).toBe('ws-a');
    expect(node.getAttribute('data-workspace-name')).toBe('alpha');
  });

  it('forwards the requested section through to the dialog', () => {
    render(<WorkspaceHeader />);
    fireSettings({ workspaceId: 'ws-b', section: 'danger' });
    expect(screen.getByTestId('settings-dialog-mock').getAttribute('data-section')).toBe('danger');
  });
});
