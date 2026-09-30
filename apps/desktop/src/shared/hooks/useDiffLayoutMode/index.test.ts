// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { STORAGE_KEYS } from '../../lib/storage-keys';
import { useDiffLayoutMode } from './index';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('useDiffLayoutMode', () => {
  it('starts unified and remembers a switch to split', () => {
    const first = renderHook(() => useDiffLayoutMode());
    expect(first.result.current[0]).toBe('unified');

    act(() => first.result.current[1]('split'));
    expect(localStorage.getItem(STORAGE_KEYS.diffLayoutMode)).toBe('split');

    const second = renderHook(() => useDiffLayoutMode());
    expect(second.result.current[0]).toBe('split');
  });

  it('still switches when storage refuses the write', () => {
    const refuse = () => {
      throw new Error('quota');
    };
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: refuse });
    const { result } = renderHook(() => useDiffLayoutMode());

    act(() => result.current[1]('split'));

    expect(result.current[0]).toBe('split');
  });
});
