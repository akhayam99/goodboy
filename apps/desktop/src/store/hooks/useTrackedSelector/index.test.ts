import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { useShallow } from 'zustand/react/shallow';
import { createTrackedStore } from '../../createTrackedStore';

type Counter = {
  readonly hot: number;
  readonly cold: number;
  readonly other: number;
};

const setup = () => {
  const api = createStore<Counter>(() => ({ hot: 0, cold: 0, other: 0 }));
  return { api, useStore: createTrackedStore({ api }) };
};

describe('useTrackedSelector', () => {
  it('skips a selector whose read keys did not change', () => {
    const { api, useStore } = setup();
    let runs = 0;
    const { result } = renderHook(() =>
      useStore((state) => {
        runs += 1;
        return state.cold;
      }),
    );
    const before = runs;

    act(() => api.setState({ hot: 1 }));

    expect(runs).toBe(before);
    expect(result.current).toBe(0);
  });

  it('runs a selector again when a key it read changed', () => {
    const { api, useStore } = setup();
    const { result } = renderHook(() => useStore((state) => state.hot));

    act(() => api.setState({ hot: 4 }));

    expect(result.current).toBe(4);
  });

  it('always runs a selector that enumerates the state', () => {
    const { api, useStore } = setup();
    const { result } = renderHook(() => useStore((state) => Object.keys(state).length));
    const { result: whole } = renderHook(() => useStore((state) => state));

    act(() => api.setState({ other: 2 }));

    expect(result.current).toBe(3);
    expect(whole.current.other).toBe(2);
  });

  it('follows a selector that changes between renders', () => {
    const { api, useStore } = setup();
    const { result, rerender } = renderHook(
      ({ key }: { readonly key: 'hot' | 'cold' }) => useStore((state) => state[key]),
      { initialProps: { key: 'hot' } },
    );
    act(() => api.setState({ hot: 1, cold: 9 }));
    expect(result.current).toBe(1);

    rerender({ key: 'cold' });

    expect(result.current).toBe(9);
  });

  it('keeps a shallow selector stable across a skipped write', () => {
    const { api, useStore } = setup();
    const { result } = renderHook(() => useStore(useShallow((state) => ({ cold: state.cold }))));
    const first = result.current;

    act(() => api.setState({ hot: 1 }));

    expect(result.current).toBe(first);
  });
});
