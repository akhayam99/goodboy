import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_LIFECYCLE_MAP } from './types';
import { runLifecycle } from './runLifecycle';

const providerMocks = vi.hoisted(() => ({
  buildProviderList: vi.fn(() => []),
}));

const lifecycleMocks = vi.hoisted(() => ({
  exitHandler: null as ((payload: unknown) => void) | null,
  invokeProviderLifecycleRun: vi.fn(async (_params: { readonly runId: string }) => undefined),
  listenLifecycleOutput: vi.fn(async () => vi.fn()),
  listenLifecycleExit: vi.fn(async (handler: (payload: unknown) => void) => {
    lifecycleMocks.exitHandler = handler;
    return vi.fn();
  }),
  resolveLifecycleCommand: vi.fn(() => 'provider command'),
}));

vi.mock('../../../features/providers/providers', () => ({
  buildProviderList: providerMocks.buildProviderList,
}));

vi.mock('../../../features/providers/provider-lifecycle', () => lifecycleMocks);

beforeEach(() => {
  vi.clearAllMocks();
  lifecycleMocks.exitHandler = null;
});

describe('runLifecycle', () => {
  it('writes an openrouter lifecycle exit status to the openrouter slot', async () => {
    const refreshProviders = vi.fn(async () => undefined);
    let state: Record<string, unknown> = {
      providerLifecycle: { ...INITIAL_LIFECYCLE_MAP },
      providerStatus: null,
      cursorStatus: null,
      codexStatus: null,
      geminiStatus: null,
      authResults: null,
      providers: [],
      providerCredentials: [],
      refreshProviders,
    };
    const set = vi.fn(
      (
        update:
          | Record<string, unknown>
          | ((current: Record<string, unknown>) => Record<string, unknown>),
      ) => {
        const patch = typeof update === 'function' ? update(state) : update;
        state = { ...state, ...patch };
      },
    );
    const get = vi.fn(() => state);

    await runLifecycle(set as never, get as never, {
      providerId: 'openrouter',
      action: 'login',
    });
    const invocation = lifecycleMocks.invokeProviderLifecycleRun.mock.calls[0]?.[0];
    expect(invocation).toBeDefined();
    if (invocation === undefined) {
      return;
    }

    const status = {
      id: 'opencode',
      binary: 'opencode',
      available: true,
      version: '1.2.3',
      error: null,
    };
    lifecycleMocks.exitHandler?.({
      runId: invocation.runId,
      providerId: 'openrouter',
      action: 'login',
      exitCode: 0,
      status,
      auth: { state: 'connected', identity: 'account' },
    });

    expect(providerMocks.buildProviderList).toHaveBeenCalledWith(
      expect.objectContaining({
        opencode: null,
        openrouter: { ...status, id: 'openrouter' },
      }),
      expect.objectContaining({
        openrouter: { state: 'connected', identity: 'account' },
      }),
      new Set(),
    );
    expect(refreshProviders).toHaveBeenCalledOnce();
  });
});
