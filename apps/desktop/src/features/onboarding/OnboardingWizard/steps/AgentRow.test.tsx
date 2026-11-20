// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ProviderConnectPhase } from '../../../../store/slices/providers';
import { IDLE_CONNECT } from '../../../../store/slices/providers/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { agentHandlers, agentStatus } from '../testing/agentHandlers';
import { AgentsStep } from './AgentsStep';

let useAppStore: StoryStore;

const renderStep = () =>
  render(
    <AgentsStep
      mode="full"
      isLocked={false}
      onBack={null}
      onDone={() => undefined}
      setBusy={() => undefined}
    />,
  );

type PhaseParams = {
  readonly phase: ProviderConnectPhase;
};

const setCodexPhase = ({ phase }: PhaseParams) =>
  useAppStore.setState((state) => ({
    providerConnect: {
      ...state.providerConnect,
      codex: {
        ...IDLE_CONNECT,
        phase,
        step: 'login',
        command: 'codex login',
        runId: phase === 'working' ? 'run-codex-login' : null,
      },
    },
  }));

type RowParams = {
  readonly id: string;
};

const rowOf = ({ id }: RowParams) => {
  const row = document.querySelector<HTMLElement>(`[data-row="${id}"]`);
  if (row === null) {
    throw new Error(`no ${id} row`);
  }
  return within(row);
};

const codexRow = () => rowOf({ id: 'codex' });

type TooOldParams = {
  readonly identity: string | null;
};

const tooOldClaude = ({ identity }: TooOldParams) => ({
  state: identity === null ? 'unknown' : 'connected',
  identity,
  verified: false,
  reason: { kind: 'cli_too_old', version: '2.1.37', minimum: '2.1.41' },
});

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('AgentRow', () => {
  it('heals after sign in, once the CLI says it is signed in', async () => {
    stubStoryInvoke(
      agentHandlers({
        signedIn: ['anthropic'],
        claudeVersion: '2.1.280',
        codexVersion: 'codex-cli 0.62.0',
      }),
    );
    useAppStore.setState({ connectProvider: async () => setCodexPhase({ phase: 'working' }) });
    renderStep();

    fireEvent.click(await screen.findByRole('button', { name: 'Sign in to Codex' }));
    await waitFor(() => expect(codexRow().getByText('Signing in')).toBeDefined());
    expect(codexRow().getByText('codex login')).toBeDefined();

    stubStoryInvoke(
      agentHandlers({
        signedIn: ['anthropic', 'codex'],
        claudeVersion: '2.1.280',
        codexVersion: 'codex-cli 0.62.0',
      }),
    );
    act(() => setCodexPhase({ phase: 'success' }));

    await waitFor(() => expect(codexRow().getByText('Ready')).toBeDefined());
    expect(codexRow().getByText('Codex 0.62.0 · dana@northwind.dev')).toBeDefined();
  });

  it('ignores a closed session and stays signed out', async () => {
    stubStoryInvoke(
      agentHandlers({
        signedIn: ['anthropic'],
        claudeVersion: '2.1.280',
        codexVersion: 'codex-cli 0.62.0',
      }),
    );
    renderStep();
    await screen.findByRole('button', { name: 'Sign in to Codex' });
    act(() => setCodexPhase({ phase: 'working' }));
    await waitFor(() => expect(codexRow().getByText('Signing in')).toBeDefined());

    act(() => setCodexPhase({ phase: 'cancelled' }));

    await waitFor(() => expect(codexRow().getByText('Not signed in')).toBeDefined());
    expect(codexRow().queryByText('codex login')).toBeNull();
    expect(codexRow().queryByText('Ready')).toBeNull();
    expect(codexRow().getByText('Codex 0.62.0 found')).toBeDefined();
    expect(codexRow().getAllByText(/not signed in/i)).toHaveLength(1);
  });

  it('says Not installed once and names the product to install', async () => {
    stubStoryInvoke(agentHandlers({ signedIn: ['anthropic'], claudeVersion: '2.1.280' }));
    renderStep();

    const cursor = () => rowOf({ id: 'cursor' });
    await waitFor(() => expect(cursor().getByText('Not installed')).toBeDefined());
    expect(cursor().getByText('Cursor Agent')).toBeDefined();
    expect(cursor().queryAllByText(/not installed|not found|isn't on this Mac/i)).toHaveLength(1);
    expect(rowOf({ id: 'gemini' }).getByText('Antigravity')).toBeDefined();
  });

  it("shows why an agent can't start and checks it again", async () => {
    stubStoryInvoke({
      ...agentHandlers({ signedIn: ['anthropic'], claudeVersion: '2.1.280' }),
      refresh_codex_status: agentStatus({
        id: 'codex',
        binary: 'codex',
        error: 'error: config.toml line 12: expected a value after "model ="',
        errorKind: 'exit',
      }),
    });
    renderStep();
    await waitFor(() => expect(codexRow().getByText("Can't start")).toBeDefined());

    fireEvent.click(codexRow().getByRole('button', { name: 'Show output' }));
    expect(
      codexRow().getByText('error: config.toml line 12: expected a value after "model ="'),
    ).toBeDefined();

    stubStoryInvoke(
      agentHandlers({
        signedIn: ['anthropic', 'codex'],
        claudeVersion: '2.1.280',
        codexVersion: 'codex-cli 0.62.0',
      }),
    );
    fireEvent.click(codexRow().getByRole('button', { name: 'Check Codex again' }));

    await waitFor(() => expect(codexRow().getByText('Ready')).toBeDefined());
  });

  it('asks for an update when the Claude CLI is too old to report sign in', async () => {
    const lifecycleRuns: Array<unknown> = [];
    stubStoryInvoke({
      ...agentHandlers({ signedIn: [], claudeVersion: '2.1.37 (Claude Code)' }),
      check_provider_auth: () => tooOldClaude({ identity: null }),
      provider_lifecycle_run: (args: unknown) => {
        lifecycleRuns.push(args);
        return null;
      },
    });
    renderStep();

    const claude = () => rowOf({ id: 'anthropic' });
    await waitFor(() => claude().getByText('Update needed'));
    claude().getByText('Claude Code 2.1.37 found. Goodboy needs 2.1.41 or later');
    expect(claude().queryByRole('button', { name: 'Sign in to Claude' })).toBeNull();

    fireEvent.click(claude().getByRole('button', { name: 'Update Claude Code' }));

    await waitFor(() =>
      expect(lifecycleRuns).toContainEqual(
        expect.objectContaining({ providerId: 'anthropic', action: 'update' }),
      ),
    );
  });

  it('keeps an old Claude CLI ready when its config names the account', async () => {
    stubStoryInvoke({
      ...agentHandlers({ signedIn: [], claudeVersion: '2.1.37 (Claude Code)' }),
      check_provider_auth: (args: { readonly providerId?: string } | undefined) =>
        args?.providerId === 'anthropic'
          ? tooOldClaude({ identity: 'dana@northwind.dev' })
          : { state: 'disconnected', identity: null },
    });
    renderStep();

    const claude = () => rowOf({ id: 'anthropic' });
    await waitFor(() => claude().getByText('Update needed'));
    claude().getByText('Claude Code 2.1.37 · dana@northwind.dev. Goodboy needs 2.1.41 or later');
    await screen.findByText('1 ready · checks again when you come back');
  });
});
