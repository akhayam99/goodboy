import { readFileSync } from 'fs';
import { join } from 'path';
import { oklchToSrgb, type Rgb } from './colorMath';

export type Theme = 'dark' | 'light';

export type Token = { readonly rgb: Rgb; readonly alpha: number };

export const STYLES_PATH = join(__dirname, '..', 'styles.css');

export const THEME_NAMES: ReadonlyArray<Theme> = ['dark', 'light'];

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
  const css = readFileSync(STYLES_PATH, 'utf8');
  const themeStart = css.indexOf('@theme {');
  const lightStart = css.indexOf("html[data-theme='light'] {");
  const dark = readTokens(css.slice(themeStart, lightStart));
  const light = readTokens(css.slice(lightStart, css.indexOf('\n}', lightStart)));
  return { dark, light: { ...dark, ...light } };
};

const THEMES = readThemes();

export const tokenOf = ({
  theme,
  name,
}: {
  readonly theme: Theme;
  readonly name: string;
}): Token => {
  const token = THEMES[theme][name];
  if (token === undefined) {
    throw new Error(`styles.css has no oklch --color-${name} in ${theme}`);
  }
  return token;
};

export const over = ({
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

const linear = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const luminance = (rgb: Rgb): number =>
  0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);

export const contrastRatio = ({
  first,
  second,
}: {
  readonly first: Rgb;
  readonly second: Rgb;
}): number => {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
};
