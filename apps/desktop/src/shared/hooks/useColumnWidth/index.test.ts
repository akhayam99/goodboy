// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useColumnWidth } from './index';

afterEach(() => {
  localStorage.clear();
});

describe('useColumnWidth', () => {
  it('reads and persists the column width', () => {
    localStorage.setItem('column-width', '360');
    const { result } = renderHook(() => useColumnWidth('column-width', 240));

    expect(result.current[0]).toBe(360);

    act(() => result.current[1](320));

    expect(result.current[0]).toBe(320);
    expect(localStorage.getItem('column-width')).toBe('320');
  });
});
