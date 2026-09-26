import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFrozenOrder } from './index';

describe('useFrozenOrder', () => {
  it('tracks the live value while not frozen', () => {
    const { result, rerender } = renderHook(
      ({ value, isFrozen }) => useFrozenOrder({ value, isFrozen }),
      { initialProps: { value: ['a', 'b'], isFrozen: false } },
    );
    expect(result.current).toEqual(['a', 'b']);

    rerender({ value: ['b', 'a'], isFrozen: false });
    expect(result.current).toEqual(['b', 'a']);
  });

  it('keeps the value from the moment it froze, ignoring later updates', () => {
    const { result, rerender } = renderHook(
      ({ value, isFrozen }) => useFrozenOrder({ value, isFrozen }),
      { initialProps: { value: ['a', 'b'], isFrozen: false } },
    );

    rerender({ value: ['a', 'b'], isFrozen: true });
    rerender({ value: ['b', 'a'], isFrozen: true });
    expect(result.current).toEqual(['a', 'b']);

    rerender({ value: ['b', 'a'], isFrozen: false });
    expect(result.current).toEqual(['b', 'a']);
  });
});
