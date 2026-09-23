// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { Session, SessionProjectMount } from '@goodboy/types';

vi.mock('../../store/store', async () => {
  const zustand = await import('zustand');
  return {
    useAppStore: zustand.create(() => ({
      selectedProjectIds: {},
      getSelectedProjectIds: () => undefined,
      sessionProjectMounts: {},
    })),
  };
});

import { useAppStore } from '../../store/store';
import { useProjectFilteredSessions } from '../../store/selectors';

const viewSession = { id: 'session-in-view' } as Session;
const mount = { projectId: 'project-ledger' } as SessionProjectMount;

type CountedParams<T> = {
  readonly hook: () => T;
};

const renderCounted = <T,>({ hook }: CountedParams<T>) => {
  const counter = { renders: 0 };
  const rendered = renderHook(() => {
    counter.renders += 1;
    return hook();
  });
  return { ...rendered, counter };
};

type TestState = {
  providers: ReadonlyArray<{ id: string; connection: string }>;
  integrations: Readonly<Record<string, ReadonlyArray<string>>>;
  filler: number;
};

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

describe('whole-map store keys stay out of consumers that render a few sessions', () => {
  it('writing mounts of a session out of view does not re-render the project filter', () => {
    useAppStore.setState({ sessionProjectMounts: { [viewSession.id]: [mount] } });
    const sessions = [viewSession];
    const { counter, result } = renderCounted({
      hook: () => useProjectFilteredSessions({ workspaceId: null, sessions }),
    });
    const first = result.current;
    const before = counter.renders;

    act(() =>
      useAppStore.setState((state) => ({
        sessionProjectMounts: { ...state.sessionProjectMounts, 'session-elsewhere': [mount] },
      })),
    );
    expect(counter.renders).toBe(before);
    expect(result.current).toBe(first);

    act(() =>
      useAppStore.setState((state) => ({
        sessionProjectMounts: { ...state.sessionProjectMounts, [viewSession.id]: [] },
      })),
    );
    expect(counter.renders).toBeGreaterThan(before);
  });
});
