// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ProviderDisplayInfo } from '../../../../features/providers/providers';

const { state } = vi.hoisted(() => ({
  state: {
    providerConnect: { anthropic: { phase: 'idle' }, codex: { phase: 'idle' } } as Record<
      string,
      { phase: string }
    >,
    connectProvider: vi.fn(async () => undefined),
    logoutProvider: vi.fn(async () => undefined),
    refreshProviders: vi.fn(async () => undefined),
    providers: [] as ReadonlyArray<unknown>,
    cliRequirements: [] as ReadonlyArray<unknown>,
    providerLifecycle: {
      anthropic: { phase: 'idle', action: null, runId: null, errorTail: null },
      codex: { phase: 'idle', action: null, runId: null, errorTail: null },
    },
    agentTurnState: {},
    runRouting: {},
    updateProviderCli: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('./ProviderCredentialsSection', () => ({ ProviderCredentialsSection: () => null }));
vi.mock('./ProviderBindingsSection', () => ({ ProviderBindingsSection: () => null }));
vi.mock('./UsageSection', () => ({
  UsageSection: ({ providerId }: { readonly providerId: string }) => (
    <section aria-label={`Usage for ${providerId}`} />
  ),
}));

import { ProviderDetailPanel } from './ProviderDetailPanel';

afterEach(() => {
  cleanup();
  state.logoutProvider.mockClear();
  state.connectProvider.mockClear();
});

const info = {
  id: 'anthropic',
  label: 'Claude',
  binary: 'claude',
  version: '2.1.0',
  connection: 'connected',
  identity: 'dev@acme.test',
  error: null,
  docsUrl: 'https://docs.claude.com',
} as unknown as ProviderDisplayInfo;

describe('ProviderDetailPanel', () => {
  it('signs the provider out only after the row confirm', () => {
    render(<ProviderDetailPanel info={info} autoConnect={false} autoUpdate={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(state.logoutProvider).not.toHaveBeenCalled();

    const confirm = screen.getByRole('group', { name: 'Disconnect Claude?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Disconnect' }));
    expect(state.logoutProvider).toHaveBeenCalledWith('anthropic');
  });

  it('opens a connected provider on its usage, above the account', () => {
    render(<ProviderDetailPanel info={info} autoConnect={false} autoUpdate={false} />);

    const usage = screen.getByRole('region', { name: 'Usage for anthropic' });
    const account = screen.getByText('Account');
    expect(usage.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('leaves usage out while the provider is not connected', () => {
    render(
      <ProviderDetailPanel
        info={{ ...info, connection: 'missing' } as ProviderDisplayInfo}
        autoConnect={false}
        autoUpdate={false}
      />,
    );

    expect(screen.queryByRole('region', { name: 'Usage for anthropic' })).toBeNull();
  });

  it('cancels back to the account actions', () => {
    render(<ProviderDetailPanel info={info} autoConnect={false} autoUpdate={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(state.logoutProvider).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeDefined();
  });

  it('signs claude in again straight away', () => {
    render(<ProviderDetailPanel info={info} autoConnect={false} autoUpdate={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }));

    expect(state.connectProvider).toHaveBeenCalledWith('anthropic');
  });

  it('asks before signing codex in again, since codex signs out first', () => {
    const codex = { ...info, id: 'codex', label: 'Codex', binary: 'codex' } as ProviderDisplayInfo;
    render(<ProviderDetailPanel info={codex} autoConnect={false} autoUpdate={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }));
    expect(state.connectProvider).not.toHaveBeenCalled();
    const confirm = screen.getByRole('group', { name: 'Sign in to Codex again?' });
    expect(screen.getByText('Signing in again signs you out of Codex first.')).toBeDefined();

    fireEvent.click(within(confirm).getByRole('button', { name: 'Sign in again' }));
    expect(state.connectProvider).toHaveBeenCalledWith('codex');
  });
});
