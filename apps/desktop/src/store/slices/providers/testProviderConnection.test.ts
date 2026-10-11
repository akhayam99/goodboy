vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';

let store: StoryStore;
beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ log_provider_standing: null });
});

describe('Test connection evidence', () => {
  it('counts one authentication refusal for overlapping tests', async () => {
    stubStoryInvoke({
      provider_test_connection: { ok: false, millis: 80, detail: 'Not logged in. Sign in again.' },
    });
    const test = store.getState().testProviderConnection;
    await Promise.all([test({ providerId: 'cursor' }), test({ providerId: 'cursor' })]);
    expect(store.getState().providerHealth.cursor.refusals).toHaveLength(1);
    expect(store.getState().providerConnectionTests.cursor?.isTesting).toBe(false);
    expect(
      storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'provider_test_connection'),
    ).toHaveLength(1);
    expect(
      storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'log_provider_standing'),
    ).toHaveLength(1);
  });

  it('keeps the standing after a timeout and confirms the account after retry', async () => {
    stubStoryInvoke({
      provider_test_connection: { ok: false, millis: 15000, detail: 'Probe timed out' },
    });
    await store.getState().testProviderConnection({ providerId: 'cursor' });
    expect(store.getState().providerHealth.cursor.standing).toBe('unknown');
    expect(store.getState().providerHealth.cursor.refusals).toHaveLength(0);
    stubStoryInvoke({
      provider_test_connection: { ok: true, millis: 800, detail: 'Models answered' },
    });
    await store.getState().testProviderConnection({ providerId: 'cursor' });
    expect(store.getState().providerHealth.cursor.standing).toBe('connected');
    expect(store.getState().providerHealth.cursor.evidence.serverAccepted).toBe(true);
    expect(store.getState().providerHealth.cursor.events.at(-1)?.reason).toBe(
      'Test connection passed',
    );
  });

  it('shows command failure details and keeps another provider untouched', async () => {
    stubStoryInvoke({
      provider_test_connection: () => {
        throw new Error('CLI unavailable');
      },
    });
    const before = store.getState().providerHealth.codex;
    await store.getState().testProviderConnection({ providerId: 'cursor' });
    expect(store.getState().providerConnectionTests.cursor?.result?.detail).toBe('CLI unavailable');
    expect(store.getState().providerHealth.codex).toBe(before);
  });
});
