import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSeenNotifications } from '.';

type VisibilityParams = {
  readonly state: DocumentVisibilityState;
};

const setVisibility = ({ state }: VisibilityParams) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

const IDS = ['n-harborline', 'n-northwind'];

describe('useSeenNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('marks each row after one second on screen', () => {
    const onSeen = vi.fn();
    renderHook(() => useSeenNotifications({ isOpen: true, ids: IDS, onSeen }));

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(onSeen).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onSeen.mock.calls.map(([params]) => params.id).sort()).toEqual(IDS);
  });

  it('marks nothing while the document is hidden', () => {
    const onSeen = vi.fn();
    setVisibility({ state: 'hidden' });
    renderHook(() => useSeenNotifications({ isOpen: true, ids: IDS, onSeen }));

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(onSeen).not.toHaveBeenCalled();
  });

  it('cancels the pending timers when the document turns hidden', () => {
    const onSeen = vi.fn();
    renderHook(() => useSeenNotifications({ isOpen: true, ids: IDS, onSeen }));
    act(() => {
      vi.advanceTimersByTime(600);
    });

    setVisibility({ state: 'hidden' });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(onSeen).not.toHaveBeenCalled();
  });

  it('counts a full second again from the moment the document is visible', () => {
    const onSeen = vi.fn();
    renderHook(() => useSeenNotifications({ isOpen: true, ids: IDS, onSeen }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    setVisibility({ state: 'hidden' });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    setVisibility({ state: 'visible' });
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(onSeen).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onSeen.mock.calls.map(([params]) => params.id).sort()).toEqual(IDS);
  });
});
