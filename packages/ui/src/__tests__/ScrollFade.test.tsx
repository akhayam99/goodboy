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

const runFrames = (): void => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
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

  it('masks the viewport instead of painting an overlay gradient over neighbours', () => {
    const { container } = render(
      <ScrollFade className="max-h-80">
        <p>content</p>
      </ScrollFade>,
    );
    const viewport = viewportOf(container);
    expect(viewport.style.maskImage).toContain('linear-gradient');
    const root = container.firstElementChild as HTMLElement;
    expect(root.querySelectorAll('[aria-hidden].bg-gradient-to-b').length).toBe(0);
    expect(root.querySelectorAll('[aria-hidden].bg-gradient-to-t').length).toBe(0);
  });

  it('sets no top fade and a full bottom fade at the start of the scroll range', () => {
    runFrames();
    const { container } = render(
      <ScrollFade className="h-40" fadeSize={32}>
        <p>content</p>
      </ScrollFade>,
    );
    const viewport = viewportOf(container);
    makeOverflow({ viewport });
    act(() => {
      fireEvent.scroll(viewport);
    });
    expect(viewport.style.getPropertyValue('--fade-top')).toBe('0px');
    expect(viewport.style.getPropertyValue('--fade-bottom')).toBe('32px');
    vi.unstubAllGlobals();
  });

  it('grows the top fade and keeps the bottom fade in the middle of the scroll range', () => {
    runFrames();
    const { container } = render(
      <ScrollFade className="h-40" fadeSize={32}>
        <p>content</p>
      </ScrollFade>,
    );
    const viewport = viewportOf(container);
    makeOverflow({ viewport });
    viewport.scrollTop = 150;
    act(() => {
      fireEvent.scroll(viewport);
    });
    expect(viewport.style.getPropertyValue('--fade-top')).toBe('32px');
    expect(viewport.style.getPropertyValue('--fade-bottom')).toBe('32px');
    vi.unstubAllGlobals();
  });

  it('never fades the top edge when only the end fades, so a sticky header stays sharp', () => {
    runFrames();
    const { container } = render(
      <ScrollFade className="h-40" fadeSize={32} fadeEdges="end">
        <p>content</p>
      </ScrollFade>,
    );
    const viewport = viewportOf(container);
    makeOverflow({ viewport });
    viewport.scrollTop = 150;
    act(() => {
      fireEvent.scroll(viewport);
    });
    expect(viewport.style.getPropertyValue('--fade-top')).toBe('0px');
    expect(viewport.style.getPropertyValue('--fade-bottom')).toBe('32px');
    vi.unstubAllGlobals();
  });

  it('shrinks the bottom fade to 0 and keeps the top fade at the end of the scroll range', () => {
    runFrames();
    const { container } = render(
      <ScrollFade className="h-40" fadeSize={32}>
        <p>content</p>
      </ScrollFade>,
    );
    const viewport = viewportOf(container);
    makeOverflow({ viewport });
    viewport.scrollTop = 300;
    act(() => {
      fireEvent.scroll(viewport);
    });
    expect(viewport.style.getPropertyValue('--fade-top')).toBe('32px');
    expect(viewport.style.getPropertyValue('--fade-bottom')).toBe('0px');
    vi.unstubAllGlobals();
  });

  it('keeps the default edge a fade: no scrolled mark, no line, the top fade grows', () => {
    runFrames();
    const { container } = render(
      <ScrollFade className="h-40" fadeSize={32}>
        <p>content</p>
      </ScrollFade>,
    );
    const root = container.firstElementChild as HTMLElement;
    const viewport = viewportOf(container);
    makeOverflow({ viewport });
    viewport.scrollTop = 150;
    act(() => {
      fireEvent.scroll(viewport);
    });
    expect(root.hasAttribute('data-scrolled')).toBe(false);
    expect(root.querySelector('[data-slot="scroll-edge"]')).toBeNull();
    expect(viewport.style.getPropertyValue('--fade-top')).toBe('32px');
    vi.unstubAllGlobals();
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

describe('ScrollFade line edge', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const queueFrames = () => {
    const pending: Array<FrameRequestCallback> = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pending.push(callback);
      return pending.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    return () => {
      for (const callback of pending.splice(0)) {
        callback(0);
      }
    };
  };

  const renderLine = () => {
    const flushFrames = queueFrames();
    const view = render(
      <ScrollFade className="h-40" fadeSize={32} edge="line">
        <p>content</p>
      </ScrollFade>,
    );
    const viewport = viewportOf(view.container);
    makeOverflow({ viewport });
    const scrollTo = ({ top }: { top: number }): void => {
      viewport.scrollTop = top;
      act(() => {
        fireEvent.scroll(viewport);
        flushFrames();
      });
    };
    return { root: view.container.firstElementChild as HTMLElement, viewport, scrollTo };
  };

  it('marks the root scrolled once the viewport leaves the top, and clears it at 0', () => {
    const { root, scrollTo } = renderLine();
    scrollTo({ top: 0 });
    expect(root.hasAttribute('data-scrolled')).toBe(false);

    scrollTo({ top: 1 });
    expect(root.getAttribute('data-scrolled')).toBe('true');

    scrollTo({ top: 0 });
    expect(root.hasAttribute('data-scrolled')).toBe(false);
  });

  it('softens the content under the line over 8px, never the full fade, and leaves the bottom fade on', () => {
    const { viewport, scrollTo } = renderLine();
    scrollTo({ top: 150 });

    expect(viewport.style.getPropertyValue('--fade-top')).toBe('8px');
    expect(viewport.style.getPropertyValue('--fade-bottom')).toBe('32px');
  });

  it('grows the soft top edge with the scroll, so a clipped card edge never shows as a sliver', () => {
    const { viewport, scrollTo } = renderLine();

    scrollTo({ top: 0 });
    expect(viewport.style.getPropertyValue('--fade-top')).toBe('0px');
    scrollTo({ top: 3 });
    expect(viewport.style.getPropertyValue('--fade-top')).toBe('3px');
  });

  it('draws one decorative hairline on its own top edge, lit only by the scrolled mark', () => {
    const { root } = renderLine();
    const lines = root.querySelectorAll('[data-slot="scroll-edge"]');

    expect(lines).toHaveLength(1);
    const line = lines[0] as HTMLElement;
    expect(line.getAttribute('aria-hidden')).toBe('true');
    expect(line.className).toContain('top-0');
    expect(line.className).toContain('h-px');
    expect(line.className).toMatch(/(^| )bg-border-soft( |$)/);
    expect(line.className).not.toMatch(/(^| )bg-border( |$)/);
    expect(line.className).toContain('opacity-0');
    expect(line.className).toContain('group-data-[scrolled=true]/edge:opacity-100');
    expect(line.className).toContain('motion-safe:transition-opacity');
    expect(line.className).toContain('motion-safe:duration-120');
  });

  it('keeps the viewport the first child so callers that walk the root still find it', () => {
    const { root, viewport } = renderLine();

    expect(root.firstElementChild).toBe(viewport);
  });

  it('never imitates a horizontal scroller with a top line', () => {
    runFrames();
    const { container } = render(
      <ScrollFade className="max-w-sm" orientation="horizontal" edge="line">
        <p>content</p>
      </ScrollFade>,
    );

    expect(container.querySelector('[data-slot="scroll-edge"]')).toBeNull();
  });
});

describe('ScrollFade overlay thumb', () => {
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

  it('renders exactly one thumb, sitting on the inline-end edge of its own scroller', () => {
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

    const tracks = container.querySelectorAll('.pointer-events-auto');
    expect(tracks.length).toBe(1);
    expect(tracks[0]?.className).toContain('end-0.5');
    expect(tracks[0]?.className).not.toContain('right-0.5');
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
