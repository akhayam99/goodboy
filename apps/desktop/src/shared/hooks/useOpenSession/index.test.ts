import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { useOpenSession } from './index';

const setCurrentSession = vi.fn();

vi.mock('../../../store', () => ({
  useAppStore: (selector: (s: { setCurrentSession: typeof setCurrentSession }) => unknown) =>
    selector({ setCurrentSession }),
}));

describe('useOpenSession', () => {
  beforeEach(() => {
    setCurrentSession.mockClear();
  });

  it('sets the current session', () => {
    const { result } = renderHook(() => useOpenSession());
    result.current('s1' as SessionId);
    expect(setCurrentSession).toHaveBeenCalledWith('s1');
  });

  it('runs onOpened after navigating', () => {
    const onOpened = vi.fn();
    const { result } = renderHook(() => useOpenSession());
    result.current('s2' as SessionId, onOpened);
    expect(onOpened).toHaveBeenCalledOnce();
  });
});
