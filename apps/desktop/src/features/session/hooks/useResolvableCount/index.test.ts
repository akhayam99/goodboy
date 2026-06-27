import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';

type StoreState = Record<string, unknown>;

const { store } = vi.hoisted(() => {
  const store: { state: StoreState } = { state: {} };
  return { store };
});

vi.mock('../../../../store', () => ({
  useAppStore: Object.assign((selector: (s: StoreState) => unknown) => selector(store.state), {
    getState: () => store.state,
  }),
}));

import { useResolvableCount } from './index';

const SID = 'sess-1' as SessionId;

beforeEach(() => {
  store.state = {
    sessionGithub: {},
    diffComments: {},
    sessionPendingResolutions: {},
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useResolvableCount', () => {
  it('nothing loaded -> all counts are zero', () => {
    const { result } = renderHook(() => useResolvableCount(SID));
    expect(result.current).toEqual({ prComments: 0, diffComments: 0, pending: 0 });
  });

  it('counts unresolved review comments from loaded PR detail', () => {
    store.state = {
      ...store.state,
      sessionGithub: {
        [SID]: {
          detail: {
            comments: [
              { source: 'review', resolved: false },
              { source: 'review', resolved: false },
              { source: 'review', resolved: true },
              { source: 'issue', resolved: false },
            ],
          },
        },
      },
    };
    const { result } = renderHook(() => useResolvableCount(SID));
    expect(result.current.prComments).toBe(2);
    expect(result.current.diffComments).toBe(0);
    expect(result.current.pending).toBe(0);
  });

  it('counts open diff comments', () => {
    store.state = {
      ...store.state,
      diffComments: {
        [SID]: [{ status: 'open' }, { status: 'open' }, { status: 'resolved' }],
      },
    };
    const { result } = renderHook(() => useResolvableCount(SID));
    expect(result.current.diffComments).toBe(2);
    expect(result.current.prComments).toBe(0);
  });

  it('reports the pending batch length', () => {
    store.state = {
      ...store.state,
      sessionPendingResolutions: { [SID]: [{}, {}, {}] },
    };
    const { result } = renderHook(() => useResolvableCount(SID));
    expect(result.current.pending).toBe(3);
    expect(result.current.prComments).toBe(0);
    expect(result.current.diffComments).toBe(0);
  });
});
