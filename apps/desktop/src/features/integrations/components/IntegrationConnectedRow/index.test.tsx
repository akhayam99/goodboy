// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IntegrationCredentialId } from '@goodboy/types';
import { IntegrationConnectedRow } from '.';

const secret = vi.hoisted(() => ({ has: true }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => secret.has),
}));

afterEach(() => {
  cleanup();
  secret.has = true;
});

const renderRow = ({
  onDisconnect = vi.fn(async () => undefined),
  badge,
  credentialId,
}: {
  readonly onDisconnect?: () => Promise<void>;
  readonly badge?: string;
  readonly credentialId?: IntegrationCredentialId;
} = {}) =>
  render(
    <IntegrationConnectedRow
      provider="linear"
      primary="Connected as Ada Lovelace"
      secondary="linear.app/acme"
      {...(badge != null ? { badge } : {})}
      {...(credentialId != null ? { credentialId } : {})}
      disconnectDescription="Unlinks this project."
      onDisconnect={onDisconnect}
    />,
  );

describe('IntegrationConnectedRow', () => {
  it('shows the account and host on one row with a quiet disconnect', () => {
    renderRow();
    expect(screen.getByText('Connected as Ada Lovelace')).toBeDefined();
    expect(screen.getByText('linear.app/acme')).toBeDefined();
    expect(screen.getByRole('button', { name: /disconnect linear/i })).toBeDefined();
  });

  it('shows the scope badge only when one is handed in', () => {
    renderRow({ badge: 'workspace key' });
    expect(screen.getByText('workspace key')).toBeDefined();
    cleanup();
    renderRow();
    expect(screen.queryByText('workspace key')).toBeNull();
  });

  it('arms the confirm instead of disconnecting immediately', () => {
    const onDisconnect = vi.fn(async () => undefined);
    renderRow({ onDisconnect });
    fireEvent.click(screen.getByRole('button', { name: /disconnect linear/i }));
    expect(screen.getByText(/disconnect linear\?/i)).toBeDefined();
    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it('disconnects once the confirm is confirmed', async () => {
    const onDisconnect = vi.fn(async () => undefined);
    renderRow({ onDisconnect });
    fireEvent.click(screen.getByRole('button', { name: /disconnect linear/i }));
    fireEvent.click(screen.getByRole('button', { name: /^disconnect linear$/i }));
    await waitFor(() => expect(onDisconnect).toHaveBeenCalledOnce());
  });

  it('shows the failure when the disconnect is rejected', async () => {
    renderRow({
      onDisconnect: vi.fn(async () => {
        throw new Error('keychain said no');
      }),
    });
    fireEvent.click(screen.getByRole('button', { name: /disconnect linear/i }));
    fireEvent.click(screen.getByRole('button', { name: /^disconnect linear$/i }));
    expect(await screen.findByText(/keychain said no/i)).toBeDefined();
  });
});

describe('a connection whose key left the keychain', () => {
  it('says the key is gone instead of claiming a healthy connection', async () => {
    secret.has = false;
    renderRow({ credentialId: 'cred-1' as IntegrationCredentialId });

    await waitFor(() => expect(screen.getByText(/missing from this Mac/i)).toBeDefined());
    expect(screen.getByText('Connected as Ada Lovelace')).toBeDefined();
  });

  it('stays quiet while the key is where it should be', async () => {
    renderRow({ credentialId: 'cred-1' as IntegrationCredentialId });

    await waitFor(() => expect(screen.getByText('Connected as Ada Lovelace')).toBeDefined());
    expect(screen.queryByText(/missing from this Mac/i)).toBeNull();
  });
});
