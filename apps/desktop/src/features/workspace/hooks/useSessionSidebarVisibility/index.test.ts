import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { useSessionSidebarVisibility } from './index';

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);

describe('useSessionSidebarVisibility', () => {
  it('shows the sessions column by default when a session is open', () => {
    const { result } = renderHook(() => useSessionSidebarVisibility({ hasActiveSession: true }));
    expect(result.current.leftHidden).toBe(false);
    expect(result.current.isCollapsed).toBe(false);
  });

  it('toggles the sessions column and persists the choice', () => {
    const { result } = renderHook(() => useSessionSidebarVisibility({ hasActiveSession: true }));
    act(() => {
      result.current.toggle();
    });
    expect(result.current.leftHidden).toBe(true);
    expect(result.current.isCollapsed).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.sessionSidebarCollapsed)).toBe('1');

    act(() => {
      result.current.toggle();
    });
    expect(result.current.leftHidden).toBe(false);
    expect(result.current.isCollapsed).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.sessionSidebarCollapsed)).toBe('0');
  });

  it('restores a persisted collapsed choice on remount', () => {
    localStorage.setItem(STORAGE_KEYS.sessionSidebarCollapsed, '1');
    const { result } = renderHook(() => useSessionSidebarVisibility({ hasActiveSession: true }));
    expect(result.current.leftHidden).toBe(true);
    expect(result.current.isCollapsed).toBe(true);
  });

  it('keeps overview board-only and ignores toggle while no session is open', () => {
    const { result } = renderHook(() => useSessionSidebarVisibility({ hasActiveSession: false }));
    act(() => {
      result.current.toggle();
    });
    expect(result.current.leftHidden).toBe(true);
    expect(result.current.isCollapsed).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.sessionSidebarCollapsed)).toBeNull();
  });
});
