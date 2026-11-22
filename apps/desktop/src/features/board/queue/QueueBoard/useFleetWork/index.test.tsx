// @vitest-environment happy-dom

type ReadFn = () => Promise<ReadonlyArray<LiveWorkRow>>;
type ChangeFn = (params: { readonly change: WorkChanged }) => void;

const { state } = vi.hoisted(() => {
  const value: { read: ReadFn | null; onChange: ChangeFn | null } = { read: null, onChange: null };
  return { state: value };
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../../live-state/readLiveWork', () => ({
  readLiveWork: () => state.read?.() ?? Promise.resolve([]),
}));
vi.mock('../../../../live-state/listenWorkChanged', () => ({
  listenWorkChanged: async ({ onChange }: { readonly onChange: ChangeFn }) => {
    state.onChange = onChange;
    return () => {
      state.onChange = null;
    };
  },
}));

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import type { LiveWorkRow } from '../../../../live-state/readLiveWork';
import type { WorkChanged } from '../../../../live-state/listenWorkChanged';
import { FLEET_EVERY_MS, useFleetWork } from '.';

const SESSION = 'harborline-payouts';
const TITLES: ReadonlyMap<string, string> = new Map([[SESSION, 'Fix webhook retries']]);

const rowOf = (command: string): LiveWorkRow => ({
  runId: 'run-1',
  sessionId: SESSION,
  agentId: 'implementer-payments-api',
  mountId: null,
  workflowRunId: null,
  branch: null,
  startedAt: 1,
  quietMs: 0,
  tool: { name: 'Bash', command, path: null },
  hasToolCall: true,
  canSeeTools: true,
});

type Deferred = {
  readonly resolve: (rows: ReadonlyArray<LiveWorkRow>) => void;
  readonly reject: (error: Error) => void;
};

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const mount = () => renderHook(() => useFleetWork({ sessionTitles: TITLES }));

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers();
  state.onChange = null;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useFleetWork', () => {
  it('keeps the rows on a failed read and Retry brings the new rows back', async () => {
    state.read = async () => [rowOf('pnpm test')];
    const { result } = mount();
    await advance(0);
    expect(result.current.work[0]?.phrase).toBe('Running pnpm test');

    state.read = async () => {
      throw new Error('live work unavailable');
    };
    await advance(FLEET_EVERY_MS);
    expect(result.current.hasFailed).toBe(true);
    expect(result.current.work[0]?.phrase).toBe('Running pnpm test');

    state.read = async () => [rowOf('pnpm lint')];
    await act(async () => {
      result.current.retry();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.hasFailed).toBe(false);
    expect(result.current.work[0]?.phrase).toBe('Running pnpm lint');
  });

  it('drops an older read that settles after the Retry, a failure or rows alike', async () => {
    const pending: Array<Deferred> = [];
    state.read = () =>
      new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
      });
    const { result } = mount();
    await advance(0);
    await act(async () => {
      result.current.retry();
      result.current.retry();
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      pending[2]?.resolve([rowOf('pnpm lint')]);
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      pending[0]?.reject(new Error('live work unavailable'));
      pending[1]?.resolve([rowOf('pnpm test')]);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.hasFailed).toBe(false);
    expect(result.current.work[0]?.phrase).toBe('Running pnpm lint');
  });

  it('reads once per interval however many changes arrive, and skips other workspaces', async () => {
    const read = vi.fn(async () => [rowOf('pnpm test')]);
    state.read = read;
    mount();
    await advance(0);
    const afterMount = read.mock.calls.length;

    await act(async () => {
      state.onChange?.({ change: { sessionId: 'northwind-ledger', mountId: null } });
      for (let index = 0; index < 5; index += 1) {
        state.onChange?.({ change: { sessionId: SESSION, mountId: null } });
      }
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(read.mock.calls.length).toBe(afterMount);

    await advance(FLEET_EVERY_MS);
    expect(read.mock.calls.length).toBe(afterMount + 1);
  });
});
