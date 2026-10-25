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

const codexRow = () => {
  const row = document.querySelector<HTMLElement>('[data-row="codex"]');
  if (row === null) {
    throw new Error('no Codex row');
  }
  return within(row);
};

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

    fireEvent.click(codexRow().getByRole('button', { name: 'Output' }));
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
});
