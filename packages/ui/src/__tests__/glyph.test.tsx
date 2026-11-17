// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import * as icons from '../icons';
import { Check, PanelsTopLeft, Star } from '../icons';
import type { IconGlyph } from '../icons';

afterEach(cleanup);

const GENERATED: ReadonlyArray<IconGlyph> = [...new Set(Object.values(icons))];

type DrawParams = {
  readonly icon: IconGlyph;
  readonly weight?: 'regular' | 'bold' | 'fill' | 'duotone';
};

const drawn = ({ icon: Icon, weight }: DrawParams): SVGSVGElement => {
  const { container } = render(<Icon weight={weight} />);
  const svg = container.querySelector('svg');
  if (svg == null) {
    throw new Error('no svg drawn');
  }
  return svg;
};

describe('generated glyphs', () => {
  it('serves every name in the icon module from a named generated glyph', () => {
    const names = Object.entries(icons);

    expect(names.length).toBeGreaterThan(200);
    names.forEach(([name, icon]) => {
      expect(typeof icon.displayName, name).toBe('string');
    });
  });

  it('gives every generated glyph its own name and a regular drawing', () => {
    const names = GENERATED.map((icon) => icon.displayName);

    expect(new Set(names).size).toBe(GENERATED.length);
    GENERATED.forEach((icon) => {
      expect(drawn({ icon }).querySelectorAll('path'), icon.displayName).toHaveLength(1);
      cleanup();
    });
  });

  it('draws regular on the 256 grid at 24px in the current color by default', () => {
    const svg = drawn({ icon: Check });

    expect(svg.getAttribute('viewBox')).toBe('0 0 256 256');
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('fill')).toBe('currentColor');
    expect(svg.querySelector('path')?.hasAttribute('stroke')).toBe(false);
  });

  it('draws bold as the regular outline widened by a round stroke in the same color', () => {
    const regular = drawn({ icon: Check }).querySelector('path');
    cleanup();
    const bold = drawn({ icon: Check, weight: 'bold' }).querySelector('path');

    expect(bold?.getAttribute('d')).toBe(regular?.getAttribute('d'));
    expect(bold?.getAttribute('stroke')).toBe('currentColor');
    expect(bold?.getAttribute('stroke-width')).toBe('8');
    expect(bold?.getAttribute('stroke-linejoin')).toBe('round');
  });

  it('draws fill on the glyph that carries it', () => {
    const regular = drawn({ icon: Star }).innerHTML;
    cleanup();
    const fill = drawn({ icon: Star, weight: 'fill' });

    expect(fill.innerHTML).not.toBe(regular);
    expect(fill.querySelectorAll('path')).toHaveLength(1);
  });

  it('draws duotone as a faint shade under the line on the glyph that carries it', () => {
    const paths = drawn({ icon: PanelsTopLeft, weight: 'duotone' }).querySelectorAll('path');

    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute('opacity')).toBe('0.2');
    expect(paths[1]?.hasAttribute('opacity')).toBe(false);
  });

  it('falls back to regular for a weight the glyph does not carry', () => {
    const regular = drawn({ icon: Check }).innerHTML;
    cleanup();

    expect(drawn({ icon: Check, weight: 'fill' }).innerHTML).toBe(regular);
    cleanup();
    expect(drawn({ icon: Check, weight: 'duotone' }).innerHTML).toBe(regular);
  });

  it('takes size, color, a title and svg attributes from its props', () => {
    const { container } = render(
      <Check size={12} color="red" alt="Done" className="shrink-0" aria-hidden />,
    );
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('width')).toBe('12');
    expect(svg?.getAttribute('height')).toBe('12');
    expect(svg?.getAttribute('fill')).toBe('red');
    expect(svg?.querySelector('title')?.textContent).toBe('Done');
    expect(svg?.getAttribute('class')).toBe('shrink-0');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});
