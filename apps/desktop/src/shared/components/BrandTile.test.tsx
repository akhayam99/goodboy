// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { applyDocumentTheme } from '../lib/theme';
import { BOOT_MARK_PX } from '../../app/components/BootSplash/bootMark';
import { BrandTile } from './BrandTile';

const HERO_TILE_PX = 84;
const MARK_PIXEL_TOLERANCE = 0.5;

afterEach(() => {
  cleanup();
  applyDocumentTheme({ theme: 'dark' });
});

type TileParams = {
  readonly container: HTMLElement;
};

const tileOf = ({ container }: TileParams): HTMLElement => {
  const tile = container.querySelector<HTMLElement>('[data-brand-tile]');
  if (tile === null) {
    throw new Error('no brand tile');
  }
  return tile;
};

const markOf = ({ container }: TileParams): HTMLElement => {
  const mark = tileOf({ container }).firstElementChild;
  if (!(mark instanceof HTMLElement)) {
    throw new Error('no brand mark');
  }
  return mark;
};

describe('BrandTile', () => {
  it('draws a square black tile whose corners are 0.28 of its side', () => {
    const { container } = render(<BrandTile size={40} />);
    const tile = tileOf({ container });
    expect(tile.style.width).toBe('40px');
    expect(tile.style.height).toBe('40px');
    expect(tile.style.borderRadius).toBe('11.2px');
  });

  it('draws one hidden mark at 0.76 of the tile side', () => {
    const { container } = render(<BrandTile size={100} />);
    const mark = markOf({ container });
    expect(mark.style.width).toBe('76px');
    expect(mark.style.height).toBe('76px');
    expect(mark.getAttribute('aria-hidden')).toBe('true');
    const tile = tileOf({ container });
    expect(tile.children).toHaveLength(1);
  });

  it('scales every size by the same ratios', () => {
    [22, 40, 84].forEach((size) => {
      const { container, unmount } = render(<BrandTile size={size} />);
      expect(Number.parseFloat(tileOf({ container }).style.borderRadius) / size).toBeCloseTo(
        0.28,
        10,
      );
      expect(Number.parseFloat(markOf({ container }).style.width) / size).toBeCloseTo(0.76, 10);
      unmount();
    });
  });

  it('puts the hero mark on the boot splash dog box', () => {
    const { container } = render(<BrandTile size={HERO_TILE_PX} />);
    const markPx = Number.parseFloat(markOf({ container }).style.width);
    expect(Math.abs(markPx - BOOT_MARK_PX)).toBeLessThan(MARK_PIXEL_TOLERANCE);
  });

  it('stays black with no border, ring, shadow or lighter variant in light and dark', () => {
    const markupIn = ({ theme }: { readonly theme: 'dark' | 'light' }): string => {
      applyDocumentTheme({ theme });
      const { container, unmount } = render(<BrandTile size={40} />);
      const markup = container.innerHTML;
      unmount();
      return markup;
    };
    const dark = markupIn({ theme: 'dark' });
    expect(markupIn({ theme: 'light' })).toBe(dark);
    expect(dark).not.toMatch(/class="[^"]*(border|ring-|shadow|opacity|dark:)/);
    expect(dark).not.toMatch(/style="[^"]*(border-width|border-color|box-shadow|opacity|outline)/);
  });
});
