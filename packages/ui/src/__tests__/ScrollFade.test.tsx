// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ScrollFade } from '../components/ScrollFade';

afterEach(cleanup);

const viewportOf = (container: HTMLElement): HTMLElement => {
  const root = container.firstElementChild;
  const viewport = root?.firstElementChild;
  if (!(viewport instanceof HTMLElement)) {
    throw new Error('viewport not found');
  }
  return viewport;
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
});
