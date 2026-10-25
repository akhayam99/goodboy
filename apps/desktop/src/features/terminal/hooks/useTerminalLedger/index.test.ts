// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTerminalLedger } from './index';

const { listLive } = vi.hoisted(() => ({
  listLive: vi.fn(async () => [
    { id: 'term-1', pid: 10, foregroundPid: 11, foregroundCommand: 'pnpm test --watch' },
    { id: 'term-2', pid: 20, foregroundPid: 20, foregroundCommand: null },
    { id: 'term-3', pid: 30, foregroundPid: 31, foregroundCommand: null },
  ]),
}));

vi.mock('../../terminal', () => ({ invokeTerminalListLive: listLive }));

let visibility: DocumentVisibilityState = 'visible';

const setVisibility = ({ state }: { readonly state: DocumentVisibilityState }): void => {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
};

const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  listLive.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useTerminalLedger', () => {
  it('marks the terminals whose shell runs a foreground job as busy', async () => {
    const { result } = renderHook(() => useTerminalLedger({ isEnabled: true }));
    await advance(0);
    expect([...result.current.busy]).toEqual(['term-1', 'term-3']);
  });

  it('names the foreground process of a busy terminal and leaves the others without a label', async () => {
    const { result } = renderHook(() => useTerminalLedger({ isEnabled: true }));
    await advance(0);
    expect([...result.current.commands]).toEqual([['term-1', 'pnpm test --watch']]);
  });

  it('polls every two seconds while the window is visible', async () => {
    renderHook(() => useTerminalLedger({ isEnabled: true }));
    await advance(0);
    await advance(4000);
    expect(listLive).toHaveBeenCalledTimes(3);
  });

  it('asks nothing while the window is hidden and reads again when it returns', async () => {
    renderHook(() => useTerminalLedger({ isEnabled: true }));
    await advance(0);
    listLive.mockClear();
    setVisibility({ state: 'hidden' });
    await advance(10_000);
    expect(listLive).not.toHaveBeenCalled();
    setVisibility({ state: 'visible' });
    await advance(0);
    expect(listLive).toHaveBeenCalledTimes(1);
  });

  it('asks nothing while it is disabled', async () => {
    renderHook(() => useTerminalLedger({ isEnabled: false }));
    await advance(10_000);
    expect(listLive).not.toHaveBeenCalled();
  });
});
