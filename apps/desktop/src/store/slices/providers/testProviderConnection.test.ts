vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());

import { catalogModelForId } from '@goodboy/core/providers';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderDisplayInfo } from '../../../features/providers/providers';
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
      provider_test_connection: {
        ok: false,
        millis: 80,
        outcome: 'refused',
        secs: null,
        detail: 'Not logged in. Sign in again.',
      },
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
      provider_test_connection: {
        ok: false,
        millis: 15000,
        outcome: 'timed_out',
        secs: 15,
        detail: '',
      },
    });
    await store.getState().testProviderConnection({ providerId: 'cursor' });
    expect(store.getState().providerHealth.cursor.standing).toBe('unknown');
    expect(store.getState().providerHealth.cursor.refusals).toHaveLength(0);
    stubStoryInvoke({
      provider_test_connection: {
        ok: true,
        millis: 800,
        outcome: 'answered',
        secs: null,
        detail: '',
      },
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

const ACCOUNT = 'dev@northwind.test';

const cursor: ProviderDisplayInfo = {
  id: 'cursor',
  label: 'Cursor',
  binary: 'cursor-agent',
  connection: 'connected',
  version: '2026.11.20',
  identity: ACCOUNT,
  error: null,
  docsUrl: '',
  capabilities: { models: [] },
};

type KeyParams = {
  readonly slug: string;
};

const keyOf = ({ slug }: KeyParams): string =>
  catalogModelForId({ provider: 'cursor', modelId: slug })?.key ?? slug;

const OPUS = keyOf({ slug: 'claude-opus-5-5-high' });
const SONNET = keyOf({ slug: 'claude-sonnet-5-5-high' });

type AnsweredParams = {
  readonly models: ReadonlyArray<string>;
};

const answered = ({ models }: AnsweredParams) => ({
  ok: true,
  millis: 800,
  outcome: 'answered',
  secs: null,
  detail: '',
  models,
});

const unlistedKeys = (): ReadonlyArray<string> =>
  store
    .getState()
    .unavailableModels.filter((entry) => entry.source === 'unlisted')
    .map((entry) => entry.modelKey);

describe('the models a Cursor account lists', () => {
  beforeEach(() => {
    store.setState({ providers: [cursor], unavailableModels: [] });
  });

  it('marks every model the account does not list as unavailable for that account', async () => {
    stubStoryInvoke({
      provider_test_connection: answered({
        models: ['auto', 'claude-sonnet-5-5-high', 'composer-2.5'],
      }),
    });

    await store.getState().testProviderConnection({ providerId: 'cursor' });

    expect(unlistedKeys()).toContain(OPUS);
    expect(unlistedKeys()).not.toContain(SONNET);
    expect(store.getState().unavailableModels.every((entry) => entry.accountId === ACCOUNT)).toBe(
      true,
    );
  });

  it('replaces the earlier list on the next check', async () => {
    stubStoryInvoke({
      provider_test_connection: answered({ models: ['claude-sonnet-5-5-high'] }),
    });
    await store.getState().testProviderConnection({ providerId: 'cursor' });
    stubStoryInvoke({
      provider_test_connection: answered({
        models: ['claude-sonnet-5-5-high', 'claude-opus-5-5-high'],
      }),
    });

    await store.getState().testProviderConnection({ providerId: 'cursor' });

    expect(unlistedKeys()).not.toContain(OPUS);
    expect(new Set(unlistedKeys()).size).toBe(unlistedKeys().length);
  });

  it.each([
    ['an empty list', []],
    ['a list with no model Goodboy knows', ['northwind-model']],
  ])('changes nothing on %s', async (_label, models) => {
    stubStoryInvoke({ provider_test_connection: answered({ models }) });

    await store.getState().testProviderConnection({ providerId: 'cursor' });

    expect(store.getState().unavailableModels).toEqual([]);
  });

  it('drops a list that arrives after the account changed', async () => {
    stubStoryInvoke({
      provider_test_connection: () => {
        store.setState({ providers: [{ ...cursor, identity: 'ops@acme.test' }] });
        return answered({ models: ['claude-sonnet-5-5-high'] });
      },
    });

    await store.getState().testProviderConnection({ providerId: 'cursor' });

    expect(store.getState().unavailableModels).toEqual([]);
  });
});
