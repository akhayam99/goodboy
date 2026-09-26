// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { ScrollFade } from '../components/ScrollFade';
import { ScrollerStyleContext } from '../components/ScrollFade/scrollerStyleContext';

afterEach(cleanup);

const viewportOf = (container: HTMLElement): HTMLElement => {
  const root = container.firstElementChild;
  const viewport = root?.firstElementChild;
  if (!(viewport instanceof HTMLElement)) {
    throw new Error('viewport not found');
  }
  return viewport;
};

const makeOverflow = ({ viewport }: { readonly viewport: HTMLElement }): void => {
  Object.defineProperty(viewport, 'scrollHeight', { value: 400, configurable: true });
  Object.defineProperty(viewport, 'clientHeight', { value: 100, configurable: true });
  Object.defineProperty(viewport, 'scrollWidth', { value: 100, configurable: true });
  Object.defineProperty(viewport, 'clientWidth', { value: 100, configurable: true });
};

describe('ScrollFade', () => {
  it('bounds the scrolling viewport by the root height cap so a max-h root can scroll', () => {
    const { container } = render(
      <ScrollFade className="max-h-80">
        <p>content</p>
      </ScrollFade>,
    );
    const viewport = viewportOf(container);
    expect(viewport.className).toContain('overflow-y-auto');
    expect(viewport.className).toContain('max-h-[inherit]');
  });

  it('bounds the horizontal viewport by the root width cap', () => {
    const { container } = render(
      <ScrollFade className="max-w-sm" orientation="horizontal">
        <p>content</p>
      </ScrollFade>,
    );
    const viewport = viewportOf(container);
    expect(viewport.className).toContain('overflow-x-auto');
    expect(viewport.className).toContain('max-w-[inherit]');
  });

  it('keeps the caller viewport classes alongside the inherited cap', () => {
    const { container } = render(
      <ScrollFade className="h-full" viewportClassName="px-3">
        <p>content</p>
      </ScrollFade>,
    );
    expect(viewportOf(container).className).toContain('px-3');
  });

  it('fades to the elevated surface color for floating panels', () => {
    const { container } = render(
      <ScrollFade className="max-h-80" fadeFrom="elevated">
        <p>content</p>
      </ScrollFade>,
    );
    const root = container.firstElementChild as HTMLElement;
    const fades = root.querySelectorAll('[aria-hidden]');
    expect(fades.length).toBeGreaterThan(0);
    fades.forEach((fade) => expect(fade.className).toContain('from-elevated'));
  });

  it('fades to the floating surface color for popovers and listboxes', () => {
    const { container } = render(
      <ScrollFade className="max-h-80" fadeFrom="floating">
        <p>content</p>
      </ScrollFade>,
    );
    const root = container.firstElementChild as HTMLElement;
    const fades = root.querySelectorAll('[aria-hidden]');
    expect(fades.length).toBeGreaterThan(0);
    fades.forEach((fade) => expect(fade.className).toContain('from-floating'));
  });

  it('renders no scrollbar track when the content does not overflow', () => {
    const { container } = render(
      <ScrollFade className="h-40">
        <p>short</p>
      </ScrollFade>,
    );
    expect(container.querySelector('.pointer-events-auto')).toBeNull();
  });

  it('renders no scrollbar track when the caller opts out', () => {
    const { container } = render(
      <ScrollFade className="h-40" scrollbar="none">
        <p>short</p>
      </ScrollFade>,
    );
    const viewport = viewportOf(container);
    makeOverflow({ viewport });
    fireEvent.scroll(viewport);
    expect(container.querySelector('.pointer-events-auto')).toBeNull();
  });
});

describe('ScrollFade overlay thumb', () => {
  const runFrames = (): void => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
  };

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('appears once the viewport overflows and a scroll reveals it', () => {
    runFrames();
    const { container } = render(
      <ScrollFade className="h-40">
        <p>content</p>
      </ScrollFade>,
    );
    const viewport = viewportOf(container);
    makeOverflow({ viewport });
    act(() => {
      fireEvent.scroll(viewport);
    });

    const track = container.querySelector('.pointer-events-auto');
    expect(track).not.toBeNull();
    expect(track?.getAttribute('aria-hidden')).toBe('true');
  });

  it('never takes width away from the content, only overlays it', () => {
    const { container } = render(
      <ScrollFade className="h-40">
        <p>content</p>
      </ScrollFade>,
    );
    const viewport = viewportOf(container);
    makeOverflow({ viewport });
    fireEvent.scroll(viewport);

    expect(viewport.className).not.toContain('pr-');
    expect(viewport.className).not.toContain('scrollbar-gutter');
  });

  it('stays visible under the always scroller style without any interaction', () => {
    runFrames();
    const { container } = render(
      <ScrollerStyleContext.Provider value="always">
        <ScrollFade className="h-40">
          <p>content</p>
        </ScrollFade>
      </ScrollerStyleContext.Provider>,
    );
    const viewport = viewportOf(container);
    makeOverflow({ viewport });
    act(() => {
      fireEvent.scroll(viewport);
    });

    const thumb = container.querySelector('.pointer-events-auto > div');
    expect(thumb).not.toBeNull();
    expect(thumb?.className).toContain('opacity-100');
  });

  it('hides again after the hide delay once scrolling stops', async () => {
    vi.useFakeTimers();
    const { container } = render(
      <ScrollFade className="h-40">
        <p>content</p>
      </ScrollFade>,
    );
    const viewport = viewportOf(container);
    makeOverflow({ viewport });
    act(() => {
      fireEvent.scroll(viewport);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    const thumb = container.querySelector('.pointer-events-auto > div');
    expect(thumb).not.toBeNull();
    expect(thumb?.className).toContain('opacity-100');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(thumb?.className).toContain('opacity-0');
  });
});
