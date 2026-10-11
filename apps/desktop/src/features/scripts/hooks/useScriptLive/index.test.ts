// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
} from '../../../../store/storyHarness';
import type { ScriptRunRecord } from '../../scripts';
import { useScriptLive } from '.';

const POLL_MS = 5000;

const PENDING: ScriptRunRecord = {
  status: 'pending',
  result: null,
  runId: 'run-dev',
  startedAt: 1_000,
};

const SNAPSHOT = {
  takenAt: 1_000,
  isPlatformSupported: true,
  processes: [],
  listeners: [],
};

type RunsParams = {
  readonly runs: Readonly<Record<string, ScriptRunRecord>>;
};

const FINISHED: ScriptRunRecord = { ...PENDING, status: 'ok' };

const liveCalls = (): number =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'workspace_script_list_live')
    .length;

type StubParams = {
  readonly isStarted: () => boolean;
};

const stubLive = ({ isStarted }: StubParams) =>
  stubStoryInvoke({
    monitor_watched_ports: [],
    monitor_snapshot: SNAPSHOT,
    process_ledger_list: [],
    workspace_script_list_live: () =>
      isStarted()
        ? [
            {
              runId: 'run-dev',
              scriptId: 'dev',
              name: 'dev',
              sessionId: 'session-1',
              pid: 4242,
              startedAt: 1_000,
            },
          ]
        : [],
  });

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useScriptLive pid discovery', () => {
  it('keeps looking while a run is pending and finds the pid once the process exists', async () => {
    let isStarted = false;
    stubLive({ isStarted: () => isStarted });
    const { result } = renderHook(() => useScriptLive({ runs: { dev: PENDING } }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(liveCalls()).toBe(1);
    expect(Object.keys(result.current.factsByRunId)).toEqual([]);

    isStarted = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });

    expect(liveCalls()).toBe(2);
    expect(Object.keys(result.current.factsByRunId)).toEqual(['run-dev']);
  });

  it('stops looking once every pending run has a pid', async () => {
    stubLive({ isStarted: () => true });
    renderHook(() => useScriptLive({ runs: { dev: PENDING } }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    });

    expect(liveCalls()).toBe(1);
  });

  it('stops looking when the run ends before a pid shows up', async () => {
    stubLive({ isStarted: () => false });
    const { rerender } = renderHook(({ runs }: RunsParams) => useScriptLive({ runs }), {
      initialProps: { runs: { dev: PENDING } },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const before = liveCalls();

    rerender({ runs: { dev: FINISHED } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    });

    expect(liveCalls()).toBe(before);
  });
});
