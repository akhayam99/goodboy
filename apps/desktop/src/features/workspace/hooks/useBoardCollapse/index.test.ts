// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { useBoardCollapse } from './index';

const harborline = 'ws-harborline' as WorkspaceId;
const northwind = 'ws-northwind' as WorkspaceId;
const keyOf = (workspaceId: WorkspaceId) => `goodboy:board-collapsed:v1:${workspaceId}`;

beforeEach(() => {
  localStorage.clear();
});

describe('useBoardCollapse', () => {
  it('folds done and archived by default', () => {
    const { result } = renderHook(() => useBoardCollapse({ workspaceId: harborline }));
    expect(result.current.collapsed).toEqual({ done: true, archived: true });
  });

  it('remembers an opened column for the workspace', () => {
    const { result, unmount } = renderHook(() => useBoardCollapse({ workspaceId: harborline }));
    act(() => result.current.setCollapsed({ column: 'done', isCollapsed: false }));

    expect(result.current.collapsed).toEqual({ done: false, archived: true });
    expect(JSON.parse(localStorage.getItem(keyOf(harborline)) ?? 'null')).toEqual({
      done: false,
      archived: true,
    });

    unmount();
    const again = renderHook(() => useBoardCollapse({ workspaceId: harborline }));
    expect(again.result.current.collapsed).toEqual({ done: false, archived: true });
  });

  it('keeps two workspaces independent', () => {
    const { result, rerender } = renderHook(
      ({ workspaceId }: { workspaceId: WorkspaceId }) => useBoardCollapse({ workspaceId }),
      { initialProps: { workspaceId: harborline } },
    );
    act(() => result.current.setCollapsed({ column: 'archived', isCollapsed: false }));

    rerender({ workspaceId: northwind });
    expect(result.current.collapsed).toEqual({ done: true, archived: true });
    act(() => result.current.setCollapsed({ column: 'done', isCollapsed: false }));

    rerender({ workspaceId: harborline });
    expect(result.current.collapsed).toEqual({ done: true, archived: false });
    expect(JSON.parse(localStorage.getItem(keyOf(northwind)) ?? 'null')).toEqual({
      done: false,
      archived: true,
    });
  });

  it('falls back to the default when the stored value is not valid', () => {
    localStorage.setItem(keyOf(harborline), '{not json');
    localStorage.setItem(keyOf(northwind), JSON.stringify({ done: 'yes' }));

    const broken = renderHook(() => useBoardCollapse({ workspaceId: harborline }));
    expect(broken.result.current.collapsed).toEqual({ done: true, archived: true });
    const partial = renderHook(() => useBoardCollapse({ workspaceId: northwind }));
    expect(partial.result.current.collapsed).toEqual({ done: true, archived: true });
  });
});
