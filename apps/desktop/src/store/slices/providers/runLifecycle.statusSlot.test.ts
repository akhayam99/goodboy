vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

const lifecycleMocks = vi.hoisted(() => {
  const exitHandlers: Array<(payload: unknown) => void> = [];
  return {
    exitHandlers,
    invokeProviderLifecycleRun: vi.fn(async (_params: { readonly runId: string }) => undefined),
    listenLifecycleOutput: vi.fn(async () => vi.fn()),
    listenLifecycleExit: vi.fn(async (handler: (payload: unknown) => void) => {
      exitHandlers.push(handler);
      return vi.fn();
    }),
  };
});

vi.mock('../../../features/providers/provider-lifecycle', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../features/providers/provider-lifecycle')>();
  return { ...actual, ...lifecycleMocks };
});

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { providerFlags, providersOnSameBinary } from '@goodboy/core';
import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { runLifecycle } from './runLifecycle';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.clearAllMocks();
  lifecycleMocks.exitHandlers.length = 0;
  useAppStore.setState({ refreshProviders: vi.fn(async () => undefined) });
});

const SLOT_KEYS = ['providerStatus', 'cursorStatus', 'codexStatus', 'geminiStatus'] as const;

const installAndExit = async (providerId: ProviderId): Promise<void> => {
  await runLifecycle(useAppStore.setState, useAppStore.getState, {
    providerId,
    action: 'install',
  });
  const invocation = lifecycleMocks.invokeProviderLifecycleRun.mock.calls.at(-1)?.[0];
  lifecycleMocks.exitHandlers.at(-1)?.({
    runId: invocation?.runId,
    providerId,
    action: 'install',
    exitCode: 0,
    status: {
      id: providerId,
      binary: providerFlags({ id: providerId }).binary,
      available: true,
      version: '1.2.3',
      error: null,
    },
    auth: { state: 'connected', identity: 'mia@harborline.example' },
  });
};

describe('a lifecycle exit, per provider', () => {
  it.each(PROVIDER_IDS)('%s fills its own status slot and no other', async (providerId) => {
    await installAndExit(providerId);
    const state = useAppStore.getState();
    const { statusSlot } = providerFlags({ id: providerId });

    for (const key of SLOT_KEYS) {
      if (key === statusSlot) {
        expect(state[key]?.id, `${providerId} ${key}`).toBe(providerId);
        continue;
      }
      expect(state[key], `${providerId} ${key}`).toBeNull();
    }
  });

  it.each(PROVIDER_IDS)(
    '%s shows its version on every provider of its binary',
    async (providerId) => {
      await installAndExit(providerId);
      const { providers } = useAppStore.getState();

      for (const id of providersOnSameBinary({ id: providerId })) {
        expect(
          providers.find((provider) => provider.id === id)?.version,
          `${providerId} ${id}`,
        ).toBe('1.2.3');
      }
    },
  );
});
