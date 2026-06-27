import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';

type StoreState = Record<string, unknown>;

const { store } = vi.hoisted(() => {
  const store: { state: StoreState } = { state: {} };
  return { store };
});

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: Object.assign((selector: (s: StoreState) => unknown) => selector(store.state), {
    getState: () => store.state,
  }),
}));

import { useResolvableCount } from './index';

const SID = 'sess-1' as SessionId;

const makeAgent = (over: Record<string, unknown> = {}) => ({
  id: 'a',
  parentAgentId: null,
  workflowRunId: null,
  sourceThreadId: null,
  status: 'running',
  ...over,
});

beforeEach(() => {
  store.state = {
    sessionGithub: {},
    sessionGitlabMr: {},
    diffComments: {},
    sessionPendingResolutions: {},
    sessionPhaseRuns: {},
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useResolvableCount', () => {
  it('no PR, no resolvers, nothing loaded -> disabled with "No pull request yet" and total 0', () => {
    const { result } = renderHook(() => useResolvableCount(SID));
    expect(result.current.enabled).toBe(false);
    expect(result.current.disabledReason).toBe('No pull request yet');
    expect(result.current.total).toBe(0);
  });

  it('PR present but detail not loaded -> enabled (proxy), no disabledReason', () => {
    store.state = {
      ...store.state,
      sessionGithub: { [SID]: { pr: { number: 1 }, detail: null } },
    };
    const { result } = renderHook(() => useResolvableCount(SID));
    expect(result.current.enabled).toBe(true);
    expect(result.current.disabledReason).toBeNull();
  });

  it('PR present, detail loaded with zero unresolved review comments -> disabled with "No comments in the PR"', () => {
    store.state = {
      ...store.state,
      sessionGithub: {
        [SID]: {
          pr: { number: 1 },
          detail: {
            comments: [
              { source: 'review', resolved: true },
              { source: 'issue', resolved: false },
            ],
          },
        },
      },
    };
    const { result } = renderHook(() => useResolvableCount(SID));
    expect(result.current.enabled).toBe(false);
    expect(result.current.disabledReason).toBe('No comments in the PR');
    expect(result.current.total).toBe(0);
  });

  it('PR present, detail loaded with one unresolved review comment -> enabled, total >= 1', () => {
    store.state = {
      ...store.state,
      sessionGithub: {
        [SID]: {
          pr: { number: 1 },
          detail: {
            comments: [{ source: 'review', resolved: false }],
          },
        },
      },
    };
    const { result } = renderHook(() => useResolvableCount(SID));
    expect(result.current.enabled).toBe(true);
    expect(result.current.total).toBeGreaterThanOrEqual(1);
  });

  it('standalone resolver agent present -> enabled, total >= 1', () => {
    store.state = {
      ...store.state,
      sessionPhaseRuns: {
        [SID]: [makeAgent({ sourceThreadId: 'thread-123' })],
      },
    };
    const { result } = renderHook(() => useResolvableCount(SID));
    expect(result.current.enabled).toBe(true);
    expect(result.current.total).toBeGreaterThanOrEqual(1);
  });

  it('diff loaded with zero open comments and no PR -> "No pull request yet"', () => {
    store.state = {
      ...store.state,
      diffComments: { [SID]: [{ status: 'resolved' }, { status: 'consumed' }] },
    };
    const { result } = renderHook(() => useResolvableCount(SID));
    expect(result.current.enabled).toBe(false);
    expect(result.current.disabledReason).toBe('No pull request yet');
  });
});
