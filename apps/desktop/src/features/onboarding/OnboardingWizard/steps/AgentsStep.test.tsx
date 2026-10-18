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
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
} from '../../../../store/storyHarness';
import { agentHandlers } from '../testing/agentHandlers';
import { AgentsStep } from './AgentsStep';

const onDone = vi.fn();

const renderStep = () =>
  render(
    <AgentsStep
      mode="full"
      isLocked={false}
      onBack={() => undefined}
      onDone={onDone}
      setBusy={() => undefined}
    />,
  );

const continueButton = () => {
  const button = screen.getByRole('button', { name: /^(continue|retry)/i });
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('Continue is not a button');
  }
  return button;
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  onDone.mockReset();
});

afterEach(cleanup);

describe('AgentsStep', () => {
  it('keeps the step and retries a failed save', async () => {
    stubStoryInvoke(agentHandlers({ signedIn: ['anthropic'], claudeVersion: '2.1.280' }));
    storySpies.setSetting.mockRejectedValueOnce(new Error('database is locked'));
    renderStep();
    await waitFor(() => expect(continueButton().disabled).toBe(false));

    fireEvent.click(continueButton());

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('database is locked'),
    );
    expect(onDone).not.toHaveBeenCalled();
    expect(continueButton().textContent).toContain('Retry');

    fireEvent.click(continueButton());

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(storySpies.setSetting).toHaveBeenLastCalledWith(
      expect.anything(),
      'agents.default',
      'anthropic',
    );
  });

  it('keeps Continue off with no ready agent and opens the first install', async () => {
    stubStoryInvoke(agentHandlers({ signedIn: [] }));
    renderStep();

    await waitFor(() => expect(screen.getByText('Get one agent ready to continue.')).toBeDefined());
    expect(continueButton().disabled).toBe(true);
    expect(screen.getByText('npm install -g @anthropic-ai/claude-code')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Run the Claude install' })).toBeDefined();
    expect(screen.getByText('No agents on this Mac yet.')).toBeDefined();
  });

  it('saves the agent made default on Continue', async () => {
    stubStoryInvoke(
      agentHandlers({
        signedIn: ['anthropic', 'codex'],
        claudeVersion: '2.1.280',
        codexVersion: 'codex-cli 0.62.0',
      }),
    );
    renderStep();
    const makeDefault = await screen.findByRole('button', {
      name: 'Make Codex the default agent',
    });

    fireEvent.click(makeDefault);
    fireEvent.click(continueButton());

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(storySpies.setSetting).toHaveBeenLastCalledWith(
      expect.anything(),
      'agents.default',
      'codex',
    );
  });

  it('counts the ready agents from one function', async () => {
    stubStoryInvoke(agentHandlers({ signedIn: ['anthropic'], claudeVersion: '2.1.280' }));
    renderStep();

    await waitFor(() =>
      expect(screen.getByText('1 ready · checks again when you come back')).toBeDefined(),
    );
    const claude = screen.getByRole('list', { name: 'Agents on this Mac' });
    expect(within(claude).getByText('Default')).toBeDefined();
  });
});
