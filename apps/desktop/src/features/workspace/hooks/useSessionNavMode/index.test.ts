import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { store } = vi.hoisted(() => ({ store: { currentSessionId: 'session-1' as string | null } }));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (s: typeof store) => T) => selector(store),
}));

afterEach(() => {
  store.currentSessionId = 'session-1';
});

import { useSessionNavMode } from './index';

describe('useSessionNavMode', () => {
  it('starts on the lens nav', () => {
    const { result } = renderHook(() => useSessionNavMode());
    expect(result.current.mode).toBe('lenses');
  });

  it('falls back to the lens nav when the session changes', () => {
    const { result, rerender } = renderHook(() => useSessionNavMode());
    act(() => result.current.setMode('sessions'));
    expect(result.current.mode).toBe('sessions');

    store.currentSessionId = 'session-2';
    rerender();
    expect(result.current.mode).toBe('lenses');
  });
});
