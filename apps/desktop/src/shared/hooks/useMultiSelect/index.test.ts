// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMultiSelect } from './index';

const IDS = ['a', 'b', 'c', 'd'] as const;

const click = (
  overrides: Partial<Record<'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey', boolean>>,
) => ({
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...overrides,
});

describe('useMultiSelect', () => {
  it('replaces the selection on a plain click', () => {
    const { result } = renderHook(() => useMultiSelect<(typeof IDS)[number]>([...IDS]));

    act(() => result.current.handleItemClick('a', click({})));
    act(() => result.current.handleItemClick('c', click({})));

    expect(result.current.selected).toEqual(['c']);
    expect(result.current.isSelected('a')).toBe(false);
  });

  it('adds and removes with the command key', () => {
    const { result } = renderHook(() => useMultiSelect<(typeof IDS)[number]>([...IDS]));

    act(() => result.current.handleItemClick('a', click({})));
    act(() => result.current.handleItemClick('c', click({ metaKey: true })));
    expect(result.current.selected).toEqual(['a', 'c']);

    act(() => result.current.handleItemClick('a', click({ ctrlKey: true })));
    expect(result.current.selected).toEqual(['c']);
  });

  it('extends from the anchor with the shift key, in either direction', () => {
    const { result } = renderHook(() => useMultiSelect<(typeof IDS)[number]>([...IDS]));

    act(() => result.current.handleItemClick('b', click({})));
    act(() => result.current.handleItemClick('d', click({ shiftKey: true })));
    expect(result.current.selected).toEqual(['b', 'c', 'd']);

    act(() => result.current.handleItemClick('a', click({ shiftKey: true })));
    expect(result.current.selected).toEqual(['a', 'b']);
  });

  it('moves the anchor to the last item touched with the command key', () => {
    const { result } = renderHook(() => useMultiSelect<(typeof IDS)[number]>([...IDS]));

    act(() => result.current.handleItemClick('a', click({})));
    act(() => result.current.handleItemClick('c', click({ metaKey: true })));
    act(() => result.current.handleItemClick('d', click({ shiftKey: true })));

    expect(result.current.selected).toEqual(['a', 'c', 'd']);
  });

  it('selects the whole visual order and clears it', () => {
    const { result } = renderHook(() => useMultiSelect<(typeof IDS)[number]>([...IDS]));

    act(() => result.current.selectAll());
    expect(result.current.selected).toEqual(['a', 'b', 'c', 'd']);

    act(() => result.current.clear());
    expect(result.current.selected).toEqual([]);
  });

  it('follows the order the caller passes, not the insertion order', () => {
    const { result } = renderHook(() => useMultiSelect<(typeof IDS)[number]>(['d', 'c', 'b', 'a']));

    act(() => result.current.handleItemClick('d', click({})));
    act(() => result.current.handleItemClick('b', click({ shiftKey: true })));

    expect(result.current.selected).toEqual(['d', 'c', 'b']);
  });

  it('starts a fresh selection when a range has no anchor', () => {
    const { result } = renderHook(() => useMultiSelect<(typeof IDS)[number]>([...IDS]));

    act(() => result.current.handleItemClick('c', click({ shiftKey: true })));

    expect(result.current.selected).toEqual(['c']);
  });
});
