import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';
import { cancelProviderConnect } from './cancelProviderConnect';
import { connectProvider } from './connectProvider';
import { INITIAL_CONNECT_MAP, INITIAL_LIFECYCLE_MAP, type ProviderConnectPhase } from './types';

const mocks = vi.hoisted(() => ({
  outputHandler: null as ((payload: unknown) => void) | null,
  exitHandler: null as ((payload: unknown) => void) | null,
  invokeProviderLifecycleRun: vi.fn(async (_params: { readonly runId: string }) => undefined),
  invokeProviderLifecycleCancel: vi.fn(async () => undefined),
  listenLifecycleOutput: vi.fn(async (handler: (payload: unknown) => void) => {
    mocks.outputHandler = handler;
    return vi.fn();
  }),
  listenLifecycleExit: vi.fn(async (handler: (payload: unknown) => void) => {
    mocks.exitHandler = handler;
    return vi.fn();
  }),
  openUrl: vi.fn(async () => undefined),
  checkProviderAuth: vi.fn(
    async (): Promise<{ state: string; identity: string | null }> => ({
      state: 'disconnected',
      identity: null,
    }),
  ),
}));

vi.mock('../../../features/providers/provider-lifecycle', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../features/providers/provider-lifecycle')>();
  return {
    ...actual,
    invokeProviderLifecycleRun: mocks.invokeProviderLifecycleRun,
    invokeProviderLifecycleCancel: mocks.invokeProviderLifecycleCancel,
    listenLifecycleOutput: mocks.listenLifecycleOutput,
    listenLifecycleExit: mocks.listenLifecycleExit,
  };
});

vi.mock('../../../features/providers/providers', () => ({
  checkProviderAuth: mocks.checkProviderAuth,
}));

vi.mock('../../../shared/lib/editor', () => ({ openUrl: mocks.openUrl }));

const AUTH_URL = 'https://claude.ai/oauth/authorize?code=1';

type Harness = {
  readonly phase: () => ProviderConnectPhase;
  readonly connect: (providerId: ProviderId) => Promise<void>;
  readonly cancel: (providerId: ProviderId) => Promise<void>;
  readonly emitOutput: (text: string) => void;
  readonly emitExit: (params: {
    readonly exitCode: number;
    readonly authState: string;
    readonly identity: string | null;
  }) => void;
  readonly identity: () => string | null;
  readonly errorTail: () => string | null;
};

const harness = ({ missing }: { readonly missing?: ProviderId } = {}): Harness => {
  let state: Record<string, unknown> = {
    providerConnect: { ...INITIAL_CONNECT_MAP },
    providerLifecycle: { ...INITIAL_LIFECYCLE_MAP },
    providers: PROVIDER_IDS.map((id) => ({
      id,
      connection: id === missing ? 'missing' : 'installed_disconnected',
    })),
    refreshProviders: vi.fn(async () => undefined),
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
  const entry = () =>
    (state.providerConnect as Record<string, Record<string, unknown>>).anthropic ?? {};
  return {
    phase: () => entry().phase as ProviderConnectPhase,
    identity: () => (entry().identity as string | null) ?? null,
    errorTail: () => (entry().errorTail as string | null) ?? null,
    connect: connectProvider(set as never, get as never),
    cancel: cancelProviderConnect(set as never, get as never),
    emitOutput: (text: string) => {
      mocks.outputHandler?.({
        runId: mocks.invokeProviderLifecycleRun.mock.calls.at(-1)?.[0]?.runId,
        data: btoa(text),
      });
    },
    emitExit: ({ exitCode, authState, identity }) => {
      mocks.exitHandler?.({
        runId: mocks.invokeProviderLifecycleRun.mock.calls.at(-1)?.[0]?.runId,
        exitCode,
        status: { id: 'anthropic', binary: 'claude', available: true, version: null, error: null },
        auth: { state: authState, identity },
      });
    },
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mocks.outputHandler = null;
  mocks.exitHandler = null;
  mocks.checkProviderAuth.mockResolvedValue({ state: 'disconnected', identity: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('connectProvider', () => {
  it('opens the detected auth url exactly once per run', async () => {
    const h = harness();
    await h.connect('anthropic');
    h.emitOutput(`visit ${AUTH_URL} to continue\n`);
    h.emitOutput(`still waiting, open ${AUTH_URL}\n`);
    expect(mocks.openUrl).toHaveBeenCalledTimes(1);
    expect(mocks.openUrl).toHaveBeenCalledWith(AUTH_URL);
    expect(h.phase()).toBe('handoff');
  });

  it('passes NO_OPEN_BROWSER to the cursor login so only goodboy opens the tab', async () => {
    const h = harness();
    await h.connect('cursor');
    expect(mocks.invokeProviderLifecycleRun).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'login', env: { NO_OPEN_BROWSER: '1' } }),
    );
  });

  it('never runs a login command for a manual-tier provider', async () => {
    const h = harness();
    await h.connect('gemini');
    expect(mocks.invokeProviderLifecycleRun).not.toHaveBeenCalled();
  });

  it('flags a stall after 15s of silence and rearms the timer on every output byte', async () => {
    const h = harness();
    await h.connect('anthropic');
    await vi.advanceTimersByTimeAsync(14_000);
    expect(h.phase()).toBe('working');
    h.emitOutput('pick an option: ');
    await vi.advanceTimersByTimeAsync(14_000);
    expect(h.phase()).toBe('working');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(h.phase()).toBe('stall');
  });

  it('does not arm the stall timer while the install step is running', async () => {
    const h = harness({ missing: 'anthropic' });
    void h.connect('anthropic');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.phase()).toBe('working');
    expect(mocks.invokeProviderLifecycleRun).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'install' }),
    );
  });

  it('escalates the handoff to waiting-long at 30s and fallback-offered at 120s', async () => {
    const h = harness();
    await h.connect('anthropic');
    h.emitOutput(`open ${AUTH_URL}\n`);
    await vi.advanceTimersByTimeAsync(31_000);
    expect(h.phase()).toBe('waiting-long');
    await vi.advanceTimersByTimeAsync(90_000);
    expect(h.phase()).toBe('fallback-offered');
  });

  it('lets the auth probe win over a nonzero exit code', async () => {
    const h = harness();
    await h.connect('anthropic');
    h.emitExit({ exitCode: 1, authState: 'connected', identity: 'a@b.com' });
    expect(h.phase()).toBe('success');
    expect(h.identity()).toBe('a@b.com');
  });

  it('reports a clean exit with no probe verdict as finished-unverified', async () => {
    const h = harness();
    await h.connect('anthropic');
    h.emitExit({ exitCode: 0, authState: 'unknown', identity: null });
    expect(h.phase()).toBe('finished-unverified');
  });

  it('carries the last meaningful output line when the run fails', async () => {
    const h = harness();
    await h.connect('anthropic');
    h.emitOutput('working\nbash: claude: command not found\n');
    h.emitExit({ exitCode: 127, authState: 'disconnected', identity: null });
    expect(h.phase()).toBe('failed');
    expect(h.errorTail()).toBe('bash: claude: command not found');
  });

  it('reaches success from the poll when the process stays alive', async () => {
    const h = harness();
    await h.connect('anthropic');
    h.emitOutput(`open ${AUTH_URL}\n`);
    mocks.checkProviderAuth.mockResolvedValue({ state: 'connected', identity: 'a@b.com' });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(h.phase()).toBe('success');
    expect(mocks.invokeProviderLifecycleCancel).toHaveBeenCalledTimes(1);
  });

  it('cancelling stops every timer the run owns', async () => {
    const h = harness();
    await h.connect('anthropic');
    h.emitOutput(`open ${AUTH_URL}\n`);
    await h.cancel('anthropic');
    expect(h.phase()).toBe('cancelled');
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(h.phase()).toBe('cancelled');
    expect(mocks.checkProviderAuth).not.toHaveBeenCalled();
  });
});
