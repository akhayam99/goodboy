import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { SETTING_TERMINAL_APP } from '../../../../settings/settings';
import { EscapeHatch } from './index';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ detect_terminals: () => [] });
});

afterEach(cleanup);

describe('EscapeHatch actions', () => {
  it('offers copy and external terminal controls without a notice', async () => {
    store.setState({
      detectedTerminals: [{ id: 'acme', label: 'Acme Terminal', canRunCommand: true }],
    });
    render(<EscapeHatch command="acme login" providerId="codex" action="login" />);
    screen.getByRole('button', { name: 'copy command' });
    screen.getByRole('button', { name: 'Open in Terminal.app' });
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    await waitFor(() => {
      expect(store.getState().detectedTerminals).toEqual([]);
    });
  });

  it('names the configured detected terminal on its launch control', async () => {
    stubStoryInvoke({
      detect_terminals: () => [{ id: 'acme', label: 'Acme Terminal', canRunCommand: true }],
    });
    store.setState({ settings: { [SETTING_TERMINAL_APP]: 'acme' } });
    render(<EscapeHatch command="acme login" providerId="codex" action="login" />);

    expect(await screen.findByRole('button', { name: 'Open in Acme Terminal' })).toBeDefined();
    screen.getByRole('button', { name: 'copy command' });
  });
});
