// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, SessionId } from '@goodboy/types';
import type { ScriptRunRecord } from '../../../features/scripts/scripts';

const handlers = vi.hoisted(() => ({
  output: null as ((payload: { runId: string; data: string; offset: number }) => void) | null,
  exit: null as ((payload: { runId: string; exitCode: number }) => void) | null,
}));

vi.mock('../../../features/scripts/scripts', () => ({
  invokeScriptSnapshot: vi.fn(),
  listenScriptOutput: vi.fn(async (handler: typeof handlers.output) => {
    handlers.output = handler;
    return () => undefined;
  }),
  listenScriptExit: vi.fn(async (handler: typeof handlers.exit) => {
    handlers.exit = handler;
    return () => undefined;
  }),
}));

import { invokeScriptSnapshot } from '../../../features/scripts/scripts';
import { registerScriptRunListeners } from './registerScriptRunListeners';

const SESSION_ID = 'session-1' as SessionId;

type ScriptRunsState = {
  scriptRuns: Record<string, Record<string, ScriptRunRecord>>;
};

const makeStore = () => {
  let state: ScriptRunsState = {
    scriptRuns: {
      [SESSION_ID]: { lint: { status: 'pending', result: null, runId: 'run-1', startedAt: 1 } },
    },
  };
  const set = (update: (current: ScriptRunsState) => Partial<ScriptRunsState>) => {
    state = { ...state, ...update(state) };
  };
  const get = () => state;
  return {
    params: { set: set as never, get: get as never },
    read: () => state.scriptRuns[SESSION_ID]?.lint,
  };
};

type BytesParams = {
  readonly bytes: ReadonlyArray<number>;
};

const base64Of = ({ bytes }: BytesParams): string => btoa(String.fromCharCode(...bytes));

type TextParams = {
  readonly text: string;
};

const utf8Of = ({ text }: TextParams): ReadonlyArray<number> => [...new TextEncoder().encode(text)];

const register = async (
  store: ReturnType<typeof makeStore>,
  extra: { shouldReplay?: boolean } = {},
) =>
  registerScriptRunListeners({
    ...store.params,
    sessionId: SESSION_ID,
    scriptId: 'lint',
    runId: 'run-1',
    startedAt: 1,
    ...extra,
  });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('registerScriptRunListeners', () => {
  it('writes the running output into the record before the script exits', async () => {
    const store = makeStore();
    await registerScriptRunListeners({
      ...store.params,
      sessionId: SESSION_ID,
      scriptId: 'lint',
      runId: 'run-1',
      startedAt: 1,
    });

    handlers.output?.({ runId: 'run-1', data: btoa('checking 12 files\n'), offset: 0 });
    expect(store.read()?.output).toBeUndefined();
    vi.advanceTimersByTime(100);
    expect(store.read()?.output).toBe('checking 12 files\n');

    handlers.output?.({ runId: 'run-1', data: btoa('2 warnings\n'), offset: 18 });
    vi.advanceTimersByTime(100);
    expect(store.read()?.output).toBe('checking 12 files\n2 warnings\n');

    handlers.exit?.({ runId: 'run-1', exitCode: 1 });
    expect(store.read()?.status).toBe('error');
    expect(store.read()?.result?.exitCode).toBe(1);
    expect(store.read()?.result?.stdout).toBe('checking 12 files\n2 warnings\n');
  });

  it('keeps the mount and stamps when the run finished, for the drawer and the row', async () => {
    const store = makeStore();
    vi.setSystemTime(12_000);
    await registerScriptRunListeners({
      ...store.params,
      sessionId: SESSION_ID,
      scriptId: 'lint',
      runId: 'run-1',
      startedAt: 1,
      mountId: 'mount-ledger' as MountId,
    });

    handlers.exit?.({ runId: 'run-1', exitCode: 0 });

    expect(store.read()).toMatchObject({
      status: 'ok',
      mountId: 'mount-ledger',
      completedAt: 12_000,
    });
  });

  it('starts from the snapshot and writes each later byte once', async () => {
    const store = makeStore();
    let release: (value: { data: string; offset: number; exitCode: number | null }) => void = () =>
      undefined;
    vi.mocked(invokeScriptSnapshot).mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const registered = registerScriptRunListeners({
      ...store.params,
      sessionId: SESSION_ID,
      scriptId: 'lint',
      runId: 'run-1',
      startedAt: 1,
      shouldReplay: true,
    });
    await vi.advanceTimersByTimeAsync(0);

    handlers.output?.({ runId: 'run-1', data: btoa('two\n'), offset: 4 });
    handlers.output?.({ runId: 'run-1', data: btoa('three\n'), offset: 8 });
    release({ data: btoa('one\ntwo\n'), offset: 0, exitCode: null });
    await registered;
    vi.advanceTimersByTime(100);

    expect(store.read()?.output).toBe('one\ntwo\nthree\n');
  });

  it('keeps an exit that lands while the snapshot is in flight until the replay is written', async () => {
    const store = makeStore();
    vi.mocked(invokeScriptSnapshot).mockResolvedValueOnce({
      data: btoa('built\n'),
      offset: 0,
      exitCode: null,
    });
    await registerScriptRunListeners({
      ...store.params,
      sessionId: SESSION_ID,
      scriptId: 'lint',
      runId: 'run-1',
      startedAt: 1,
      shouldReplay: true,
    });

    handlers.exit?.({ runId: 'run-1', exitCode: 0 });

    expect(store.read()?.status).toBe('ok');
    expect(store.read()?.result?.stdout).toBe('built\n');
  });
});

describe('registerScriptRunListeners, UTF-8 output', () => {
  it('decodes a check mark that is split across two chunks', async () => {
    const store = makeStore();
    await register(store);
    const bytes = utf8Of({ text: '✓ 3 passed\n' });

    handlers.output?.({ runId: 'run-1', data: base64Of({ bytes: bytes.slice(0, 2) }), offset: 0 });
    handlers.output?.({ runId: 'run-1', data: base64Of({ bytes: bytes.slice(2) }), offset: 2 });
    vi.advanceTimersByTime(100);
    expect(store.read()?.output).toBe('✓ 3 passed\n');

    handlers.exit?.({ runId: 'run-1', exitCode: 0 });
    expect(store.read()?.result?.stdout).toBe('✓ 3 passed\n');
  });

  it('keeps accents and emoji whole when they sit inside one chunk', async () => {
    const store = makeStore();
    await register(store);

    handlers.output?.({
      runId: 'run-1',
      data: base64Of({ bytes: utf8Of({ text: 'città, 12 file 🎉\n' }) }),
      offset: 0,
    });
    vi.advanceTimersByTime(100);

    expect(store.read()?.output).toBe('città, 12 file 🎉\n');
  });

  it('cuts the overlap with the snapshot on bytes, never on decoded characters', async () => {
    const store = makeStore();
    const snapshot = utf8Of({ text: 'ok ✓\n' });
    vi.mocked(invokeScriptSnapshot).mockResolvedValueOnce({
      data: base64Of({ bytes: snapshot }),
      offset: 0,
      exitCode: null,
    });
    const registered = register(store, { shouldReplay: true });
    await vi.advanceTimersByTimeAsync(0);

    handlers.output?.({
      runId: 'run-1',
      data: base64Of({ bytes: utf8Of({ text: '✓\nnext ✓\n' }) }),
      offset: 3,
    });
    await registered;
    vi.advanceTimersByTime(100);

    expect(store.read()?.output).toBe('ok ✓\nnext ✓\n');
  });

  it('joins a character the snapshot ends in the middle of with the byte that follows', async () => {
    const store = makeStore();
    const check = utf8Of({ text: '✓' });
    vi.mocked(invokeScriptSnapshot).mockResolvedValueOnce({
      data: base64Of({ bytes: [97, ...check.slice(0, 2)] }),
      offset: 0,
      exitCode: null,
    });
    await register(store, { shouldReplay: true });

    handlers.output?.({
      runId: 'run-1',
      data: base64Of({ bytes: [...check.slice(2), 98] }),
      offset: 3,
    });
    vi.advanceTimersByTime(100);

    expect(store.read()?.output).toBe('a✓b');
  });

  it('turns a character cut off by the exit into one replacement mark, not garbage', async () => {
    const store = makeStore();
    await register(store);
    const check = utf8Of({ text: '✓' });

    handlers.output?.({
      runId: 'run-1',
      data: base64Of({ bytes: [97, ...check.slice(0, 2)] }),
      offset: 0,
    });
    handlers.exit?.({ runId: 'run-1', exitCode: 1 });

    expect(store.read()?.result?.stdout).toBe('a\uFFFD');
  });
});
