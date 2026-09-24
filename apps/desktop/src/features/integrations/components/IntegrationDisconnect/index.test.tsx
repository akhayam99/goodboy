// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const { reportErrorMock } = vi.hoisted(() => ({
  reportErrorMock: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: { reportError: typeof reportErrorMock }) => T) =>
    selector({ reportError: reportErrorMock }),
}));

import { IntegrationDisconnect } from '.';

afterEach(() => {
  cleanup();
  reportErrorMock.mockClear();
});

describe('IntegrationDisconnect', () => {
  it('asks for confirmation before disconnecting', async () => {
    const onDisconnect = vi.fn(async () => undefined);
    render(
      <IntegrationDisconnect
        label="Linear"
        description="Removes Linear from this workspace."
        onDisconnect={onDisconnect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Linear' }));
    expect(screen.getByText('Disconnect Linear?')).toBeDefined();
    expect(onDisconnect).not.toHaveBeenCalled();

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(onDisconnect).toHaveBeenCalledOnce());
  });

  it('cancels back to the trigger without disconnecting', () => {
    const onDisconnect = vi.fn(async () => undefined);
    render(
      <IntegrationDisconnect
        label="Slack"
        description="Removes Slack from this workspace."
        onDisconnect={onDisconnect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Slack' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Disconnect Slack?')).toBeNull();
    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it('reports the failure to the log and stays armed when the disconnect call fails', async () => {
    const onDisconnect = vi.fn(async () => {
      throw new Error('keychain is locked');
    });
    render(
      <IntegrationDisconnect
        label="GitHub"
        description="Removes the GitHub token."
        onDisconnect={onDisconnect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect GitHub' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disconnect' }));

    await waitFor(() =>
      expect(reportErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't disconnect GitHub" }),
      ),
    );
    expect(screen.getByText('Disconnect GitHub?')).toBeDefined();
  });
});
