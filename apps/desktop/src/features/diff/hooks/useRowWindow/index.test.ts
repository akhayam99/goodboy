// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useRowWindow } from '.';

type ScrollParams = {
  readonly element: HTMLDivElement;
  readonly top: number;
};

const scrollTo = ({ element, top }: ScrollParams) => {
  act(() => {
    element.scrollTop = top;
    element.dispatchEvent(new Event('scroll'));
  });
};

afterEach(cleanup);

describe('the row window of a scroll viewport', () => {
  it('follows the viewport that replaced the first one', () => {
    const { result } = renderHook(() => useRowWindow({ isWindowed: true }));
    const first = document.createElement('div');
    act(() => {
      result.current.viewportRef.current = first;
    });
    scrollTo({ element: first, top: 300 });
    expect(result.current.scrollTop).toBe(300);

    const second = document.createElement('div');
    act(() => {
      result.current.viewportRef.current = null;
      result.current.viewportRef.current = second;
    });
    scrollTo({ element: second, top: 1500 });
    expect(result.current.scrollTop).toBe(1500);

    scrollTo({ element: first, top: 40 });
    expect(result.current.scrollTop).toBe(1500);
  });
});
