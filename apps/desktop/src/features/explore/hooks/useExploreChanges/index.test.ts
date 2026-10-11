// @vitest-environment happy-dom

const h = vi.hoisted(() => ({
  invoke: vi.fn<(command: string, args?: Record<string, unknown>) => Promise<unknown>>(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SESSION, mountFixture } from '../../../../__tests__/helpers/actionFixtures';
import { useMountDiffStats } from '../../../../store/slices/project-mounts/useMountDiffStats';
import { useExploreChanges } from '.';

let useAppStore: StoryStore;

const DIR = '/workspace/sessions/session-1';

const SUMMARY = {
  paths: ['a.ts', 'b.ts'],
  entries: [
    { path: 'a.ts', status: 'modified', from: null },
    { path: 'b.ts', status: 'added', from: null },
  ],
  additions: 3,
  deletions: 1,
  numstat: '',
};

const changedCalls = () =>
  h.invoke.mock.calls.filter(([name]) => name === 'worktree_changed_files');

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  h.invoke.mockReset();
  h.invoke.mockImplementation(async (command) =>
    command === 'worktree_changed_files' ? SUMMARY : undefined,
  );
  useAppStore.setState({
    sessionProjectMounts: { [SESSION]: [mountFixture({ worktreePath: DIR, branch: 'ak/x' })] },
    sessionWorktreeRecords: {
      [SESSION]: [
        {
          id: 'wt-1',
          sessionId: SESSION,
          worktreePath: DIR,
          branch: 'ak/x',
          parallelIndex: 0,
          createdAt: 0,
        },
      ],
    },
  });
});

afterEach(cleanup);

describe('useExploreChanges', () => {
  it('reads the status of every changed path and counts them once', async () => {
    const { result } = renderHook(() => useExploreChanges({ sessionId: SESSION, mountPath: DIR }));

    await waitFor(() => expect(result.current.isAvailable).toBe(true));
    expect(result.current.changes.count).toBe(2);
    expect(result.current.changes.byPath.get('b.ts')?.status).toBe('added');
  });

  it('shares the request of the mount stats instead of issuing its own', async () => {
    const { result } = renderHook(() => ({
      stats: useMountDiffStats(SESSION),
      explore: useExploreChanges({ sessionId: SESSION, mountPath: DIR }),
    }));

    await waitFor(() => expect(result.current.explore.isAvailable).toBe(true));
    await waitFor(() =>
      expect(result.current.stats.get(DIR)).toEqual({ additions: 3, deletions: 1 }),
    );
    expect(changedCalls()).toHaveLength(1);
  });

  it('asks again only on a new tick, not on a rerender', async () => {
    const { result, rerender } = renderHook(() =>
      useExploreChanges({ sessionId: SESSION, mountPath: DIR }),
    );
    await waitFor(() => expect(result.current.isAvailable).toBe(true));

    rerender();
    rerender();
    expect(changedCalls()).toHaveLength(1);

    act(() => document.dispatchEvent(new Event('visibilitychange')));

    await waitFor(() => expect(changedCalls()).toHaveLength(2));
  });

  it('keeps the last list when a refresh fails', async () => {
    const { result } = renderHook(() => useExploreChanges({ sessionId: SESSION, mountPath: DIR }));
    await waitFor(() => expect(result.current.isAvailable).toBe(true));
    h.invoke.mockImplementation(async () => {
      throw new Error('git is busy');
    });

    act(() => result.current.refresh());

    await waitFor(() => expect(changedCalls()).toHaveLength(2));
    expect(result.current.changes.count).toBe(2);
  });

  it('asks nothing without a mount', () => {
    const { result } = renderHook(() => useExploreChanges({ sessionId: SESSION, mountPath: null }));

    expect(result.current.isAvailable).toBe(false);
    expect(changedCalls()).toHaveLength(0);
  });
});
