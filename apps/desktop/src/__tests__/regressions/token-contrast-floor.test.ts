import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const STYLES = join(__dirname, '..', '..', 'styles.css');

const BODY_FLOOR = 4.5;
const LARGE_FLOOR = 3;

const SURFACES = ['background', 'subtle', 'muted', 'elevated'] as const;
const TONES = [
  'primary',
  'accent',
  'info',
  'success',
  'warning',
  'danger',
  'merged',
  'draft',
] as const;
// The diff viewer paints code on the canvas and on hunk rows, never on a card.
const CODE_SURFACES = ['background', 'subtle', 'muted'] as const;

const gamma = (channel: number): number => {
  const encoded =
    channel <= 0.0031308 ? 12.92 * channel : 1.055 * Math.max(channel, 0) ** (1 / 2.4) - 0.055;
  return Math.min(1, Math.max(0, encoded));
};

type Rgb = readonly [number, number, number];

const oklchToSrgb = (lightness: number, chroma: number, hue: number): Rgb => {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
};

const linearise = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const relativeLuminance = ([r, g, b]: Rgb): number =>
  0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);

const contrast = (foreground: Rgb, background: Rgb): number => {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

type Palette = Readonly<Record<string, Rgb>>;

const swatch = (palette: Palette, token: string): Rgb => {
  const rgb = palette[token];
  if (rgb === undefined) {
    throw new Error(`styles.css has no --color-${token}`);
  }
  return rgb;
};

const readPalette = (block: string): Palette => {
  const palette: Record<string, Rgb> = {};
  const pattern = /--color-([a-z0-9-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)\s*;/g;
  for (const match of block.matchAll(pattern)) {
    palette[String(match[1])] = oklchToSrgb(Number(match[2]), Number(match[3]), Number(match[4]));
  }
  return palette;
};

const readThemes = (): Readonly<Record<'dark' | 'light', Palette>> => {
  const css = readFileSync(STYLES, 'utf8');
  const themeStart = css.indexOf('@theme {');
  const lightStart = css.indexOf("html[data-theme='light'] {");
  const dark = readPalette(css.slice(themeStart, lightStart));
  const light = { ...dark, ...readPalette(css.slice(lightStart, css.indexOf('\n}', lightStart))) };
  return { dark, light };
};

describe.each(Object.entries(readThemes()))('%s palette', (_theme, palette) => {
  it.each(SURFACES)('carries body and tone text at 4.5:1 on %s', (surface) => {
    const failures = ['foreground', 'muted-foreground', ...TONES]
      .map((token) => ({
        token,
        ratio: contrast(swatch(palette, token), swatch(palette, surface)),
      }))
      .filter(({ ratio }) => ratio < BODY_FLOOR);
    expect(failures).toEqual([]);
  });

  it.each(CODE_SURFACES)('keeps every syntax colour readable on %s', (surface) => {
    const failures = Object.keys(palette)
      .filter((token) => token.startsWith('syntax-'))
      .map((token) => ({
        token,
        ratio: contrast(swatch(palette, token), swatch(palette, surface)),
      }))
      .filter(({ ratio }) => ratio < BODY_FLOOR);
    expect(failures).toEqual([]);
  });

  it.each(SURFACES)('delineates controls with border at 3:1 on %s', (surface) => {
    expect(contrast(swatch(palette, 'border'), swatch(palette, surface))).toBeGreaterThanOrEqual(
      LARGE_FLOOR,
    );
  });

  it.each(SURFACES)('keeps the focus ring visible at 3:1 on %s', (surface) => {
    expect(
      contrast(swatch(palette, 'focus-ring'), swatch(palette, surface)),
    ).toBeGreaterThanOrEqual(LARGE_FLOOR);
  });

  it.each(TONES)('keeps %s solid fills readable', (tone) => {
    expect(
      contrast(swatch(palette, `${tone}-foreground`), swatch(palette, tone)),
    ).toBeGreaterThanOrEqual(BODY_FLOOR);
  });

  it('keeps primary inside the 200-275 hue band and accent off its clone', () => {
    const css = readFileSync(STYLES, 'utf8');
    const hues = [
      ...css.matchAll(/--color-(primary|accent):\s*oklch\([\d.]+\s+[\d.]+\s+([\d.]+)/g),
    ];
    expect(hues).toHaveLength(4);
    for (const [, , hue] of hues) {
      expect(Number(hue)).toBeGreaterThanOrEqual(200);
      expect(Number(hue)).toBeLessThanOrEqual(275);
    }
    expect(swatch(palette, 'primary')).not.toEqual(swatch(palette, 'accent'));
  });
});
