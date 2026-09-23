// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { Session, SessionProjectMount, TelemetryRecord } from '@goodboy/types';

vi.mock('../../store/store', async () => {
  const zustand = await import('zustand');
  return {
    useAppStore: zustand.create(() => ({
      selectedProjectIds: {},
      getSelectedProjectIds: () => undefined,
      sessionProjectMounts: {},
      sessionTelemetry: {},
      scriptRuns: {},
      sessions: [],
      archivedSessions: {},
      projectScripts: {},
    })),
  };
});

import { useAppStore } from '../../store/store';
import { useProjectFilteredSessions, useTelemetryForSessions } from '../../store/selectors';
import { useRunningScripts } from '../../features/scripts/components/RunningScriptsIndicator/useRunningScripts';

const viewSession = { id: 'session-in-view' } as Session;
const mount = { projectId: 'project-ledger' } as SessionProjectMount;
const scriptSession = {
  id: 'session-in-view',
  goal: 'Ship ledger-core',
  workspaceId: 'workspace-acme',
} as Session;
const record = { kind: 'turn', estimatedCostUsd: 0.4 } as TelemetryRecord;

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

  it('writing telemetry of a session out of view does not re-render spend or the rollup', () => {
    useAppStore.setState({ sessionTelemetry: { [viewSession.id]: [record] } });
    const sessions = [viewSession];
    const { counter, result } = renderCounted({
      hook: () => useTelemetryForSessions({ sessions }),
    });
    const first = result.current;
    const before = counter.renders;

    act(() =>
      useAppStore.setState((state) => ({
        sessionTelemetry: { ...state.sessionTelemetry, 'session-elsewhere': [record] },
      })),
    );
    expect(counter.renders).toBe(before);
    expect(result.current).toBe(first);
  });

  it('streaming script output does not re-render the top bar running scripts', () => {
    const pending = { status: 'pending', result: null, runId: 'run-1', startedAt: 10 } as const;
    useAppStore.setState({
      sessions: [scriptSession],
      scriptRuns: { [viewSession.id]: { 'script-test': pending } },
    });
    const { counter, result } = renderCounted({ hook: () => useRunningScripts() });
    const first = result.current;
    const before = counter.renders;
    expect(first).toEqual([expect.objectContaining({ scriptId: 'script-test', startedAt: 10 })]);

    act(() =>
      useAppStore.setState({
        scriptRuns: { [viewSession.id]: { 'script-test': { ...pending, output: 'line 1' } } },
      }),
    );
    expect(counter.renders).toBe(before);
    expect(result.current).toBe(first);

    act(() =>
      useAppStore.setState({
        scriptRuns: {
          [viewSession.id]: {
            'script-test': { status: 'ok', result: null, runId: 'run-1', startedAt: 10 },
          },
        },
      }),
    );
    expect(result.current).toEqual([]);
  });
});
