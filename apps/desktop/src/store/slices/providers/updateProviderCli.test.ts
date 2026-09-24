import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_CONNECT_MAP, INITIAL_LIFECYCLE_MAP } from './types';
import { updateProviderCli } from './updateProviderCli';

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
  buildProviderList: vi.fn(() => []),
}));

vi.mock('../../../features/providers/provider-lifecycle', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../features/providers/provider-lifecycle')>();
  return { ...actual, ...lifecycleMocks };
});

type State = Record<string, unknown>;

const setup = () => {
  const emitNotification = vi.fn(async () => undefined);
  let state: State = {
    providerLifecycle: { ...INITIAL_LIFECYCLE_MAP },
    providerStatus: null,
    cursorStatus: null,
    codexStatus: null,
    geminiStatus: null,
    authResults: null,
    providers: [{ id: 'anthropic', version: '2.1.259 (Claude Code)' }],
    providerCredentials: [],
    providerConnect: { ...INITIAL_CONNECT_MAP },
    refreshProviders: vi.fn(async () => undefined),
    emitNotification,
  };
  const set = vi.fn((update: State | ((current: State) => State)) => {
    const patch = typeof update === 'function' ? update(state) : update;
    state = { ...state, ...patch };
  });
  const get = vi.fn(() => state);
  return { set, get, emitNotification, read: () => state };
};

type ExitParams = {
  readonly exitCode: number;
  readonly version: string;
};

const exit = ({ exitCode, version }: ExitParams) => {
  const invocation = lifecycleMocks.invokeProviderLifecycleRun.mock.calls[0]?.[0];
  lifecycleMocks.exitHandler?.({
    runId: invocation?.runId,
    providerId: 'anthropic',
    action: 'update',
    exitCode,
    status: { id: 'anthropic', binary: 'claude', available: true, version, error: null },
    auth: { state: 'connected', identity: null },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  lifecycleMocks.exitHandler = null;
});

describe('updateProviderCli', () => {
  it('runs claude update in the lifecycle PTY and logs the new version', async () => {
    const { set, get, emitNotification, read } = setup();
    await updateProviderCli(set as never, get as never)('anthropic');

    expect(lifecycleMocks.invokeProviderLifecycleRun).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'anthropic',
        action: 'update',
        command: 'claude update',
      }),
    );
    const lifecycle = read().providerLifecycle as typeof INITIAL_LIFECYCLE_MAP;
    expect(lifecycle.anthropic.phase).toBe('updating');

    exit({ exitCode: 0, version: '2.1.281 (Claude Code)' });

    const settled = read().providerLifecycle as typeof INITIAL_LIFECYCLE_MAP;
    expect(settled.anthropic.phase).toBe('installed');
    expect(emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'provider-cli-updated',
        severity: 'success',
        title: 'Claude CLI updated to 2.1.281',
        body: 'It was 2.1.259.',
      }),
    );
  });

  it('marks a failed update as an error and logs nothing', async () => {
    const { set, get, emitNotification, read } = setup();
    await updateProviderCli(set as never, get as never)('anthropic');
    exit({ exitCode: 1, version: '2.1.259 (Claude Code)' });

    const settled = read().providerLifecycle as typeof INITIAL_LIFECYCLE_MAP;
    expect(settled.anthropic.phase).toBe('error');
    expect(emitNotification).not.toHaveBeenCalled();
  });
});
