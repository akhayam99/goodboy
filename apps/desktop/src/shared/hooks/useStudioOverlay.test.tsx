// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useStudioOverlay } from './useStudioOverlay';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useStudioOverlay', () => {
  it('closes 200ms after the request even when the parent passes a new onClose meanwhile', () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ onClose }) => useStudioOverlay({ onClose }), {
      initialProps: { onClose: first },
    });

    act(() => result.current.requestClose());
    act(() => vi.advanceTimersByTime(150));
    rerender({ onClose: second });
    act(() => vi.advanceTimersByTime(50));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
