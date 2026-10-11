// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileDiff } from '@goodboy/types';
import {
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { worktreeFileSides } from '../../../worktree/worktree';
import { useFileSides, type FileSidesLoader } from './index';

const FILE: FileDiff = {
  path: 'ledger-core.ts',
  status: 'modified',
  additions: 1,
  deletions: 1,
  binary: false,
  hunks: [
    {
      header: '',
      oldStart: 30,
      newStart: 30,
      oldLines: 1,
      newLines: 1,
      lines: [{ kind: 'context', oldLine: 30, newLine: 30, text: 'ledger' }],
    },
  ],
};
const SIDES = { old: 'ledger\n'.repeat(100), new: 'ledger\n'.repeat(100), too_large: false };
const load: FileSidesLoader = (file) =>
  worktreeFileSides({
    worktreePath: '/mock/payments-api',
    path: file.path,
    oldRev: 'base',
    newRev: 'head',
  });

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ worktree_file_sides: SIDES });
});
afterEach(() => {
  cleanup();
});

describe('useFileSides', () => {
  it('fetches once for concurrent expands and expand all', async () => {
    const { result } = renderHook(() => useFileSides({ file: FILE, load }));
    await act(async () => {
      await Promise.all([
        result.current.expand({ index: 0, direction: 'up' }),
        result.current.expand({ index: 1, direction: 'down' }),
      ]);
    });
    await act(async () => {
      await result.current.expandAll();
    });
    expect(result.current.gaps.every((gap) => gap.count === 0)).toBe(true);
    expect(
      storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'worktree_file_sides'),
    ).toHaveLength(1);
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith('worktree_file_sides', {
      worktreePath: '/mock/payments-api',
      path: FILE.path,
      oldRev: 'base',
      newRev: 'head',
      baseBranch: null,
    });
  });

  it('keeps expansion unchanged on failure and retries the same target', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('read failed')).mockResolvedValue(SIDES);
    stubStoryInvoke({ worktree_file_sides: read });
    const { result } = renderHook(() => useFileSides({ file: FILE, load }));
    await act(async () => {
      await result.current.expand({ index: 0, direction: 'up' });
    });
    expect(result.current.errors.has(0)).toBe(true);
    expect(result.current.gaps[0]?.count).toBe(29);
    await act(async () => {
      await result.current.expand({ index: 0, direction: 'up' });
    });
    expect(result.current.errors.size).toBe(0);
    expect(result.current.gaps[0]?.after).toHaveLength(20);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('drops late responses and reloads after a diff refresh', async () => {
    let answer: (sides: typeof SIDES) => void = () => undefined;
    stubStoryInvoke({
      worktree_file_sides: () =>
        new Promise<typeof SIDES>((resolve) => {
          answer = resolve;
        }),
    });
    const { result, rerender } = renderHook(({ file }) => useFileSides({ file, load }), {
      initialProps: { file: FILE },
    });
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.expand({ index: 0, direction: 'up' });
    });
    rerender({ file: { ...FILE, hunks: [...FILE.hunks] } });
    await act(async () => {
      answer(SIDES);
      await pending;
    });
    expect(result.current.sides).toBeNull();
    expect(result.current.gaps[0]?.count).toBe(29);
    stubStoryInvoke({ worktree_file_sides: SIDES });
    await act(async () => {
      await result.current.expand({ index: 0, direction: 'up' });
    });
    expect(
      storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'worktree_file_sides'),
    ).toHaveLength(2);
  });

  it('works through strict effect cleanup and ignores answers after unmount', async () => {
    const mounted = renderHook(() => useFileSides({ file: FILE, load }), { wrapper: StrictMode });
    await act(async () => {
      await mounted.result.current.expandAll();
    });
    expect(mounted.result.current.gaps.every((gap) => gap.count === 0)).toBe(true);
    mounted.unmount();
    let answer: (sides: typeof SIDES) => void = () => undefined;
    stubStoryInvoke({
      worktree_file_sides: () =>
        new Promise<typeof SIDES>((resolve) => {
          answer = resolve;
        }),
    });
    const late = renderHook(() => useFileSides({ file: FILE, load }));
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = late.result.current.expand({ index: 0, direction: 'up' });
    });
    late.unmount();
    await act(async () => {
      answer(SIDES);
      await pending;
    });
    expect(late.result.current.sides).toBeNull();
  });

  it('keeps oversized files unexpanded', async () => {
    stubStoryInvoke({ worktree_file_sides: { old: null, new: null, too_large: true } });
    const { result } = renderHook(() => useFileSides({ file: FILE, load }));
    await act(async () => {
      await result.current.expandAll();
    });
    expect(result.current.sides?.isTooLarge).toBe(true);
    expect(result.current.gaps[0]?.after).toHaveLength(0);
  });
});
