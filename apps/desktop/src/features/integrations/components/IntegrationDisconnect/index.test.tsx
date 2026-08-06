// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../app/components/Toast';
import { IntegrationDisconnect } from '.';

const renderWithToast = (children: ReactNode) => render(<ToastProvider>{children}</ToastProvider>);

afterEach(cleanup);

describe('IntegrationDisconnect', () => {
  it('asks for confirmation before disconnecting', async () => {
    const onDisconnect = vi.fn(async () => undefined);
    renderWithToast(
      <IntegrationDisconnect
        label="Linear"
        description="Removes Linear from this workspace."
        onDisconnect={onDisconnect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Linear' }));
    expect(screen.getByText('Disconnect Linear?')).toBeDefined();
    expect(onDisconnect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Linear' }));
    await waitFor(() => expect(onDisconnect).toHaveBeenCalledOnce());
  });

  it('cancels back to the icon without disconnecting', () => {
    const onDisconnect = vi.fn(async () => undefined);
    renderWithToast(
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

  it('shows an error toast and stays armed when the disconnect call fails', async () => {
    const onDisconnect = vi.fn(async () => {
      throw new Error('keychain is locked');
    });
    renderWithToast(
      <IntegrationDisconnect
        label="GitHub"
        description="Removes the GitHub token."
        onDisconnect={onDisconnect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect GitHub' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect GitHub' }));

    expect(await screen.findByText('Keychain is locked')).toBeDefined();
    expect(screen.getByText('Disconnect GitHub?')).toBeDefined();
  });
});
