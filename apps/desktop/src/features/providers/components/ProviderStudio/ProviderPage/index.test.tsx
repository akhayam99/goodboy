// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ProviderDisplayInfo } from '../../../providers';

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
    providerCredentials: [] as ReadonlyArray<{ providerId: string }>,
    authResults: { anthropic: { state: 'connected', identity: 'dev@acme.test', plan: 'team' } },
    providerLimits: {},
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

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
}));

vi.mock('../../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../ProviderCredentialsSection', () => ({
  ProviderCredentialsSection: ({ providerId }: { readonly providerId: string }) => (
    <section aria-label={`API keys for ${providerId}`} />
  ),
}));
vi.mock('../ProviderBindingsSection', () => ({ ProviderBindingsSection: () => null }));
vi.mock('./UsageGroup', () => ({
  UsageGroup: ({ providerId }: { readonly providerId: string }) => (
    <section aria-label={`Usage for ${providerId}`} />
  ),
}));
vi.mock('./ModelsGroup', () => ({
  ModelsGroup: () => <section aria-label="Models in the picker" />,
}));

import { ProviderPage } from './index';

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

const regionNames = (): ReadonlyArray<string> =>
  screen.getAllByRole('region').map((region) => region.getAttribute('aria-label') ?? '');

describe('ProviderPage', () => {
  it('lays out usage, models, permissions and account in that order', () => {
    render(<ProviderPage info={info} autoConnect={false} autoUpdate={false} />);

    expect(regionNames()).toEqual([
      'Usage for anthropic',
      'Models in the picker',
      'Permissions with Claude',
      'Account',
    ]);
  });

  it('carries the plan, the account and the cli in the header meta', () => {
    render(<ProviderPage info={info} autoConnect={false} autoUpdate={false} />);

    expect(
      screen.getByText('Team plan · Signed in as dev@acme.test · Claude CLI 2.1.0'),
    ).toBeDefined();
    expect(screen.getByText('dev@acme.test · Team plan')).toBeDefined();
  });

  it('says what each mode does on this cli', () => {
    const codex = { ...info, id: 'codex', label: 'Codex', binary: 'codex' } as ProviderDisplayInfo;
    render(<ProviderPage info={codex} autoConnect={false} autoUpdate={false} />);

    const permissions = within(screen.getByRole('region', { name: 'Permissions with Codex' }));
    const rows = permissions.getAllByRole('listitem').map((row) => row.textContent);
    expect(rows).toContain('Ask firstNot availableRuns as Read only');
    expect(rows).toContain('RulesNot followedOnly Claude follows Allow and Deny rules.');
  });

  it('signs the provider out only after the row confirm', () => {
    render(<ProviderPage info={info} autoConnect={false} autoUpdate={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(state.logoutProvider).not.toHaveBeenCalled();

    const confirm = screen.getByRole('group', { name: 'Disconnect Claude?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Disconnect' }));
    expect(state.logoutProvider).toHaveBeenCalledWith('anthropic');
  });

  it('opens the sign out confirm from the header menu', () => {
    render(<ProviderPage info={info} autoConnect={false} autoUpdate={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'More Claude actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(screen.getByRole('group', { name: 'Disconnect Claude?' })).toBeDefined();
  });

  it('shows only the connect card while the provider is not connected', () => {
    render(
      <ProviderPage
        info={{ ...info, connection: 'missing' } as ProviderDisplayInfo}
        autoConnect={false}
        autoUpdate={false}
      />,
    );

    expect(screen.queryByRole('region', { name: 'Usage for anthropic' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Account' })).toBeNull();
  });

  it('cancels back to the account actions', () => {
    render(<ProviderPage info={info} autoConnect={false} autoUpdate={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(state.logoutProvider).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeDefined();
  });

  it('signs claude in again straight away', () => {
    render(<ProviderPage info={info} autoConnect={false} autoUpdate={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }));

    expect(state.connectProvider).toHaveBeenCalledWith('anthropic');
  });

  it('asks before signing codex in again, since codex signs out first', () => {
    const codex = { ...info, id: 'codex', label: 'Codex', binary: 'codex' } as ProviderDisplayInfo;
    render(<ProviderPage info={codex} autoConnect={false} autoUpdate={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }));
    expect(state.connectProvider).not.toHaveBeenCalled();
    const confirm = screen.getByRole('group', { name: 'Sign in to Codex again?' });
    expect(screen.getByText('Signing in again signs you out of Codex first.')).toBeDefined();

    fireEvent.click(within(confirm).getByRole('button', { name: 'Sign in again' }));
    expect(state.connectProvider).toHaveBeenCalledTimes(1);
    expect(state.connectProvider).toHaveBeenCalledWith('codex');
  });

  it('opens the api keys only when asked', () => {
    render(<ProviderPage info={info} autoConnect={false} autoUpdate={false} />);
    expect(screen.queryByRole('region', { name: 'API keys for anthropic' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Use an API key instead of your plan/ }));

    expect(screen.getByRole('region', { name: 'API keys for anthropic' })).toBeDefined();
  });
});
