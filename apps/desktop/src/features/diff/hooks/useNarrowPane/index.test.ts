// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_MAX, LEFT_SIDEBAR_MIN } from '@goodboy/ui';
import { useNarrowPane } from '.';

const measured = (width: number): boolean => {
  const element = document.createElement('div');
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);
  return renderHook(() => useNarrowPane({ current: element })).result.current;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useNarrowPane', () => {
  it('is narrow under 900px and wide from 900px', () => {
    expect(measured(899)).toBe(true);
    expect(measured(900)).toBe(false);
  });

  it('reads an unmeasured pane as wide', () => {
    expect(measured(0)).toBe(false);
  });

  it('puts a 1024px window with the session sidebar open on the strip', () => {
    for (const sidebarPx of [LEFT_SIDEBAR_MIN, LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_MAX]) {
      expect(measured(1024 - sidebarPx)).toBe(true);
    }
  });

  it('gives a 1024px window with the sidebar closed the docked tree', () => {
    expect(measured(1024)).toBe(false);
  });
});
