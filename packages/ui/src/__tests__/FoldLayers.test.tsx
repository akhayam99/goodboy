// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { FoldLayers } from '../components/FoldLayers';
import { FOLD_MS } from '../motionTimings';

const layOut = (width: number) => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 0, y: 0, width, height: 600 }),
  );
};

const reduceMotion = (isReduced: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: isReduced && query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
};

const rail = (isFolded: boolean) => (
  <FoldLayers
    isFolded={isFolded}
    openWidth="var(--rail-width, 240px)"
    open={<button type="button">Overview</button>}
    folded={<button type="button" aria-label="Overview icon" />}
  />
);

const frame = () => document.querySelector<HTMLElement>('[data-fold]');
const openLayer = () => document.querySelector<HTMLElement>('[data-fold-layer="open"]');
const foldedLayer = () => document.querySelector<HTMLElement>('[data-fold-layer="folded"]');

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  reduceMotion(false);
  layOut(240);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  cleanup();
});

describe('FoldLayers at rest', () => {
  it('shows only the open layer at its own width while open', () => {
    render(rail(false));

    expect(frame()?.dataset.fold).toBe('open');
    expect(openLayer()?.style.width).toBe('var(--rail-width, 240px)');
    expect(openLayer()?.className).not.toContain('bg-inherit');
    expect(foldedLayer()).toBeNull();
  });

  it('shows only the 44px icon layer while folded', () => {
    render(rail(true));

    expect(frame()?.dataset.fold).toBe('folded');
    expect(foldedLayer()?.style.width).toBe('44px');
    expect(openLayer()).toBeNull();
  });

  it('pins both layers to the left edge and clips them, so no icon re-centres', () => {
    render(rail(false));

    expect(frame()?.className).toContain('overflow-clip');
    expect(openLayer()?.className).toContain('left-0');
  });
});

describe('FoldLayers folding', () => {
  it('keeps the open layer over the icons while its words fade, then removes it', () => {
    const view = render(rail(false));
    view.rerender(rail(true));

    expect(frame()?.dataset.fold).toBe('folding');
    expect(foldedLayer()).not.toBeNull();
    expect(openLayer()?.className).toContain('motion-safe:animate-fold-label-out');
    expect(openLayer()?.className).toContain('bg-inherit');
    expect(openLayer()?.getAttribute('aria-hidden')).toBe('true');
    expect(openLayer()?.hasAttribute('inert')).toBe(true);
    expect(foldedLayer()?.hasAttribute('aria-hidden')).toBe(false);

    advance(FOLD_MS - 1);
    expect(openLayer()).not.toBeNull();

    advance(1);
    expect(frame()?.dataset.fold).toBe('folded');
    expect(openLayer()).toBeNull();
  });

  it('fades the words in over the icons on unfold, then drops the icon layer', () => {
    const view = render(rail(true));
    view.rerender(rail(false));

    expect(frame()?.dataset.fold).toBe('unfolding');
    expect(openLayer()?.className).toContain('motion-safe:animate-fold-label-in');
    expect(openLayer()?.hasAttribute('inert')).toBe(false);
    expect(foldedLayer()?.getAttribute('aria-hidden')).toBe('true');
    expect(foldedLayer()?.hasAttribute('inert')).toBe(true);

    advance(FOLD_MS);
    expect(frame()?.dataset.fold).toBe('open');
    expect(foldedLayer()).toBeNull();
    expect(openLayer()?.className).not.toContain('animate-fold-label-in');
  });

  it('turns back mid fold without waiting for the first move to end', () => {
    const view = render(rail(false));
    view.rerender(rail(true));
    advance(80);
    view.rerender(rail(false));

    expect(frame()?.dataset.fold).toBe('unfolding');

    advance(FOLD_MS);
    expect(frame()?.dataset.fold).toBe('open');
  });

  it('swaps at once under reduced motion', () => {
    reduceMotion(true);
    const view = render(rail(false));
    view.rerender(rail(true));

    expect(frame()?.dataset.fold).toBe('folded');
    expect(openLayer()).toBeNull();

    view.rerender(rail(false));
    expect(frame()?.dataset.fold).toBe('open');
    expect(foldedLayer()).toBeNull();
  });

  it('swaps at once when nothing is laid out to animate', () => {
    layOut(0);
    const view = render(rail(false));
    view.rerender(rail(true));

    expect(frame()?.dataset.fold).toBe('folded');
    expect(openLayer()).toBeNull();
  });
});
