// @vitest-environment happy-dom

/**
 * Regression: opening WorkspaceSettingsDialog / SessionSettingsDialog /
 * ConnectLinearDialog crashed with "Maximum update depth exceeded"
 * (React #185) because they had useAppStore selectors that built a fresh
 * non-primitive each call:
 *
 *     useAppStore((s) => s.providers.filter(...).map(...))
 *     useAppStore((s) => s.workspaceIntegrations[id] ?? [])
 *
 * React 19's useSyncExternalStore compares snapshots via Object.is. A fresh
 * array always fails that check, the snapshot mismatch retriggers the
 * render, and the next render computes yet another fresh ref. Infinite loop,
 * error boundary catches it as React #185, user sees "something went wrong".
 *
 * Fix: wrap the offending selector in `useShallow` from
 * `zustand/react/shallow`. This file pins the contract: the wrapped pattern
 * returns a stable ref across unrelated store updates, the raw pattern does
 * not. If anyone removes useShallow from one of those dialogs the
 * `no-unstable-zustand-selectors` source scan below catches it; if the
 * underlying assumption about useShallow ever changes the hook tests here
 * catch that too.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { act, cleanup, renderHook } from '@testing-library/react';

interface TestState {
  providers: ReadonlyArray<{ id: string; connection: string }>;
  integrations: Readonly<Record<string, ReadonlyArray<string>>>;
  filler: number;
}

afterEach(cleanup);

function makeStore() {
  return create<TestState>(() => ({
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'cursor', connection: 'missing' },
    ],
    integrations: {},
    filler: 0,
  }));
}

describe('useShallow keeps filter/map selectors stable', () => {
  it('returns the same ref when an unrelated store key changes', () => {
    const useStore = makeStore();
    const { result, rerender } = renderHook(() =>
      useStore(
        useShallow((s) => s.providers.filter((p) => p.connection === 'connected').map((p) => p.id)),
      ),
    );
    const first = result.current;
    expect(first).toEqual(['anthropic']);

    act(() => useStore.setState({ filler: 1 }));
    rerender();
    expect(result.current).toBe(first);
  });

  it('returns a new ref when the derived list actually changes', () => {
    const useStore = makeStore();
    const { result, rerender } = renderHook(() =>
      useStore(
        useShallow((s) => s.providers.filter((p) => p.connection === 'connected').map((p) => p.id)),
      ),
    );
    const first = result.current;

    act(() =>
      useStore.setState({
        providers: [
          { id: 'anthropic', connection: 'connected' },
          { id: 'cursor', connection: 'connected' },
        ],
      }),
    );
    rerender();
    expect(result.current).not.toBe(first);
    expect(result.current).toEqual(['anthropic', 'cursor']);
  });
});

describe('useShallow keeps `?? []` selectors stable', () => {
  it('returns the same ref across unrelated store updates when the key is missing', () => {
    const useStore = makeStore();
    const { result, rerender } = renderHook(() =>
      useStore(useShallow((s) => s.integrations['ws-1'] ?? [])),
    );
    const first = result.current;
    expect(first).toEqual([]);

    act(() => useStore.setState({ filler: 1 }));
    rerender();
    expect(result.current).toBe(first);
  });
});

describe('without useShallow these selectors are unstable', () => {
  it('filter().map() returns a brand new array on every call (documents the bug)', () => {
    const useStore = makeStore();
    const select = (s: TestState) =>
      s.providers.filter((p) => p.connection === 'connected').map((p) => p.id);
    const a = select(useStore.getState());
    const b = select(useStore.getState());
    expect(a).toEqual(b);
    expect(Object.is(a, b)).toBe(false);
  });

  it('`?? []` returns a brand new array on every missing-key lookup (documents the bug)', () => {
    const useStore = makeStore();
    const select = (s: TestState) => s.integrations['missing-key'] ?? [];
    const a = select(useStore.getState());
    const b = select(useStore.getState());
    expect(Object.is(a, b)).toBe(false);
  });
});
