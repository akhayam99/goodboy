// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useDropdown } from './index';

afterEach(cleanup);

describe('useDropdown', () => {
  it('toggles open and closes on Escape', () => {
    const { result } = renderHook(() => useDropdown({}));
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.open).toBe(false);
  });

  it('stays closed when disabled, even on the open event', () => {
    const { result } = renderHook(() => useDropdown({ disabled: true, openEvent: 'test:open' }));
    act(() => result.current.toggle());
    act(() => {
      window.dispatchEvent(new CustomEvent('test:open'));
    });
    expect(result.current.open).toBe(false);
  });

  it('opens on the requested window event', () => {
    const { result } = renderHook(() => useDropdown({ openEvent: 'test:open' }));
    act(() => {
      window.dispatchEvent(new CustomEvent('test:open'));
    });
    expect(result.current.open).toBe(true);
  });

  it('aligns the popup to the requested edge', () => {
    const { result } = renderHook(() => useDropdown({ align: 'end', width: 'w-80' }));
    expect(result.current.popupClassName).toContain('right-0');
    expect(result.current.popupClassName).toContain('w-80');
  });
});
