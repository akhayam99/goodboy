// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useLatestFetch } from './index';

afterEach(cleanup);

describe('useLatestFetch', () => {
  it('keeps the newest call fresh and marks the one before it stale', () => {
    const { result } = renderHook(() => useLatestFetch());

    const first = result.current();
    expect(first()).toBe(false);

    const second = result.current();

    expect(first()).toBe(true);
    expect(second()).toBe(false);
  });

  it('marks a call stale once the component is gone', () => {
    const { result, unmount } = renderHook(() => useLatestFetch());
    const pending = result.current();

    unmount();

    expect(pending()).toBe(true);
  });

  it('hands out the same function across renders', () => {
    const { result, rerender } = renderHook(() => useLatestFetch());
    const before = result.current;

    rerender();

    expect(result.current).toBe(before);
  });
});
