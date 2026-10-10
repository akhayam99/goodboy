vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

const lifecycleMocks = vi.hoisted(() => ({
  exitHandler: null as ((payload: unknown) => void) | null,
  invokeProviderLifecycleRun: vi.fn(async (_params: { readonly runId: string }) => undefined),
  listenLifecycleOutput: vi.fn(async () => vi.fn()),
  listenLifecycleExit: vi.fn(async (handler: (payload: unknown) => void) => {
    lifecycleMocks.exitHandler = handler;
    return vi.fn();
  }),
}));

vi.mock('../../../features/providers/provider-lifecycle', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../features/providers/provider-lifecycle')>();
  return { ...actual, ...lifecycleMocks };
});

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { INITIAL_HEALTH, INITIAL_HEALTH_MAP, reduceProviderHealth } from './providerHealth';
import { runLifecycle } from './runLifecycle';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const goodCursor = () =>
  reduceProviderHealth({
    health: INITIAL_HEALTH,
    action: {
      type: 'probe',
      at: 1_000_000,
      outcome: { kind: 'good', localTokens: true, serverAccepted: true, identity: null },
    },
  }).health;

const cursorStatus = {
  id: 'cursor',
  binary: 'cursor-agent',
  available: true,
  version: '1.0.0',
  error: null,
};

const logoutExit = () => {
  const invocation = lifecycleMocks.invokeProviderLifecycleRun.mock.calls[0]?.[0];
  lifecycleMocks.exitHandler?.({
    runId: invocation?.runId,
    providerId: 'cursor',
    action: 'logout',
    exitCode: 0,
    status: cursorStatus,
    auth: { state: 'disconnected', identity: null },
  });
};

beforeEach(async () => {
  await resetStoryStore();
  vi.clearAllMocks();
  lifecycleMocks.exitHandler = null;
  useAppStore.setState({
    providerHealth: { ...INITIAL_HEALTH_MAP, cursor: goodCursor() },
    refreshProviders: vi.fn(async () => undefined),
  });
});

describe('a lifecycle exit', () => {
  it('signs a provider out at once after a Goodboy sign-out, without waiting for a second answer', async () => {
    await runLifecycle(useAppStore.setState, useAppStore.getState, {
      providerId: 'cursor',
      action: 'logout',
    });
    logoutExit();
    const { providerHealth } = useAppStore.getState();
    expect(providerHealth.cursor.standing).toBe('signed_out');
    expect(providerHealth.anthropic.standing).toBe('unknown');
  });

  it('asks for a fresh probe set once the run is over', async () => {
    await runLifecycle(useAppStore.setState, useAppStore.getState, {
      providerId: 'cursor',
      action: 'logout',
    });
    logoutExit();
    expect(useAppStore.getState().refreshProviders).toHaveBeenCalledWith({ isFresh: true });
  });
});
