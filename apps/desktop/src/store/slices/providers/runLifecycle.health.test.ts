// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_CONNECT_MAP, INITIAL_LIFECYCLE_MAP } from './types';
import { INITIAL_HEALTH, INITIAL_HEALTH_MAP, reduceProviderHealth } from './providerHealth';
import { runLifecycle } from './runLifecycle';

const lifecycleMocks = vi.hoisted(() => ({
  exitHandler: null as ((payload: unknown) => void) | null,
  invokeProviderLifecycleRun: vi.fn(async (_params: { readonly runId: string }) => undefined),
  listenLifecycleOutput: vi.fn(async () => vi.fn()),
  listenLifecycleExit: vi.fn(async (handler: (payload: unknown) => void) => {
    lifecycleMocks.exitHandler = handler;
    return vi.fn();
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }));

vi.mock('../../../features/providers/provider-lifecycle', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../features/providers/provider-lifecycle')>();
  return { ...actual, ...lifecycleMocks };
});

const GOOD_PROBE_AT = 1_000_000;

const goodCursor = () =>
  reduceProviderHealth({
    health: INITIAL_HEALTH,
    action: {
      type: 'probe',
      at: GOOD_PROBE_AT,
      outcome: { kind: 'good', localTokens: true, serverAccepted: true, identity: null },
    },
  }).health;

const harness = () => {
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
    providerHealth: { ...INITIAL_HEALTH_MAP, cursor: goodCursor() },
    providerProbeSeq: 0,
    refreshProviders: vi.fn(async () => undefined),
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
  return { set, get, read: () => state };
};

const cursorStatus = {
  id: 'cursor',
  binary: 'cursor-agent',
  available: true,
  version: '1.0.0',
  error: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  lifecycleMocks.exitHandler = null;
});

describe('a lifecycle exit', () => {
  it('signs a provider out at once after a Goodboy sign-out, without waiting for a second answer', async () => {
    const { set, get, read } = harness();
    await runLifecycle(set as never, get as never, { providerId: 'cursor', action: 'logout' });
    const invocation = lifecycleMocks.invokeProviderLifecycleRun.mock.calls[0]?.[0];
    lifecycleMocks.exitHandler?.({
      runId: invocation?.runId,
      providerId: 'cursor',
      action: 'logout',
      exitCode: 0,
      status: cursorStatus,
      auth: { state: 'disconnected', identity: null },
    });
    const health = read().providerHealth as typeof INITIAL_HEALTH_MAP;
    expect(health.cursor.standing).toBe('signed_out');
    expect(health.anthropic.standing).toBe('unknown');
  });

  it('asks for a fresh probe set once the run is over', async () => {
    const { set, get, read } = harness();
    await runLifecycle(set as never, get as never, { providerId: 'cursor', action: 'logout' });
    const invocation = lifecycleMocks.invokeProviderLifecycleRun.mock.calls[0]?.[0];
    lifecycleMocks.exitHandler?.({
      runId: invocation?.runId,
      providerId: 'cursor',
      action: 'logout',
      exitCode: 0,
      status: cursorStatus,
      auth: { state: 'disconnected', identity: null },
    });
    expect(read().refreshProviders).toHaveBeenCalledWith({ isFresh: true });
  });
});
