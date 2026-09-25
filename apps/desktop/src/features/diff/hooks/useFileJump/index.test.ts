import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { FileDiff } from '@goodboy/types';
import { filterFiles, useFileJump } from '.';

const file = (path: string): FileDiff => ({
  path,
  status: 'modified',
  additions: 1,
  deletions: 0,
  binary: false,
  hunks: [],
});

const FILES = [
  file('ledger-core/src/allocation/allocate.ts'),
  file('notify-relay/src/retry/skipSettled.ts'),
  file('payments-api/src/allocate.test.ts'),
];

const key = (name: string) =>
  ({ key: name, preventDefault: () => undefined }) as unknown as Parameters<
    ReturnType<typeof useFileJump>['onKeyDown']
  >[0];

describe('filterFiles', () => {
  it('ranks file name matches before folder matches', () => {
    expect(filterFiles(FILES, 'alloc').map((entry) => entry.path)).toEqual([
      'ledger-core/src/allocation/allocate.ts',
      'payments-api/src/allocate.test.ts',
    ]);
    expect(filterFiles(FILES, 'retry').map((entry) => entry.path)).toEqual([
      'notify-relay/src/retry/skipSettled.ts',
    ]);
    expect(filterFiles(FILES, '')).toBe(FILES);
  });
});

describe('useFileJump', () => {
  it('moves with the arrows and opens with enter', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() => useFileJump({ files: FILES, onPick }));
    act(() => result.current.onKeyDown(key('ArrowDown')));
    act(() => result.current.onKeyDown(key('ArrowDown')));
    act(() => result.current.onKeyDown(key('ArrowDown')));
    expect(result.current.activeIndex).toBe(2);
    act(() => result.current.onKeyDown(key('ArrowUp')));
    act(() => result.current.onKeyDown(key('Enter')));
    expect(onPick).toHaveBeenCalledWith('notify-relay/src/retry/skipSettled.ts');
  });

  it('resets the cursor when the filter changes', () => {
    const { result } = renderHook(() => useFileJump({ files: FILES, onPick: vi.fn() }));
    act(() => result.current.onKeyDown(key('ArrowDown')));
    act(() => result.current.setQuery('skip'));
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.results).toHaveLength(1);
  });
});
