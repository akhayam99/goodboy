// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IntegrationCredential, IntegrationCredentialId, IsoDateTime } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    integrationCredentials: [] as ReadonlyArray<unknown>,
    integrationCredentialUsage: {} as Record<string, number>,
    forgetIntegrationCredential: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { IntegrationCredentialPicker } from './index';

const credential = ({
  id,
  label,
  provider = 'linear',
}: {
  readonly id: string;
  readonly label: string;
  readonly provider?: IntegrationCredential['provider'];
}): IntegrationCredential => ({
  id: id as IntegrationCredentialId,
  provider,
  label,
  account: `${label}@example.com`,
  createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
});

beforeEach(() => {
  state.integrationCredentials = [];
  state.integrationCredentialUsage = {};
  state.forgetIntegrationCredential = vi.fn(async () => undefined);
});
afterEach(cleanup);

describe('IntegrationCredentialPicker', () => {
  it('stays out of the way when the provider has no saved key', () => {
    const { container } = render(
      <IntegrationCredentialPicker
        provider="linear"
        selectedCredentialId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('lists every saved key for the provider and none belonging to another', () => {
    state.integrationCredentials = [
      credential({ id: 'c1', label: 'work' }),
      credential({ id: 'c2', label: 'personal' }),
      credential({ id: 'c3', label: 'sentry key', provider: 'sentry' }),
    ];

    render(
      <IntegrationCredentialPicker
        provider="linear"
        selectedCredentialId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('work')).toBeDefined();
    expect(screen.getByText('personal')).toBeDefined();
    expect(screen.queryByText('sentry key')).toBeNull();
  });

  it('hands back the picked credential, and null when a new key is wanted', () => {
    state.integrationCredentials = [credential({ id: 'c1', label: 'work' })];
    const onSelect = vi.fn();

    render(
      <IntegrationCredentialPicker
        provider="linear"
        selectedCredentialId={null}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText('work'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));

    fireEvent.click(screen.getByRole('button', { name: /use a new personal API key/i }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('keeps the remove control reachable while the key is in use and shows the refusal', async () => {
    state.integrationCredentials = [credential({ id: 'c1', label: 'work' })];
    state.integrationCredentialUsage = { c1: 2 };
    state.forgetIntegrationCredential = vi.fn(async () => {
      throw new Error('2 workspaces still use this key. Disconnect them first.');
    });

    render(
      <IntegrationCredentialPicker
        provider="linear"
        selectedCredentialId={null}
        onSelect={vi.fn()}
      />,
    );

    const remove = screen.getByRole('button', { name: /forget work/i }) as HTMLButtonElement;
    expect(remove.disabled).toBe(false);
    expect(screen.getByText('Used by 2 projects')).toBeDefined();

    fireEvent.click(remove);

    expect(await screen.findByText(/2 workspaces still use this key/i)).toBeDefined();
  });

  it('removes a key no project uses and drops it from the selection', async () => {
    state.integrationCredentials = [credential({ id: 'c1', label: 'work' })];
    const onSelect = vi.fn();

    render(
      <IntegrationCredentialPicker
        provider="linear"
        selectedCredentialId={'c1' as IntegrationCredentialId}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /forget work/i }));

    await waitFor(() =>
      expect(state.forgetIntegrationCredential).toHaveBeenCalledWith({ credentialId: 'c1' }),
    );
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
