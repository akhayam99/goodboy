import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';

type StoreState = Record<string, unknown>;

const { store } = vi.hoisted(() => {
  const store: { state: StoreState } = { state: {} };
  return { store };
});

vi.mock('../../store', () => ({
  useAppStore: (selector: (state: StoreState) => unknown) => selector(store.state),
}));

import { useIsSessionCollectionLoaded } from './selectors';

const SESSION_ID = 'session-1' as SessionId;

beforeEach(() => {
  store.state = {};
});

describe('useIsSessionCollectionLoaded', () => {
  const COLLECTIONS = [
    ['agents', 'sessionPhaseRuns'],
    ['plans', 'sessionPlans'],
    ['workflows', 'sessionWorkflows'],
    ['reviewDrafts', 'reviewDrafts'],
    ['externalTasks', 'sessionExternalTasks'],
    ['openQuestions', 'sessionOpenQuestions'],
    ['fileVersions', 'sessionFileVersions'],
  ] as const;

  it.each(COLLECTIONS)(
    'reads %s as never loaded while its record has no key',
    (collection, key) => {
      store.state[key] = {};

      const { result } = renderHook(() =>
        useIsSessionCollectionLoaded({ sessionId: SESSION_ID, collection }),
      );

      expect(result.current).toBe(false);
    },
  );

  it.each(COLLECTIONS)('reads %s as loaded once its key holds an empty list', (collection, key) => {
    store.state[key] = { [SESSION_ID]: [] };

    const { result } = renderHook(() =>
      useIsSessionCollectionLoaded({ sessionId: SESSION_ID, collection }),
    );

    expect(result.current).toBe(true);
  });

  it('never reads one session as loaded because a sibling loaded', () => {
    store.state.sessionWorkflows = { 'session-2': [] };

    const { result } = renderHook(() =>
      useIsSessionCollectionLoaded({ sessionId: SESSION_ID, collection: 'workflows' }),
    );

    expect(result.current).toBe(false);
  });
});
