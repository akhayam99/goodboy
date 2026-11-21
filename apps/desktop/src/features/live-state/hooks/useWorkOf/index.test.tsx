// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveWorkRow } from '../../readLiveWork';
import type { WorkChanged } from '../../listenWorkChanged';

type ReadFn = (params: { sessionId: string | null }) => Promise<unknown>;
type ChangeFn = (params: { change: WorkChanged }) => void;

const { state } = vi.hoisted(() => {
  const value: { read: ReadFn | null; onChange: ChangeFn | null } = { read: null, onChange: null };
  return { state: value };
});

vi.mock('../../readLiveWork', () => ({
  readLiveWork: (params: { sessionId: string | null }) => state.read?.(params),
}));
vi.mock('../../listenWorkChanged', () => ({
  listenWorkChanged: async ({ onChange }: { onChange: ChangeFn }) => {
    state.onChange = onChange;
    return () => {
      state.onChange = null;
    };
  },
}));

const { useWorkOf } = await import('./index');

const rowOf = (phraseCommand: string): LiveWorkRow => ({
  runId: 'run-1',
  sessionId: 'session-1',
  agentId: 'agent-1',
  mountId: null,
  workflowRunId: null,
  branch: null,
  startedAt: 1,
  quietMs: 0,
  tool: { name: 'Bash', command: phraseCommand, path: null },
  hasToolCall: true,
  canSeeTools: true,
});

const flush = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
};

describe('useWorkOf', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.onChange = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads once on mount and again when its session changes', async () => {
    const read = vi.fn(async () => [rowOf('pnpm test')]);
    state.read = read;
    const { result } = renderHook(() => useWorkOf({ sessionId: 'session-1' }));
    await flush();
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.work[0]?.phrase).toBe('Running pnpm test');
    const before = read.mock.calls.length;
    await act(async () => {
      state.onChange?.({ change: { sessionId: 'session-2', mountId: null } });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(read.mock.calls.length).toBe(before);
    await act(async () => {
      state.onChange?.({ change: { sessionId: 'session-1', mountId: null } });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(read.mock.calls.length).toBe(before + 1);
  });

  it('shows at most one phrase a second and the newest wins', async () => {
    let command = 'pnpm test';
    state.read = vi.fn(async () => [rowOf(command)]);
    const { result } = renderHook(() => useWorkOf({ sessionId: 'session-1' }));
    await flush();
    command = 'pnpm lint';
    await act(async () => {
      state.onChange?.({ change: { sessionId: 'session-1', mountId: null } });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.work[0]?.phrase).toBe('Running pnpm test');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.work[0]?.phrase).toBe('Running pnpm lint');
  });

  it('drops a late answer for an old request', async () => {
    const pending: Array<(rows: ReadonlyArray<LiveWorkRow>) => void> = [];
    state.read = vi.fn(
      () =>
        new Promise((resolve) => {
          pending.push(resolve);
        }),
    );
    const { result } = renderHook(() => useWorkOf({ sessionId: 'session-1' }));
    await flush();
    await act(async () => {
      state.onChange?.({ change: { sessionId: 'session-1', mountId: null } });
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      pending[1]?.([rowOf('pnpm lint')]);
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      pending[0]?.([rowOf('pnpm test')]);
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.work[0]?.phrase).toBe('Running pnpm lint');
  });

  it('keeps the old work and flags the failure when a read fails, then recovers', async () => {
    state.read = vi.fn(async () => [rowOf('pnpm test')]);
    const { result } = renderHook(() => useWorkOf({ sessionId: 'session-1' }));
    await flush();
    state.read = vi.fn(async () => {
      throw new Error('read failed');
    });
    await act(async () => {
      state.onChange?.({ change: { sessionId: 'session-1', mountId: null } });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.hasFailed).toBe(true);
    expect(result.current.work[0]?.phrase).toBe('Running pnpm test');
    state.read = vi.fn(async () => [rowOf('pnpm lint')]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.hasFailed).toBe(false);
    expect(result.current.work[0]?.phrase).toBe('Running pnpm lint');
  });

  it('keeps a newer failure visible when an older answer is still queued', async () => {
    state.read = vi.fn(async () => [rowOf('pnpm test')]);
    const { result } = renderHook(() => useWorkOf({ sessionId: 'session-1' }));
    await flush();
    state.read = vi.fn(async () => [rowOf('pnpm lint')]);
    await act(async () => {
      state.onChange?.({ change: { sessionId: 'session-1', mountId: null } });
      await vi.advanceTimersByTimeAsync(0);
    });
    state.read = vi.fn(async () => {
      throw new Error('read failed');
    });
    await act(async () => {
      state.onChange?.({ change: { sessionId: 'session-1', mountId: null } });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.hasFailed).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.hasFailed).toBe(true);
    expect(result.current.work[0]?.phrase).toBe('Running pnpm test');
  });
});
