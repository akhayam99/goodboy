// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useExploreWrap } from '.';

const KEY = 'goodboy:explore-wrap:v1';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('useExploreWrap', () => {
  it('starts unwrapped and remembers the toggle', () => {
    const first = renderHook(() => useExploreWrap());
    expect(first.result.current.isWrapped).toBe(false);

    act(() => first.result.current.toggle());

    expect(first.result.current.isWrapped).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('true');
    first.unmount();
    expect(renderHook(() => useExploreWrap()).result.current.isWrapped).toBe(true);
  });

  it('falls back to unwrapped on a stored value it does not know', () => {
    localStorage.setItem(KEY, 'maybe');

    expect(renderHook(() => useExploreWrap()).result.current.isWrapped).toBe(false);
  });
});
