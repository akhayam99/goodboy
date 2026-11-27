import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderDisplayInfo } from '../../../features/providers/providers';
import { SETTING_HIDDEN_MODELS } from '../../../features/settings/settings';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { selectBlockedModels } from './selectBlockedModels';
import {
  SETTING_UNAVAILABLE_MODELS,
  UNAVAILABLE_MODEL_TTL_MS,
  parseUnavailableModels,
} from './unavailableModelsSetting';

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

const ACCOUNT = 'dev@northwind.test';
const NOW = Date.UTC(2026, 10, 20, 9, 0, 0);

const claude: ProviderDisplayInfo = {
  id: 'anthropic',
  label: 'Claude',
  binary: 'claude',
  connection: 'connected',
  version: '2.1.330',
  identity: ACCOUNT,
  error: null,
  docsUrl: '',
  capabilities: { models: [] },
};

const REFUSED_OPUS = {
  providerId: 'anthropic' as const,
  accountId: ACCOUNT,
  modelKey: 'opus-5.5',
  plan: 'Pro',
  source: 'refused' as const,
  checkedAt: NOW,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    providers: [claude],
    authResults: { anthropic: { state: 'connected', identity: ACCOUNT, plan: 'pro' } },
    settings: { [SETTING_HIDDEN_MODELS]: JSON.stringify({ anthropic: ['haiku-4.5'] }) },
    unavailableModels: [REFUSED_OPUS],
  });
});

describe('the models routing must avoid', () => {
  it('holds the hidden models and the refused ones of the signed in account', () => {
    expect(selectBlockedModels({ state: useAppStore.getState(), nowMs: NOW })).toEqual({
      anthropic: ['haiku-4.5', 'opus-5.5'],
    });
  });

  it('forgets a refusal after seven days', () => {
    const blocked = selectBlockedModels({
      state: useAppStore.getState(),
      nowMs: NOW + UNAVAILABLE_MODEL_TTL_MS,
    });

    expect(blocked).toEqual({ anthropic: ['haiku-4.5'] });
  });

  it('forgets a refusal when the account moves to another plan', () => {
    useAppStore.setState({
      authResults: { anthropic: { state: 'connected', identity: ACCOUNT, plan: 'max' } },
    });

    expect(selectBlockedModels({ state: useAppStore.getState(), nowMs: NOW })).toEqual({
      anthropic: ['haiku-4.5'],
    });
  });

  it('keeps a refusal while the plan is not known', () => {
    useAppStore.setState({
      authResults: { anthropic: { state: 'connected', identity: ACCOUNT } },
    });

    expect(selectBlockedModels({ state: useAppStore.getState(), nowMs: NOW })).toEqual({
      anthropic: ['haiku-4.5', 'opus-5.5'],
    });
  });

  it('ignores the refusals of another account', () => {
    useAppStore.setState({ providers: [{ ...claude, identity: 'ops@acme.test' }] });

    expect(selectBlockedModels({ state: useAppStore.getState(), nowMs: NOW })).toEqual({
      anthropic: ['haiku-4.5'],
    });
  });
});

describe('the saved refusals', () => {
  it('reads back what was written and drops an entry with no check time', () => {
    const raw = JSON.stringify([
      REFUSED_OPUS,
      { providerId: 'codex', accountId: ACCOUNT, modelKey: 'gpt-6.1-sol' },
    ]);

    expect(parseUnavailableModels({ raw })).toEqual([REFUSED_OPUS]);
    expect(SETTING_UNAVAILABLE_MODELS).toBe('provider.unavailableModels');
  });
});
