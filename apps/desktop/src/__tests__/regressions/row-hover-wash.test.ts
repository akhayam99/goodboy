// @vitest-environment node
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import type { Rgb } from '../../test/colorMath';
import { over, STYLES_PATH, THEME_NAMES, tokenOf, type Theme } from '../../test/styleTokens';

const STYLES = STYLES_PATH;
const LEVELS = 255;
const MIN_HOVER_LEVELS = 18;
const MIN_SELECTED_OVER_HOVER_LEVELS = 6;
const SOFT_TINT_ALPHA = 0.05;

const levelsBetween = ({ first, second }: { readonly first: Rgb; readonly second: Rgb }): number =>
  LEVELS * Math.max(...first.map((channel, index) => Math.abs(channel - (second[index] ?? 0))));

const washOf = ({
  theme,
  overlay,
  base,
}: {
  readonly theme: Theme;
  readonly overlay: 'overlay-hover' | 'overlay-selected';
  readonly base: Rgb;
}): number => {
  const token = tokenOf({ theme, name: overlay });
  return levelsBetween({
    first: base,
    second: over({ top: token.rgb, base, alpha: token.alpha }),
  });
};

type Row = { readonly name: string; readonly base: (theme: Theme) => Rgb };

const ROWS: ReadonlyArray<Row> = [
  { name: 'a rest row on background', base: (theme) => tokenOf({ theme, name: 'background' }).rgb },
  { name: 'a rest row on subtle', base: (theme) => tokenOf({ theme, name: 'subtle' }).rgb },
  {
    name: 'a waiting row (warning tint)',
    base: (theme) =>
      over({
        top: tokenOf({ theme, name: 'warning' }).rgb,
        base: tokenOf({ theme, name: 'background' }).rgb,
        alpha: SOFT_TINT_ALPHA,
      }),
  },
  {
    name: 'an unread row (primary tint)',
    base: (theme) =>
      over({
        top: tokenOf({ theme, name: 'primary' }).rgb,
        base: tokenOf({ theme, name: 'background' }).rgb,
        alpha: SOFT_TINT_ALPHA,
      }),
  },
];

describe.each(THEME_NAMES)('the row hover wash in %s', (theme) => {
  it.each(ROWS)('moves $name by at least 18 of 255 levels', ({ base }) => {
    expect(washOf({ theme, overlay: 'overlay-hover', base: base(theme) })).toBeGreaterThanOrEqual(
      MIN_HOVER_LEVELS,
    );
  });

  it.each(ROWS)('keeps the selected wash clearly above the hover wash on $name', ({ base }) => {
    const hover = washOf({ theme, overlay: 'overlay-hover', base: base(theme) });
    const selected = washOf({ theme, overlay: 'overlay-selected', base: base(theme) });

    expect(selected - hover).toBeGreaterThanOrEqual(MIN_SELECTED_OVER_HOVER_LEVELS);
  });
});

describe('the hover layer', () => {
  it('stays one background-image gradient on the shared token', () => {
    const css = readFileSync(STYLES, 'utf8');

    expect(css).toMatch(
      /@utility bg-hover \{\s*background-image: linear-gradient\(var\(--color-overlay-hover\), var\(--color-overlay-hover\)\);/,
    );
  });

  it('is declared for both themes and the brand chip', () => {
    const css = readFileSync(STYLES, 'utf8');

    expect(css.match(/--color-overlay-hover:/g)).toHaveLength(3);
  });
});
