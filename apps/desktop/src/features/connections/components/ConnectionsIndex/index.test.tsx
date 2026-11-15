// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId } from '@goodboy/types';
import type {
  GhTokenStatus,
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
  ProviderConnectionState,
  ProviderId,
} from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { connectionsAttentionOf } from '../../model/connectionsAttentionOf';
import { ConnectionsIndex } from './index';

const WORKSPACE = aWorkspace({ name: 'Harborline' });
const AT = brandId<IsoDateTime>({ value: '2026-11-15T10:00:00.000Z' });
const LINEAR_KEY = brandId<IntegrationCredentialId>({ value: 'cred-linear' });

type ProviderParams = {
  readonly id: ProviderId;
  readonly label: string;
  readonly connection: ProviderConnectionState;
};

const aProvider = ({ id, label, connection }: ProviderParams) => ({
  id,
  binary: id,
  capabilities: { models: [] },
  connection,
  version: '99.0.0',
  identity: connection === 'connected' ? 'mara.quint@harborline.dev' : null,
  label,
  error: null,
  docsUrl: 'https://docs.harborline.test',
});

type KeyParams = {
  readonly hasKey: boolean;
};

const GITHUB: GhTokenStatus = { mode: 'gh-cli', available: true, user: 'harborline-bot' };

type CliParams = {
  readonly id: string;
};

const cliStatus = ({ id }: CliParams) => ({
  id,
  binary: id,
  available: true,
  version: '99.0.0',
  error: null,
});

const seed = ({ hasKey }: KeyParams) => {
  stubStoryInvoke({
    integration_credential_has_secret: () => hasKey,
    gh_status: GITHUB,
    refresh_provider_status: () => cliStatus({ id: 'anthropic' }),
    refresh_cursor_status: () => cliStatus({ id: 'cursor' }),
    refresh_codex_status: () => cliStatus({ id: 'codex' }),
    refresh_gemini_status: () => cliStatus({ id: 'gemini' }),
    refresh_copilot_status: () => cliStatus({ id: 'copilot' }),
    refresh_opencode_status: () => cliStatus({ id: 'opencode' }),
    check_provider_auth: {
      state: 'connected',
      identity: 'mara.quint@harborline.dev',
      verified: true,
    },
    log_provider_standing: null,
  });
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    providers: [
      aProvider({ id: 'anthropic', label: 'Claude', connection: 'connected' }),
      aProvider({ id: 'gemini', label: 'Gemini', connection: 'missing' }),
    ],
    githubWorkspaceStatus: { [WORKSPACE.id]: GITHUB },
    workspaceIntegrations: {
      [WORKSPACE.id]: [
        {
          id: brandId<IntegrationBindingId>({ value: 'linear-harborline' }),
          workspaceId: WORKSPACE.id,
          projectId: null,
          provider: 'linear',
          config: { workspaceUrlKey: 'harborline', viewerUserId: 'u-1', viewerName: 'Mara Quint' },
          credentialId: LINEAR_KEY,
          createdAt: AT,
          updatedAt: AT,
        },
      ],
    },
  });
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('ConnectionsIndex', () => {
  it('shows a tile per set up connection and a Not set up row under each group', async () => {
    seed({ hasKey: true });
    render(<ConnectionsIndex workspace={WORKSPACE} />);

    await screen.findByRole('heading', { name: 'Connections' });
    screen.getByText('1 of 2 providers ready · 2 of 7 integrations in Harborline');
    const providers = screen.getByRole('region', { name: 'Providers' });
    within(providers).getByText('This Mac, every workspace');
    within(providers).getByRole('button', { name: 'Claude, Signed in' });
    const providerSetup = within(providers).getByRole('group', { name: 'Not set up' });
    within(providerSetup).getByRole('button', { name: 'Gemini, Install CLI' });
    const tools = screen.getByRole('region', { name: 'Integrations' });
    within(tools).getByText('Harborline workspace');
    within(tools).getByText('harborline-bot');
    await waitFor(() => expect(within(tools).getAllByText(/^Checked /)).toHaveLength(2));
    within(tools).getByRole('button', { name: 'GitHub, Connected' });
    within(tools).getByRole('button', { name: 'Linear, Connected' });
    expect(
      within(within(tools).getByRole('group', { name: 'Not set up' })).getAllByRole('button'),
    ).toHaveLength(5);
  });

  it('turns the word and the door reason red when the key is missing, without moving the tile', async () => {
    seed({ hasKey: false });
    render(<ConnectionsIndex workspace={WORKSPACE} />);

    const tools = await screen.findByRole('region', { name: 'Integrations' });
    await within(tools).findByRole('button', { name: 'Linear, Key missing' });
    expect(
      within(tools)
        .getAllByRole('button')
        .map((button) => button.getAttribute('data-connection-tile')),
    ).toEqual(['github', 'linear', null, null, null, null, null]);
    expect(connectionsAttentionOf({ state: useAppStore.getState(), nowMs: Date.now() })).toBe(
      'Linear: Key missing',
    );
  });

  it('says how to connect tools when no workspace is open', async () => {
    seed({ hasKey: true });
    render(<ConnectionsIndex workspace={null} />);

    const tools = await screen.findByRole('region', { name: 'Integrations' });
    within(tools).getByText('Open a workspace to connect its tools');
    expect(within(tools).queryAllByRole('button')).toHaveLength(0);
    screen.getByText('1 of 2 providers ready');
  });

  it('asks for a first provider when nothing is set up', async () => {
    seed({ hasKey: true });
    useAppStore.setState({
      providers: [aProvider({ id: 'anthropic', label: 'Claude', connection: 'missing' })],
    });
    render(<ConnectionsIndex workspace={WORKSPACE} />);

    await screen.findByText('Connect a provider to start a session');
  });

  it('checks every tool again from the refresh button', async () => {
    seed({ hasKey: true });
    render(<ConnectionsIndex workspace={WORKSPACE} />);
    const tools = await screen.findByRole('region', { name: 'Integrations' });
    await waitFor(() => expect(within(tools).getAllByText(/^Checked /)).toHaveLength(2));
    const before = storySpies.tauriInvoke.mock.calls.filter(
      ([command]) => command === 'integration_credential_has_secret',
    ).length;

    fireEvent.click(screen.getByRole('button', { name: 'Refresh connections' }));

    await waitFor(() =>
      expect(
        storySpies.tauriInvoke.mock.calls.filter(
          ([command]) => command === 'integration_credential_has_secret',
        ).length,
      ).toBe(before + 1),
    );
  });

  it('opens the provider page from its tile and the role models from the link', async () => {
    seed({ hasKey: true });
    const onOpen = vi.fn();
    window.addEventListener('goodboy:open-settings', onOpen);
    render(<ConnectionsIndex workspace={WORKSPACE} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Claude, Signed in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Which model each role uses' }));

    expect(onOpen.mock.calls.map(([event]) => event.detail)).toEqual([
      { scope: 'providers', provider: 'anthropic' },
      { scope: 'providers' },
    ]);
    window.removeEventListener('goodboy:open-settings', onOpen);
  });
});
