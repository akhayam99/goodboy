// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { useAppStore } from '../../../../../../store';
import { INITIAL_LIFECYCLE_MAP } from '../../../../../../store/slices/providers/types';
import { buildProviderList } from '../../../../providers';
import { AccountGroup } from './index';

vi.mock('../../../InlineTerminal', () => ({
  InlineTerminal: () => <div>update terminal</div>,
}));
vi.mock('../../ProviderCredentialsSection', () => ({ ProviderCredentialsSection: () => null }));
vi.mock('../../ProviderBindingsSection', () => ({ ProviderBindingsSection: () => null }));

const seedClaude = ({ version }: { readonly version: string }) => {
  useAppStore.setState({
    providers: buildProviderList(
      {
        anthropic: { id: 'anthropic', binary: 'claude', available: true, version, error: null },
        cursor: null,
        codex: null,
        gemini: null,
        opencode: null,
        openrouter: null,
        moonshot: null,
      },
      { anthropic: { state: 'connected', identity: 'dev@acme.test' } },
      new Set(),
    ),
  });
};

const renderAccount = () => {
  const info = useAppStore.getState().providers.find((item) => item.id === 'anthropic');
  if (info === undefined) {
    throw new Error('seed missing');
  }
  return render(
    <AccountGroup
      info={info}
      planLabel={null}
      canReauth
      autoUpdate={false}
      confirm="none"
      onConfirmChange={vi.fn()}
      onReauth={vi.fn()}
      onConfirmReauth={vi.fn()}
      onDisconnect={vi.fn()}
    />,
  );
};

beforeEach(() => {
  seedClaude({ version: '2.1.240' });
  useAppStore.setState({
    cliRequirements: [],
    providerLifecycle: INITIAL_LIFECYCLE_MAP,
    agentTurnState: {},
    runRouting: {},
  });
});

afterEach(cleanup);

describe('AccountGroup CLI row', () => {
  it('shows the CLI label and version in the account group', () => {
    seedClaude({ version: '2.1.300' });
    renderAccount();

    const account = within(screen.getByRole('region', { name: 'Account' }));
    expect(account.getByText('Claude CLI')).toBeDefined();
    expect(account.getByText('2.1.300')).toBeDefined();
    expect(screen.queryByText(/need a newer/)).toBeNull();
  });

  it('anchors the update notice under the account rows, with the same version row', () => {
    const { container } = renderAccount();

    const account = screen.getByRole('region', { name: 'Account' });
    const notice = screen.getByText('Fable 5.1, Opus 5.5 and Sonnet 5.5 need a newer Claude CLI');
    expect(within(account).getByText('2.1.240')).toBeDefined();
    expect(account.contains(notice)).toBe(false);
    expect(
      account.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(container.contains(notice)).toBe(true);
    expect(screen.getByRole('button', { name: 'Update Claude CLI' })).toBeDefined();
  });
});
