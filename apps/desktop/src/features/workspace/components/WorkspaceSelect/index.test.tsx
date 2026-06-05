// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Workspace } from '@goodboy/types';

interface MockState {
  workspaces: ReadonlyArray<Workspace>;
  currentWorkspace: Workspace | null;
  requestWorkspaceSwitch: ReturnType<typeof vi.fn>;
  workspaceHasUnread: boolean;
}

const { state } = vi.hoisted<{ state: MockState }>(() => ({
  state: {
    workspaces: [],
    currentWorkspace: null,
    requestWorkspaceSwitch: vi.fn(async () => undefined),
    workspaceHasUnread: false,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (s: { requestWorkspaceSwitch: typeof state.requestWorkspaceSwitch }) => T,
  ) => selector({ requestWorkspaceSwitch: state.requestWorkspaceSwitch }),
  useCurrentWorkspace: () => state.currentWorkspace,
  useWorkspaceHasUnread: () => state.workspaceHasUnread,
  useWorkspaces: () => state.workspaces,
}));

vi.mock('../WorkspaceSettingsDialog', () => ({
  WorkspaceSettingsDialog: () => <div data-testid="workspace-settings-mock" />,
}));

import { WorkspaceSelect } from './index';

beforeEach(() => {
  state.workspaces = [
    { id: 'ws-a', name: 'alpha' } as Workspace,
    { id: 'ws-b', name: 'bravo' } as Workspace,
  ];
  state.currentWorkspace = state.workspaces[0] ?? null;
  state.requestWorkspaceSwitch = vi.fn(async () => undefined);
  state.workspaceHasUnread = false;
});
afterEach(cleanup);

describe('WorkspaceSelect', () => {
  it('lists each linked workspace and requests a switch on click', () => {
    render(<WorkspaceSelect onAddWorkspace={vi.fn()} />);
    fireEvent.click(screen.getByText('bravo'));
    expect(state.requestWorkspaceSwitch).toHaveBeenCalledWith('ws-b');
  });

  it('shows the count + cap label in the header', () => {
    render(<WorkspaceSelect onAddWorkspace={vi.fn()} />);
    expect(screen.getByText(/^2\/\d+$/)).toBeDefined();
  });

  it('fires onAddWorkspace when the add button is clicked', () => {
    const onAddWorkspace = vi.fn();
    render(<WorkspaceSelect onAddWorkspace={onAddWorkspace} />);
    fireEvent.click(screen.getByLabelText(/^add workspace$/i));
    expect(onAddWorkspace).toHaveBeenCalledOnce();
  });
});
