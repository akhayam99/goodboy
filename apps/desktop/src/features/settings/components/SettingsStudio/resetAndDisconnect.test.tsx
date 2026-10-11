// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    currentWorkspaceId: 'harborline',
    workspaces: [{ id: 'harborline', name: 'Harborline' }],
    wipeLocalDatabase: vi.fn(async () => undefined),
    relaunchApp: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
    disconnectWorkspace: vi.fn(async (_id: unknown) => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../store/slices/live-work/selectLiveWork', () => ({
  selectLiveWork: () => ({ liveSessionIds: ['session-1', 'session-2'] }),
}));

import { AppResetSection } from './AppResetSection';
import { WorkspaceDisconnectBand } from './WorkspaceDisconnectBand';

const WORKSPACE = 'harborline' as WorkspaceId;

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('AppResetSection', () => {
  it('asks in a popover outside the section and leaves the section as it was', () => {
    const { container } = render(<AppResetSection />);
    const section = container.querySelector('section');
    const childCount = section?.children.length;

    fireEvent.click(screen.getByRole('button', { name: 'Delete all data' }));

    const dialog = screen.getByRole('dialog', {
      name: 'Delete every workspace, session and rule?',
    });
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.closest('[data-dropdown-portal]')).not.toBeNull();
    expect(section?.children.length).toBe(childCount);
    expect(state.wipeLocalDatabase).not.toHaveBeenCalled();
  });

  it('puts focus on Cancel and gives it back to the trigger on Escape', async () => {
    render(<AppResetSection />);
    const trigger = screen.getByRole('button', { name: 'Delete all data' });

    fireEvent.click(trigger);
    const cancel = within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    fireEvent.keyDown(cancel, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(state.wipeLocalDatabase).not.toHaveBeenCalled();
  });

  it('wipes the local data on confirm and offers the restart', async () => {
    render(<AppResetSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete all data' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(state.wipeLocalDatabase).toHaveBeenCalledOnce());
    expect(await screen.findByText('Local data deleted.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Restart now' })).toBeDefined();
  });
});

describe('WorkspaceDisconnectBand', () => {
  it('names the workspace and the active sessions in the popover title', () => {
    render(<WorkspaceDisconnectBand workspaceId={WORKSPACE} requestClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    expect(
      screen.getByRole('dialog', { name: 'Disconnect Harborline and stop 2 active sessions?' }),
    ).toBeDefined();
    expect(state.disconnectWorkspace).not.toHaveBeenCalled();
  });

  it('disconnects on confirm and closes the settings page', async () => {
    const requestClose = vi.fn();
    render(<WorkspaceDisconnectBand workspaceId={WORKSPACE} requestClose={requestClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(state.disconnectWorkspace).toHaveBeenCalledWith(WORKSPACE));
    await waitFor(() => expect(requestClose).toHaveBeenCalledOnce());
  });
});
