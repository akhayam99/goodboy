import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import type { Rgb } from '../../test/colorMath';
import { THEME_NAMES, contrastRatio, over, tokenOf, type Theme } from '../../test/styleTokens';

const STYLES = readFileSync(join(__dirname, '..', '..', 'styles.css'), 'utf8');

const BODY_FLOOR = 4.5;
const INK_DENSITY = 0.5;
const BACKDROPS = ['background', 'subtle', 'muted', 'elevated', 'floating'] as const;
const PINNED_TEXT = ['foreground', 'muted-foreground', 'faint-foreground'] as const;

const utilityBody = (name: string): string => {
  const start = STYLES.indexOf(`@utility ${name} {`);
  if (start < 0) {
    throw new Error(`utility ${name} missing`);
  }
  const end = STYLES.indexOf('\n}\n', start);
  return STYLES.slice(start, end);
};

const fillAlphaOf = ({ name }: { readonly name: string }): number => {
  const match = /color-mix\(in oklab, var\(--color-[\w-]+\) (\d+)%, transparent\)/.exec(
    utilityBody(name),
  );
  if (match === null) {
    throw new Error(`utility ${name} has no translucent fill`);
  }
  return Number(match[1]) / 100;
};

const rgbOf = ({ theme, name }: { readonly theme: Theme; readonly name: string }): Rgb =>
  tokenOf({ theme, name }).rgb;

const backdropsOf = ({ theme }: { readonly theme: Theme }): ReadonlyArray<Rgb> =>
  BACKDROPS.flatMap((surface) => [
    rgbOf({ theme, name: surface }),
    over({
      top: rgbOf({ theme, name: 'foreground' }),
      base: rgbOf({ theme, name: surface }),
      alpha: INK_DENSITY,
    }),
  ]);

describe('sticky-surface', () => {
  const body = utilityBody('sticky-surface');

  it('paints the background at 80% over a 12px blur, saturated, with no shadow', () => {
    expect(body).toContain('color-mix(in oklab, var(--color-background) 80%, transparent)');
    expect(body).toContain('backdrop-filter: blur(12px) saturate(1.4);');
    expect(body).not.toMatch(/shadow|gradient/);
  });

  it.each(THEME_NAMES)('keeps pinned text at 4.5:1 over any backdrop in %s', (theme) => {
    const alpha = fillAlphaOf({ name: 'sticky-surface' });
    const fill = rgbOf({ theme, name: 'background' });
    const failures = backdropsOf({ theme }).flatMap((backdrop) => {
      const frost = over({ top: fill, base: backdrop, alpha });
      return PINNED_TEXT.map((name) => ({
        name,
        ratio: contrastRatio({ first: rgbOf({ theme, name }), second: frost }),
      })).filter(({ ratio }) => ratio < BODY_FLOOR);
    });
    expect(failures).toEqual([]);
  });
});

describe('sticky-surface-subtle', () => {
  it('keeps the light frost for a row that parks inside a scroller', () => {
    const body = utilityBody('sticky-surface-subtle');

    expect(body).toContain('color-mix(in oklab, var(--color-subtle) 90%, transparent)');
    expect(body).toContain('backdrop-filter: blur(3px) saturate(1.2);');
    expect(body).not.toMatch(/shadow|gradient/);
  });
});

describe.each(['sticky-surface', 'sticky-surface-subtle'])('%s', (name) => {
  it('turns opaque and drops the blur under reduced transparency', () => {
    const body = utilityBody(name);

    expect(body).toContain('@media (prefers-reduced-transparency: reduce)');
    expect(body).toMatch(/background-color: var\(--color-[\w-]+\);\s+backdrop-filter: none/);
  });
});

describe('scroll edge', () => {
  it('has no shade token left behind', () => {
    expect(STYLES).not.toContain('--color-scroll-edge');
  });
});
