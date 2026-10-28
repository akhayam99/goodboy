// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
        copilot: null,
        opencode: null,
        openrouter: null,
        moonshot: null,
      },
      { anthropic: { state: 'connected', identity: 'dev@acme.test' } },
      new Set(),
    ),
  });
};

type AccountParams = {
  readonly isHistoryOpen?: boolean;
  readonly onCloseHistory?: () => void;
  readonly onReauth?: () => Promise<void>;
};

const renderAccount = ({
  isHistoryOpen = false,
  onCloseHistory = vi.fn(),
  onReauth = vi.fn(async () => undefined),
}: AccountParams = {}) => {
  const info = useAppStore.getState().providers.find((item) => item.id === 'anthropic');
  if (info === undefined) {
    throw new Error('seed missing');
  }
  return render(
    <AccountGroup
      info={info}
      planLabel="Max"
      autoUpdate={false}
      target={{
        kind: 'provider',
        facts: {
          label: 'Claude',
          cliPath: '/usr/local/bin/claude',
          isChecking: false,
          canReauth: true,
          willSignOutOnReauth: false,
          canDisconnect: true,
          onCheck: vi.fn(async () => undefined),
          onReauth,
          onShowHistory: vi.fn(),
          onDisconnect: vi.fn(async () => undefined),
        },
      }}
      isHistoryOpen={isHistoryOpen}
      onCloseHistory={onCloseHistory}
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
    const notice = screen.getByText(
      'Fable 5.1, Opus 5.5, Sonnet 5.5 and Haiku 5.5 need a newer Claude CLI',
    );
    expect(within(account).getByText('2.1.240')).toBeDefined();
    expect(account.contains(notice)).toBe(false);
    expect(
      account.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(container.contains(notice)).toBe(true);
    expect(screen.getByRole('button', { name: 'Update Claude CLI' })).toBeDefined();
  });
});

describe('AccountGroup signed in row', () => {
  it('says who is signed in, the plan and one state chip, with no button', () => {
    seedClaude({ version: '99.0.0' });
    renderAccount();

    const account = within(screen.getByRole('region', { name: 'Account' }));
    expect(account.getByText('Signed in as dev@acme.test')).toBeDefined();
    expect(account.getByText(/Max plan/)).toBeDefined();
    expect(account.getByText('Working')).toBeDefined();
    expect(account.queryByRole('button', { name: 'Disconnect' })).toBeNull();
    expect(account.queryByRole('button', { name: 'Test connection' })).toBeNull();
    expect(account.queryByRole('button', { name: 'History' })).toBeNull();
    expect(account.queryByRole('button', { name: 'Sign in again' })).toBeNull();
  });

  it('offers Sign in again on the row once the last connection test failed', () => {
    useAppStore.setState({
      providerConnectionTests: {
        ...useAppStore.getState().providerConnectionTests,
        anthropic: {
          isTesting: false,
          result: {
            isOk: false,
            millis: 40,
            outcome: 'refused',
            secs: null,
            detail: 'Not logged in',
          },
        },
      },
    });
    renderAccount();

    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeDefined();
  });

  it('shows the history panel only while the page asks for it, and hides it from its button', () => {
    const onCloseHistory = vi.fn();
    renderAccount({ onCloseHistory });
    expect(screen.queryByRole('region', { name: 'Claude connection history' })).toBeNull();
    cleanup();
    renderAccount({ isHistoryOpen: true, onCloseHistory });

    expect(screen.getByRole('region', { name: 'Claude connection history' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Hide history' }));
    expect(onCloseHistory).toHaveBeenCalledOnce();
  });
});
