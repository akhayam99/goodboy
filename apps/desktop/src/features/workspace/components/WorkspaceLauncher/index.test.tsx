// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Workspace, WorkspaceId } from '@goodboy/types';
import { SETTING_REOPEN_LAST } from '../../../settings/settings';

const { state } = vi.hoisted(() => ({
  state: {
    workspaces: [] as ReadonlyArray<Workspace>,
    currentWorkspace: null as Workspace | null,
    shown: new Set<WorkspaceId>(),
    openWorkspace: vi.fn(async () => undefined),
    saveSetting: vi.fn(async () => undefined),
    deleteWorkspace: vi.fn(async () => undefined),
    installUpdate: vi.fn(async () => undefined),
    settings: {} as Record<string, string>,
    updaterStatus: 'idle' as string,
    updateVersion: null as string | null,
  },
}));

vi.mock('../../../../store', () => ({
  useWorkspaces: () => state.workspaces,
  useWorkspaceHasUnread: () => false,
  useAppStore: (
    selector: (s: {
      openWorkspace: typeof state.openWorkspace;
      saveSetting: typeof state.saveSetting;
      deleteWorkspace: typeof state.deleteWorkspace;
      installUpdate: typeof state.installUpdate;
      settings: Record<string, string>;
      updaterStatus: string;
      updateVersion: string | null;
    }) => unknown,
  ) =>
    selector({
      openWorkspace: state.openWorkspace,
      saveSetting: state.saveSetting,
      deleteWorkspace: state.deleteWorkspace,
      installUpdate: state.installUpdate,
      settings: state.settings,
      updaterStatus: state.updaterStatus,
      updateVersion: state.updateVersion,
    }),
}));

import { WorkspaceLauncher } from './index';

beforeEach(() => {
  state.workspaces = [
    { id: 'ws-a', name: 'alpha', rootPath: '/repos/alpha' } as Workspace,
    { id: 'ws-b', name: 'bravo', rootPath: '/repos/bravo' } as Workspace,
  ];
  state.currentWorkspace = null;
  state.shown = new Set();
  state.openWorkspace = vi.fn(async () => undefined);
  state.saveSetting = vi.fn(async () => undefined);
  state.deleteWorkspace = vi.fn(async () => undefined);
  state.installUpdate = vi.fn(async () => undefined);
  state.settings = {};
  state.updaterStatus = 'idle';
  state.updateVersion = null;
});
afterEach(cleanup);

describe('WorkspaceLauncher', () => {
  it('opens a recent workspace on click', () => {
    render(<WorkspaceLauncher />);
    fireEvent.click(screen.getByText('alpha'));
    expect(state.openWorkspace).toHaveBeenCalledWith('ws-a', 'alpha');
  });

  it('persists the reopen-last preference', () => {
    render(<WorkspaceLauncher />);
    fireEvent.click(screen.getByLabelText(/reopen last workspace/i));
    expect(state.saveSetting).toHaveBeenCalledWith(SETTING_REOPEN_LAST, '1');
  });

  it('disconnects a workspace after an explicit confirmation', async () => {
    render(<WorkspaceLauncher />);
    fireEvent.click(screen.getByLabelText('Disconnect alpha'));
    expect(state.deleteWorkspace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(state.deleteWorkspace).toHaveBeenCalledWith('ws-a');
    expect(state.openWorkspace).not.toHaveBeenCalled();
  });

  it('keeps the workspace when the confirmation is cancelled', () => {
    render(<WorkspaceLauncher />);
    fireEvent.click(screen.getByLabelText('Disconnect bravo'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(state.deleteWorkspace).not.toHaveBeenCalled();
  });

  it('shows the update action when an update is available', () => {
    state.updaterStatus = 'available';
    state.updateVersion = '0.1.99';
    render(<WorkspaceLauncher />);
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update and restart' }));
    expect(state.installUpdate).toHaveBeenCalled();
  });

  it('hides the update action when the app is current', () => {
    render(<WorkspaceLauncher />);
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
  });
});
