// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { aWorkspace } from '@goodboy/types/testing';
import { useAppStore } from '../../../../store';
import { AppResetSection } from './AppResetSection';
import { WorkspaceDisconnectBand } from './WorkspaceDisconnectBand';

const workspace = aWorkspace({ name: 'Harborline' });

const actions = {
  wipeLocalDatabase: vi.fn(async () => undefined),
  relaunchApp: vi.fn(async () => undefined),
  reportError: vi.fn(async () => undefined),
  disconnectWorkspace: vi.fn(async (_id: string) => undefined),
};

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: workspace.id,
    ...actions,
  });
});
afterEach(cleanup);

describe('AppResetSection', () => {
  it('closes the page in a Danger zone band', () => {
    render(<AppResetSection />);

    const band = screen.getByRole('region', { name: 'Danger zone' });
    within(band).getByRole('heading', { name: 'Danger zone' });
    within(band).getByRole('button', { name: 'Delete all data' });
  });

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
    expect(actions.wipeLocalDatabase).not.toHaveBeenCalled();
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
    expect(actions.wipeLocalDatabase).not.toHaveBeenCalled();
  });

  it('wipes the local data on confirm and offers the restart', async () => {
    render(<AppResetSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete all data' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(actions.wipeLocalDatabase).toHaveBeenCalledOnce());
    expect(await screen.findByText('Local data deleted.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Restart now' })).toBeDefined();
  });

  it('holds Restart now while it restarts and reports a refused restart', async () => {
    let fail: (error: Error) => void = () => undefined;
    actions.relaunchApp.mockImplementationOnce(
      () =>
        new Promise<undefined>((_resolve, reject) => {
          fail = reject;
        }),
    );
    render(<AppResetSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete all data' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    const restart = await screen.findByRole('button', { name: 'Restart now' });

    fireEvent.click(restart);
    expect(restart.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(restart);
    expect(actions.relaunchApp).toHaveBeenCalledOnce();

    fail(new Error('The updater is busy'));
    await waitFor(() => expect(restart.getAttribute('aria-busy')).toBeNull());
    expect(actions.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't restart Goodboy" }),
    );
  });
});

describe('WorkspaceDisconnectBand', () => {
  it('names the workspace in the popover title and waits for the confirm', () => {
    render(<WorkspaceDisconnectBand workspaceId={workspace.id} requestClose={vi.fn()} />);

    fireEvent.click(
      within(screen.getByRole('region', { name: 'Danger zone' })).getByRole('button', {
        name: 'Disconnect',
      }),
    );

    expect(screen.getByRole('dialog', { name: 'Disconnect Harborline?' })).toBeDefined();
    expect(actions.disconnectWorkspace).not.toHaveBeenCalled();
  });

  it('keeps the workspace when the confirm is cancelled', async () => {
    const requestClose = vi.fn();
    render(<WorkspaceDisconnectBand workspaceId={workspace.id} requestClose={requestClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(actions.disconnectWorkspace).not.toHaveBeenCalled();
    expect(requestClose).not.toHaveBeenCalled();
  });

  it('disconnects on confirm and closes the settings page', async () => {
    const requestClose = vi.fn();
    render(<WorkspaceDisconnectBand workspaceId={workspace.id} requestClose={requestClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(actions.disconnectWorkspace).toHaveBeenCalledWith(workspace.id));
    await waitFor(() => expect(requestClose).toHaveBeenCalledOnce());
  });
});
