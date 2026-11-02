// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { oklchToSrgb, type Rgb } from '../../test/colorMath';

const STYLES = join(__dirname, '..', '..', 'styles.css');

const DOT_FLOOR = 3;
const SURFACES = ['chrome', 'background', 'subtle'] as const;

const linearise = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const luminance = ([r, g, b]: Rgb): number =>
  0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);

const contrast = ({ first, second }: { first: Rgb; second: Rgb }): number => {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

const css = readFileSync(STYLES, 'utf8');
const lightStart = css.indexOf("html[data-theme='light'] {");
const lightEnd = css.indexOf('\n}', lightStart);

const BLOCKS = {
  dark: css.slice(css.indexOf('@theme {'), lightStart),
  light: css.slice(lightStart, lightEnd),
} as const;

type Theme = keyof typeof BLOCKS;

const swatchOf = ({ theme, name }: { theme: Theme; name: string }): Rgb => {
  const pattern = new RegExp(
    `--color-${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\s*\\)`,
  );
  const match = pattern.exec(BLOCKS[theme]) ?? pattern.exec(BLOCKS.dark);
  if (match === null) {
    throw new Error(`styles.css has no --color-${name} for ${theme}`);
  }
  return oklchToSrgb(Number(match[1]), Number(match[2]), Number(match[3]));
};

const chromaOf = ({ theme, name }: { theme: Theme; name: string }): number => {
  const pattern = new RegExp(`--color-${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)`);
  const match = pattern.exec(BLOCKS[theme]);
  if (match === null) {
    throw new Error(`styles.css has no --color-${name} for ${theme}`);
  }
  return Number(match[2]);
};

describe.each(['dark', 'light'] as const)('the unread tone in the %s palette', (theme) => {
  it.each(SURFACES)('clears 3:1 as a dot on %s', (surface) => {
    const dot = swatchOf({ theme, name: 'unread' });
    const parent = swatchOf({ theme, name: surface });

    expect(contrast({ first: dot, second: parent })).toBeGreaterThanOrEqual(DOT_FLOOR);
  });

  it('keeps less chroma than the primary used by buttons', () => {
    expect(chromaOf({ theme, name: 'unread' })).toBeLessThan(chromaOf({ theme, name: 'primary' }));
  });
});
