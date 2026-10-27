// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { DURATION_BASE_MS } from '@goodboy/ui';
import { FileRail } from './FileRail';

type MotionParams = {
  readonly isReduced: boolean;
};

const setMotion = ({ isReduced }: MotionParams) => {
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

const frame = document.createElement('div');

type RailParams = {
  readonly isShown: boolean;
};

const Rail = ({ isShown }: RailParams) => (
  <FileRail isShown={isShown} isOverlay={false} frame={frame} bodyRef={() => undefined}>
    <p>ledger-core/src/f00.ts</p>
  </FileRail>
);

const aside = (): HTMLElement => {
  const element = document.querySelector<HTMLElement>('aside');
  if (element === null) {
    throw new Error('no file rail');
  }
  return element;
};

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  setMotion({ isReduced: false });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect(
    this: HTMLElement,
  ) {
    return DOMRect.fromRect({ x: 0, y: 0, width: this === frame ? 1200 : 0, height: 800 });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  cleanup();
});

describe('the diff file rail fold', () => {
  it('eases its width to zero while the list fades, then drops the list', () => {
    const { rerender } = render(<Rail isShown />);
    expect(aside().getAttribute('data-fold')).toBe('open');

    rerender(<Rail isShown={false} />);

    expect(aside().getAttribute('data-fold')).toBe('folding');
    expect(aside().style.width).toBe('0px');
    expect(aside().getAttribute('aria-hidden')).toBe('true');
    expect(aside().hasAttribute('inert')).toBe(true);
    expect(aside().textContent).toContain('ledger-core/src/f00.ts');

    advance(DURATION_BASE_MS);

    expect(aside().getAttribute('data-fold')).toBe('folded');
    expect(aside().textContent).toBe('');
    expect(screen.queryByRole('complementary', { name: 'Files' })).toBeNull();
  });

  it('grows back to its saved width with the list fading in', () => {
    const { rerender } = render(<Rail isShown={false} />);
    expect(aside().getAttribute('data-fold')).toBe('folded');

    rerender(<Rail isShown />);

    expect(aside().getAttribute('data-fold')).toBe('unfolding');
    expect(aside().style.width).toBe('var(--goodboy-diff-file-rail-width)');
    expect(aside().hasAttribute('inert')).toBe(false);
    expect(screen.getByRole('complementary', { name: 'Files' }).textContent).toContain(
      'ledger-core/src/f00.ts',
    );

    advance(DURATION_BASE_MS);

    expect(aside().getAttribute('data-fold')).toBe('open');
  });

  it('folds at once under reduced motion', () => {
    setMotion({ isReduced: true });
    const { rerender } = render(<Rail isShown />);

    rerender(<Rail isShown={false} />);

    expect(aside().getAttribute('data-fold')).toBe('folded');
    expect(aside().textContent).toBe('');
  });
});
