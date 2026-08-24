import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE_CONNECT, INITIAL_CONNECT_MAP, INITIAL_LIFECYCLE_MAP } from './types';
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
}));

vi.mock('../../../features/providers/providers', () => ({
  buildProviderList: providerMocks.buildProviderList,
}));

vi.mock('../../../features/providers/provider-lifecycle', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../features/providers/provider-lifecycle')>();
  return { ...actual, ...lifecycleMocks };
});

beforeEach(() => {
  vi.clearAllMocks();
  lifecycleMocks.exitHandler = null;
});

describe('runLifecycle', () => {
  it('writes an opencode lifecycle exit status to both shared binary slots', async () => {
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
      providerConnect: { ...INITIAL_CONNECT_MAP },
      refreshProviders,
    };
    const set = vi.fn(
      (
        update:
          Record<string, unknown> | ((current: Record<string, unknown>) => Record<string, unknown>),
      ) => {
        const patch = typeof update === 'function' ? update(state) : update;
        state = { ...state, ...patch };
      },
    );
    const get = vi.fn(() => state);

    await runLifecycle(set as never, get as never, {
      providerId: 'opencode',
      action: 'login',
    });
    const invocation = lifecycleMocks.invokeProviderLifecycleRun.mock.calls[0]?.[0];
    expect(invocation).toBeDefined();
    if (invocation === undefined) {
      return;
    }
    expect(lifecycleMocks.invokeProviderLifecycleRun).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'opencode',
        action: 'login',
        command: 'opencode auth login',
      }),
    );

    const status = {
      id: 'opencode',
      binary: 'opencode',
      available: true,
      version: '1.2.3',
      error: null,
    };
    lifecycleMocks.exitHandler?.({
      runId: invocation.runId,
      providerId: 'opencode',
      action: 'login',
      exitCode: 0,
      status,
      auth: { state: 'connected', identity: 'account' },
    });

    expect(providerMocks.buildProviderList).toHaveBeenCalledWith(
      expect.objectContaining({
        opencode: status,
        openrouter: { ...status, id: 'openrouter' },
      }),
      expect.objectContaining({
        opencode: { state: 'connected', identity: 'account' },
      }),
      new Set(),
    );
    expect(refreshProviders).toHaveBeenCalledOnce();
  });

  it('writes an openrouter lifecycle exit status to both shared binary slots', async () => {
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
      providerConnect: { ...INITIAL_CONNECT_MAP },
      refreshProviders,
    };
    const set = vi.fn(
      (
        update:
          Record<string, unknown> | ((current: Record<string, unknown>) => Record<string, unknown>),
      ) => {
        const patch = typeof update === 'function' ? update(state) : update;
        state = { ...state, ...patch };
      },
    );
    const get = vi.fn(() => state);

    await runLifecycle(set as never, get as never, {
      providerId: 'openrouter',
      action: 'logout',
    });
    const invocation = lifecycleMocks.invokeProviderLifecycleRun.mock.calls[0]?.[0];
    if (invocation === undefined) {
      throw new Error('expected a lifecycle invocation');
    }

    const status = {
      id: 'openrouter',
      binary: 'opencode',
      available: true,
      version: '1.2.3',
      error: null,
    };
    lifecycleMocks.exitHandler?.({
      runId: invocation.runId,
      providerId: 'openrouter',
      action: 'logout',
      exitCode: 0,
      status,
      auth: { state: 'disconnected', identity: null },
    });

    expect(providerMocks.buildProviderList).toHaveBeenCalledWith(
      expect.objectContaining({
        opencode: { ...status, id: 'opencode' },
        openrouter: status,
      }),
      expect.objectContaining({
        openrouter: { state: 'disconnected', identity: null },
      }),
      new Set(),
    );
  });

  it('drops a connect state claiming success when a logout lands disconnected', async () => {
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
      providerConnect: {
        ...INITIAL_CONNECT_MAP,
        cursor: { ...IDLE_CONNECT, phase: 'success', identity: 'dev@example.com' },
      },
      refreshProviders,
    };
    const set = vi.fn(
      (
        update:
          Record<string, unknown> | ((current: Record<string, unknown>) => Record<string, unknown>),
      ) => {
        const patch = typeof update === 'function' ? update(state) : update;
        state = { ...state, ...patch };
      },
    );
    const get = vi.fn(() => state);

    await runLifecycle(set as never, get as never, { providerId: 'cursor', action: 'logout' });
    const invocation = lifecycleMocks.invokeProviderLifecycleRun.mock.calls[0]?.[0];
    expect(invocation).toBeDefined();
    if (invocation === undefined) {
      return;
    }
    lifecycleMocks.exitHandler?.({
      runId: invocation.runId,
      providerId: 'cursor',
      action: 'logout',
      exitCode: 0,
      status: { id: 'cursor', binary: 'cursor-agent', available: true, version: '1', error: null },
      auth: { state: 'disconnected', identity: null },
    });

    expect((state.providerConnect as Record<string, unknown>).cursor).toEqual(IDLE_CONNECT);
  });
});
