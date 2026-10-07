// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { oklchToSrgb, type Rgb } from '../../test/colorMath';

const STYLES = join(__dirname, '..', '..', 'styles.css');
const LEVELS = 255;
const MIN_HOVER_LEVELS = 18;
const MIN_SELECTED_OVER_HOVER_LEVELS = 6;
const SOFT_TINT_ALPHA = 0.05;

type Token = { readonly rgb: Rgb; readonly alpha: number };

type Theme = 'dark' | 'light';

const readTokens = (block: string): Readonly<Record<string, Token>> => {
  const tokens: Record<string, Token> = {};
  const pattern =
    /--color-([a-z0-9-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)\s*;/g;
  for (const match of block.matchAll(pattern)) {
    tokens[String(match[1])] = {
      rgb: oklchToSrgb(Number(match[2]), Number(match[3]), Number(match[4])),
      alpha: match[5] === undefined ? 1 : Number(match[5]),
    };
  }
  return tokens;
};

const readThemes = (): Readonly<Record<Theme, Readonly<Record<string, Token>>>> => {
  const css = readFileSync(STYLES, 'utf8');
  const themeStart = css.indexOf('@theme {');
  const lightStart = css.indexOf("html[data-theme='light'] {");
  const dark = readTokens(css.slice(themeStart, lightStart));
  const light = readTokens(css.slice(lightStart, css.indexOf('\n}', lightStart)));
  return { dark, light: { ...dark, ...light } };
};

const THEMES = readThemes();

const tokenOf = ({ theme, name }: { readonly theme: Theme; readonly name: string }): Token => {
  const token = THEMES[theme][name];
  if (token === undefined) {
    throw new Error(`styles.css has no oklch --color-${name} in ${theme}`);
  }
  return token;
};

const over = ({
  top,
  base,
  alpha,
}: {
  readonly top: Rgb;
  readonly base: Rgb;
  readonly alpha: number;
}): Rgb => [
  top[0] * alpha + base[0] * (1 - alpha),
  top[1] * alpha + base[1] * (1 - alpha),
  top[2] * alpha + base[2] * (1 - alpha),
];

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

const THEME_NAMES: ReadonlyArray<Theme> = ['dark', 'light'];

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
