import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderDisplayInfo } from '../../../features/providers/providers';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';
import { learnFromCliRefusal } from './learnFromCliRefusal';

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

const codex: ProviderDisplayInfo = {
  id: 'codex',
  label: 'Codex',
  binary: 'codex',
  connection: 'connected',
  version: '0.162.1',
  identity: ACCOUNT,
  error: null,
  docsUrl: '',
  capabilities: { models: [] },
};

const CHATGPT_ACCOUNT =
  '{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The \'gpt-6.1-sol\' model is not supported when using Codex with a ChatGPT account."}}';

const CODEX_ACCOUNT = 'model gpt-6.1-sol is not available with this Codex account';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ providers: [codex], unavailableModels: [] });
});

describe('a provider that refuses a model for this account', () => {
  it.each([
    ['the ChatGPT account text', CHATGPT_ACCOUNT],
    ['the Codex account text', CODEX_ACCOUNT],
  ])('remembers the model for the account on %s', async (_label, message) => {
    learnFromCliRefusal({
      get: useAppStore.getState,
      providerId: 'codex',
      model: 'gpt-6.1-sol',
      message,
    });

    await vi.waitFor(() =>
      expect(useAppStore.getState().unavailableModels).toEqual([
        { providerId: 'codex', accountId: ACCOUNT, modelKey: 'gpt-6.1-sol' },
      ]),
    );
    expect(storySpies.setSetting).toHaveBeenCalledWith(
      expect.anything(),
      'provider.unavailableModels',
      JSON.stringify(useAppStore.getState().unavailableModels),
    );
  });

  it('learns nothing from a refusal that is not about the model', async () => {
    learnFromCliRefusal({
      get: useAppStore.getState,
      providerId: 'codex',
      model: 'gpt-6.1-sol',
      message: 'connection reset by peer',
    });

    await Promise.resolve();
    expect(useAppStore.getState().unavailableModels).toEqual([]);
    expect(storySpies.setSetting).not.toHaveBeenCalled();
  });
});
