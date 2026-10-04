// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { useAppStore } from '../../../../../store';
import {
  INITIAL_CONNECT_MAP,
  INITIAL_LIFECYCLE_MAP,
} from '../../../../../store/slices/providers/types';
import { buildProviderList, type ProviderDisplayInfo } from '../../../providers';
import { ProviderPage } from './index';

vi.mock('../../InlineTerminal', () => ({
  InlineTerminal: () => <div>update terminal</div>,
}));
vi.mock('../../ProviderConnect', () => ({
  ProviderConnect: () => <section aria-label="Connect card" />,
}));
vi.mock('../ProviderCredentialsSection', () => ({ ProviderCredentialsSection: () => null }));
vi.mock('../ProviderBindingsSection', () => ({ ProviderBindingsSection: () => null }));

const updateProviderCli = vi.fn(async () => undefined);

const seedClaude = ({
  version,
  available,
  error,
}: {
  readonly version: string | null;
  readonly available: boolean;
  readonly error: string | null;
}): ProviderDisplayInfo => {
  const providers = buildProviderList(
    {
      anthropic: { id: 'anthropic', binary: 'claude', available, version, error },
      cursor: null,
      codex: null,
      gemini: null,
      opencode: null,
      openrouter: null,
      moonshot: null,
    },
    { anthropic: { state: 'disconnected', identity: null } },
    new Set(),
  );
  useAppStore.setState({ providers });
  const info = providers.find((item) => item.id === 'anthropic');
  if (info === undefined) {
    throw new Error('seed missing');
  }
  return info;
};

beforeEach(() => {
  updateProviderCli.mockClear();
  useAppStore.setState({
    cliRequirements: [],
    providerLifecycle: INITIAL_LIFECYCLE_MAP,
    agentTurnState: {},
    runRouting: {},
    providerConnect: INITIAL_CONNECT_MAP,
    updateProviderCli,
  });
});

afterEach(cleanup);

describe('provider page CLI row', () => {
  it('shows the version and the update notice before sign-in, and starts it from the deep link', () => {
    const info = seedClaude({ version: '2.1.240', available: true, error: null });
    expect(info.connection).toBe('installed_disconnected');

    render(<ProviderPage info={info} autoConnect={false} autoUpdate />);

    const account = within(screen.getByRole('region', { name: 'Account' }));
    expect(account.getByText('Claude CLI')).toBeDefined();
    expect(account.getByText('2.1.240')).toBeDefined();
    expect(screen.getByRole('region', { name: 'Connect card' })).toBeDefined();
    expect(
      screen.getByText('Fable 5.1, Opus 5.5 and Sonnet 5.5 need a newer Claude CLI'),
    ).toBeDefined();
    expect(updateProviderCli).toHaveBeenCalledOnce();
    expect(updateProviderCli).toHaveBeenCalledWith('anthropic');
  });

  it('keeps the row and the notice on the detection error page when a version is known', () => {
    const seeded = seedClaude({ version: '2.1.240', available: true, error: null });
    const info: ProviderDisplayInfo = { ...seeded, connection: 'error', error: 'Probe failed' };
    useAppStore.setState({ providers: [info] });

    render(<ProviderPage info={info} autoConnect={false} autoUpdate={false} />);

    expect(screen.getByText('Detection failed')).toBeDefined();
    expect(
      within(screen.getByRole('region', { name: 'Account' })).getByText('2.1.240'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Update Claude CLI' })).toBeDefined();
    expect(updateProviderCli).not.toHaveBeenCalled();
  });

  it('shows no CLI row when the error page has no version', () => {
    const info = seedClaude({ version: null, available: false, error: 'Probe failed' });
    expect(info.connection).toBe('error');

    render(<ProviderPage info={info} autoConnect={false} autoUpdate={false} />);

    expect(screen.queryByRole('region', { name: 'Account' })).toBeNull();
  });

  it('shows no CLI row when the CLI is not installed', () => {
    const info = seedClaude({ version: null, available: false, error: null });

    render(<ProviderPage info={info} autoConnect={false} autoUpdate />);

    expect(screen.queryByRole('region', { name: 'Account' })).toBeNull();
    expect(updateProviderCli).not.toHaveBeenCalled();
  });
});
