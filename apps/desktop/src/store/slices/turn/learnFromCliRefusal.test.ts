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

const NOW = Date.UTC(2026, 10, 20, 9, 0, 0);

type RefusedParams = {
  readonly modelKey: string;
  readonly checkedAt: number;
};

const refused = ({ modelKey, checkedAt }: RefusedParams) => ({
  providerId: 'codex' as const,
  accountId: ACCOUNT,
  modelKey,
  plan: null,
  source: 'refused' as const,
  checkedAt,
});

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
      accountId: ACCOUNT,
      model: 'gpt-6.1-sol',
      message,
      nowMs: NOW,
    });

    await vi.waitFor(() =>
      expect(useAppStore.getState().unavailableModels).toEqual([
        {
          providerId: 'codex',
          accountId: ACCOUNT,
          modelKey: 'gpt-6.1-sol',
          plan: null,
          source: 'refused',
          checkedAt: NOW,
        },
      ]),
    );
    expect(storySpies.setSetting).toHaveBeenCalledWith(
      expect.anything(),
      'provider.unavailableModels',
      JSON.stringify(useAppStore.getState().unavailableModels),
    );
  });

  it.each([
    [
      'anthropic',
      'claude-opus-5-5',
      'opus-5.5',
      "There's an issue with the selected model (claude-opus-5-5). It may not exist or you may not have access to it.",
    ],
    [
      'anthropic',
      'claude-opus-5-5',
      'opus-5.5',
      'Claude Opus is not available with the Claude Pro plan. If you have updated your subscription plan recently, run /logout and /login for the plan to take effect.',
    ],
  ] as const)(
    'remembers a %s refusal with the plan the account is on',
    async (providerId, model, modelKey, message) => {
      useAppStore.setState({
        providers: [{ ...codex, id: providerId, label: 'Claude', binary: 'claude' }],
        authResults: { [providerId]: { state: 'connected', identity: ACCOUNT, plan: 'pro' } },
      });

      learnFromCliRefusal({
        get: useAppStore.getState,
        providerId,
        accountId: ACCOUNT,
        model,
        message,
        nowMs: NOW,
      });

      await vi.waitFor(() =>
        expect(useAppStore.getState().unavailableModels).toEqual([
          {
            providerId,
            accountId: ACCOUNT,
            modelKey,
            plan: 'Pro',
            source: 'refused',
            checkedAt: NOW,
          },
        ]),
      );
    },
  );

  it('keeps one entry per model and refreshes its check time when it is refused again', async () => {
    const { learnModelUnavailable } = useAppStore.getState();
    await learnModelUnavailable(refused({ modelKey: 'gpt-6.1-sol', checkedAt: NOW }));

    await learnModelUnavailable(refused({ modelKey: 'gpt-6.1-sol', checkedAt: NOW + 1_000 }));

    expect(useAppStore.getState().unavailableModels).toEqual([
      refused({ modelKey: 'gpt-6.1-sol', checkedAt: NOW + 1_000 }),
    ]);
  });

  it('keeps every refusal and clearing on disk when they land together', async () => {
    useAppStore.setState({
      unavailableModels: [refused({ modelKey: 'gpt-6-astra', checkedAt: NOW })],
    });
    const { learnModelUnavailable, clearModelUnavailable } = useAppStore.getState();

    await Promise.all([
      learnModelUnavailable(refused({ modelKey: 'gpt-6.1-sol', checkedAt: NOW })),
      learnModelUnavailable(refused({ modelKey: 'gpt-6.1-luna', checkedAt: NOW })),
      clearModelUnavailable({ providerId: 'codex', accountId: ACCOUNT, modelKey: 'gpt-6-astra' }),
    ]);

    const saved = [
      refused({ modelKey: 'gpt-6.1-sol', checkedAt: NOW }),
      refused({ modelKey: 'gpt-6.1-luna', checkedAt: NOW }),
    ];
    expect(useAppStore.getState().unavailableModels).toEqual(saved);
    expect(storySpies.setSetting).toHaveBeenLastCalledWith(
      expect.anything(),
      'provider.unavailableModels',
      JSON.stringify(saved),
    );
  });

  it('learns nothing from a refusal that is not about the model', async () => {
    learnFromCliRefusal({
      get: useAppStore.getState,
      providerId: 'codex',
      accountId: ACCOUNT,
      model: 'gpt-6.1-sol',
      message: 'connection reset by peer',
    });

    await Promise.resolve();
    expect(useAppStore.getState().unavailableModels).toEqual([]);
    expect(storySpies.setSetting).not.toHaveBeenCalled();
  });
});
