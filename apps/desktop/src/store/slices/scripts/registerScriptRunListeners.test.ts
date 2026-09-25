import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, SessionId } from '@goodboy/types';
import type { ScriptRunRecord } from '../../../features/scripts/scripts';

const handlers = vi.hoisted(() => ({
  output: null as ((payload: { runId: string; data: string }) => void) | null,
  exit: null as ((payload: { runId: string; exitCode: number }) => void) | null,
}));

vi.mock('../../../features/scripts/scripts', () => ({
  listenScriptOutput: vi.fn(async (handler: typeof handlers.output) => {
    handlers.output = handler;
    return () => undefined;
  }),
  listenScriptExit: vi.fn(async (handler: typeof handlers.exit) => {
    handlers.exit = handler;
    return () => undefined;
  }),
}));

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
  return { set, get, read: () => state.scriptRuns[SESSION_ID]?.lint };
};

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
      set: store.set as never,
      get: store.get as never,
      sessionId: SESSION_ID,
      scriptId: 'lint',
      runId: 'run-1',
      startedAt: 1,
    });

    handlers.output?.({ runId: 'run-1', data: btoa('checking 12 files\n') });
    expect(store.read()?.output).toBeUndefined();
    vi.advanceTimersByTime(100);
    expect(store.read()?.output).toBe('checking 12 files\n');

    handlers.output?.({ runId: 'run-1', data: btoa('2 warnings\n') });
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
      set: store.set as never,
      get: store.get as never,
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
});
