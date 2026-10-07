import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useSessionPinsSync } from './index';

const SETTLED_MS = 1_000;

const HARBORLINE = 'workspace-harborline' as WorkspaceId;
const NORTHWIND = 'workspace-northwind' as WorkspaceId;

const loadSessionPins = vi.fn(async () => undefined);
const original = useAppStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  loadSessionPins.mockClear();
  useAppStore.setState({ currentWorkspaceId: HARBORLINE, loadSessionPins });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useAppStore.setState({
    currentWorkspaceId: original.currentWorkspaceId,
    loadSessionPins: original.loadSessionPins,
  });
});

describe('useSessionPinsSync', () => {
  it('reads the pins of the open workspace when it mounts', () => {
    renderHook(() => useSessionPinsSync());

    expect(loadSessionPins).toHaveBeenCalledTimes(1);
    expect(loadSessionPins).toHaveBeenCalledWith({ workspaceId: HARBORLINE });
  });

  it('reads again for another workspace as soon as it opens', () => {
    renderHook(() => useSessionPinsSync());
    loadSessionPins.mockClear();

    act(() => useAppStore.setState({ currentWorkspaceId: NORTHWIND }));

    expect(loadSessionPins).toHaveBeenCalledTimes(1);
    expect(loadSessionPins).toHaveBeenCalledWith({ workspaceId: NORTHWIND });
  });

  it('reads once when focus and visibility fire together', () => {
    renderHook(() => useSessionPinsSync());
    loadSessionPins.mockClear();

    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(SETTLED_MS);

    expect(loadSessionPins).toHaveBeenCalledTimes(1);
    expect(loadSessionPins).toHaveBeenCalledWith({ workspaceId: HARBORLINE });
  });

  it('stays quiet with no workspace open', () => {
    useAppStore.setState({ currentWorkspaceId: null });
    renderHook(() => useSessionPinsSync());

    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(SETTLED_MS);

    expect(loadSessionPins).not.toHaveBeenCalled();
  });

  it('drops a pending read on unmount and survives a failed read', () => {
    loadSessionPins.mockRejectedValueOnce(new Error('database is locked'));
    const { unmount } = renderHook(() => useSessionPinsSync());
    loadSessionPins.mockClear();

    window.dispatchEvent(new Event('focus'));
    unmount();
    vi.advanceTimersByTime(SETTLED_MS);

    expect(loadSessionPins).not.toHaveBeenCalled();
  });
});
