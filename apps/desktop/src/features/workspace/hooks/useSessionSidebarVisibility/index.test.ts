import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { useSessionSidebarVisibility } from './index';

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);

const renderCollapsed = () => {
  localStorage.setItem(STORAGE_KEYS.sessionSidebarCollapsed, '1');
  return renderHook(() => useSessionSidebarVisibility({ hasActiveSession: true }));
};

describe('useSessionSidebarVisibility', () => {
  it('shows the session sidebar by default when a session is open', () => {
    const { result } = renderHook(() => useSessionSidebarVisibility({ hasActiveSession: true }));
    expect(result.current.isCollapsed).toBe(false);
  });

  it('toggles the session sidebar and persists the choice', () => {
    const { result } = renderHook(() => useSessionSidebarVisibility({ hasActiveSession: true }));
    act(() => {
      result.current.toggle();
    });
    expect(result.current.isCollapsed).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.sessionSidebarCollapsed)).toBe('1');

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isCollapsed).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.sessionSidebarCollapsed)).toBe('0');
  });

  it('restores a persisted collapsed choice on remount', () => {
    localStorage.setItem(STORAGE_KEYS.sessionSidebarCollapsed, '1');
    const { result } = renderHook(() => useSessionSidebarVisibility({ hasActiveSession: true }));
    expect(result.current.isCollapsed).toBe(true);
  });

  it('keeps overview board-only and ignores toggle while no session is open', () => {
    const { result } = renderHook(() => useSessionSidebarVisibility({ hasActiveSession: false }));
    act(() => {
      result.current.toggle();
    });
    expect(result.current.isCollapsed).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.sessionSidebarCollapsed)).toBeNull();
  });

  it('waits for intent before peeking, and forgets a pointer that moved on', () => {
    vi.useFakeTimers();
    const { result } = renderCollapsed();

    act(() => {
      result.current.requestPeek({ source: 'edge' });
    });
    act(() => {
      vi.advanceTimersByTime(140);
    });
    expect(result.current.isPeeking).toBe(false);

    act(() => {
      result.current.cancelPeek();
      vi.advanceTimersByTime(500);
    });
    expect(result.current.isPeeking).toBe(false);

    act(() => {
      result.current.requestPeek({ source: 'edge' });
      vi.advanceTimersByTime(150);
    });
    expect(result.current.isPeeking).toBe(true);
    vi.useRealTimers();
  });

  it('never peeks while the column is pinned open', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSessionSidebarVisibility({ hasActiveSession: true }));

    act(() => {
      result.current.requestPeek({ source: 'anchor' });
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isPeeking).toBe(false);
    vi.useRealTimers();
  });

  it('gives the pointer a grace period to come back', () => {
    vi.useFakeTimers();
    const { result } = renderCollapsed();

    act(() => {
      result.current.requestPeek({ source: 'anchor' });
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.scheduleClose();
      vi.advanceTimersByTime(200);
      result.current.cancelClose();
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isPeeking).toBe(true);

    act(() => {
      result.current.scheduleClose();
      vi.advanceTimersByTime(300);
    });
    expect(result.current.isPeeking).toBe(false);
    vi.useRealTimers();
  });

  it('stays open while something inside it holds it, then closes on release', () => {
    vi.useFakeTimers();
    const { result } = renderCollapsed();

    act(() => {
      result.current.requestPeek({ source: 'edge' });
      vi.advanceTimersByTime(150);
    });
    act(() => {
      result.current.holdPeek();
      result.current.scheduleClose();
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.isPeeking).toBe(true);

    act(() => {
      result.current.releasePeek();
      vi.advanceTimersByTime(300);
    });
    expect(result.current.isPeeking).toBe(false);
    vi.useRealTimers();
  });

  it('keeps a held peek open when the pointer never asked to leave', () => {
    vi.useFakeTimers();
    const { result } = renderCollapsed();

    act(() => {
      result.current.requestPeek({ source: 'edge' });
      vi.advanceTimersByTime(150);
    });
    act(() => {
      result.current.holdPeek();
      result.current.releasePeek();
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.isPeeking).toBe(true);
    vi.useRealTimers();
  });

  it('pins the column open and drops the peek', () => {
    vi.useFakeTimers();
    const { result } = renderCollapsed();

    act(() => {
      result.current.requestPeek({ source: 'anchor' });
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.pin();
    });

    expect(result.current.isPeeking).toBe(false);
    expect(result.current.isCollapsed).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.sessionSidebarCollapsed)).toBe('0');
    vi.useRealTimers();
  });

  it('drops the peek when the session goes away', () => {
    vi.useFakeTimers();
    localStorage.setItem(STORAGE_KEYS.sessionSidebarCollapsed, '1');
    const { result, rerender } = renderHook(
      ({ hasActiveSession }) => useSessionSidebarVisibility({ hasActiveSession }),
      { initialProps: { hasActiveSession: true } },
    );

    act(() => {
      result.current.requestPeek({ source: 'edge' });
      vi.advanceTimersByTime(150);
    });
    expect(result.current.isPeeking).toBe(true);

    rerender({ hasActiveSession: false });

    expect(result.current.isPeeking).toBe(false);
    vi.useRealTimers();
  });

  it('closes the peek on escape', () => {
    vi.useFakeTimers();
    const { result } = renderCollapsed();

    act(() => {
      result.current.requestPeek({ source: 'edge' });
      vi.advanceTimersByTime(150);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.isPeeking).toBe(false);
    vi.useRealTimers();
  });
});
