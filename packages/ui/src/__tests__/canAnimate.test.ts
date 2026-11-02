// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { canAnimate } from '../canAnimate';

const frameOf = ({ width }: { readonly width: number }): Element => {
  const element = document.createElement('div');
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 0, y: 0, width, height: 100 }),
  );
  return element;
};

const reduceMotion = ({ isReduced }: { readonly isReduced: boolean }) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: isReduced && query === '(prefers-reduced-motion: reduce)',
      media: query,
    })),
  );
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('canAnimate', () => {
  it('animates a laid out element when motion is allowed', () => {
    reduceMotion({ isReduced: false });

    expect(canAnimate({ element: frameOf({ width: 400 }) })).toBe(true);
  });

  it('does not animate without an element', () => {
    expect(canAnimate({ element: null })).toBe(false);
  });

  it('does not animate an element with no width', () => {
    reduceMotion({ isReduced: false });

    expect(canAnimate({ element: frameOf({ width: 0 }) })).toBe(false);
  });

  it('does not animate under reduced motion', () => {
    reduceMotion({ isReduced: true });

    expect(canAnimate({ element: frameOf({ width: 400 }) })).toBe(false);
  });
});
