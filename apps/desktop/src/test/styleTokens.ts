import { readFileSync } from 'fs';
import { join } from 'path';
import { oklchToSrgb, type Rgb } from './colorMath';

export type Theme = 'dark' | 'light';

export type Token = { readonly rgb: Rgb; readonly alpha: number };

export const STYLES_PATH = join(__dirname, '..', 'styles.css');

export const THEME_NAMES: ReadonlyArray<Theme> = ['dark', 'light'];

type Declarations = ReadonlyMap<string, string>;

const OKLCH = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/;
const ALIAS = /^var\(--color-([a-z0-9-]+)\)$/;
const MIX = /^color-mix\(in oklab, var\(--color-([a-z0-9-]+)\) ([\d.]+)%, transparent\)$/;
const ALIAS_DEPTH = 8;

type ReadDeclarationsParams = { readonly block: string; readonly prefix: string };

const readDeclarations = ({ block, prefix }: ReadDeclarationsParams): Map<string, string> => {
  const declared = new Map<string, string>();
  for (const match of block.matchAll(new RegExp(`${prefix}([a-z0-9-]+):([^;]+);`, 'g'))) {
    declared.set(String(match[1]), String(match[2]).trim().replace(/\s+/g, ' '));
  }
  return declared;
};

type ResolveTokenParams = {
  readonly declared: Declarations;
  readonly name: string;
  readonly depth?: number;
};

export const resolveToken = ({ declared, name, depth = 0 }: ResolveTokenParams): Token | null => {
  const value = declared.get(name);
  if (value === undefined || depth > ALIAS_DEPTH) {
    return null;
  }
  if (value === 'transparent') {
    return { rgb: [0, 0, 0], alpha: 0 };
  }
  const oklch = value.match(OKLCH);
  if (oklch !== null) {
    return {
      rgb: oklchToSrgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3])),
      alpha: oklch[4] === undefined ? 1 : Number(oklch[4]),
    };
  }
  const alias = value.match(ALIAS);
  if (alias !== null) {
    return resolveToken({ declared, name: String(alias[1]), depth: depth + 1 });
  }
  const mix = value.match(MIX);
  if (mix === null) {
    return null;
  }
  const base = resolveToken({ declared, name: String(mix[1]), depth: depth + 1 });
  if (base === null) {
    return null;
  }
  return { rgb: base.rgb, alpha: (base.alpha * Number(mix[2])) / 100 };
};

type ThemeBlocks = Readonly<Record<Theme, string>>;

const GLOBAL_HEADERS: ReadonlyArray<string> = ['@theme {', ':root {'];
const LIGHT_HEADERS: ReadonlyArray<string> = ["html[data-theme='light'] {"];

type ReadBlocksParams = { readonly css: string; readonly headers: ReadonlyArray<string> };

const readBlocks = ({ css, headers }: ReadBlocksParams): string => {
  const blocks: string[] = [];
  for (const header of headers) {
    let start = css.indexOf(`\n${header}\n`);
    while (start !== -1) {
      const end = css.indexOf('\n}', start + 1);
      if (end === -1) {
        throw new Error(`styles.css has an unclosed ${header} block`);
      }
      blocks.push(css.slice(start, end));
      start = css.indexOf(`\n${header}\n`, end);
    }
  }
  return blocks.join('\n');
};

const readThemeBlocks = (): ThemeBlocks => {
  const css = readFileSync(STYLES_PATH, 'utf8');
  const dark = readBlocks({ css, headers: GLOBAL_HEADERS });
  return { dark, light: `${dark}\n${readBlocks({ css, headers: LIGHT_HEADERS })}` };
};

export const THEME_BLOCKS = readThemeBlocks();

const THEMES: Readonly<Record<Theme, Declarations>> = {
  dark: readDeclarations({ block: THEME_BLOCKS.dark, prefix: '--color-' }),
  light: readDeclarations({ block: THEME_BLOCKS.light, prefix: '--color-' }),
};

const SCALES: Readonly<Record<Theme, Declarations>> = {
  dark: readDeclarations({ block: THEME_BLOCKS.dark, prefix: '--' }),
  light: readDeclarations({ block: THEME_BLOCKS.light, prefix: '--' }),
};

export const tokenOf = ({
  theme,
  name,
}: {
  readonly theme: Theme;
  readonly name: string;
}): Token => {
  const token = resolveToken({ declared: THEMES[theme], name });
  if (token === null) {
    throw new Error(`styles.css has no resolvable --color-${name} in ${theme}`);
  }
  return token;
};

type ScaleStepParams = { readonly theme: Theme; readonly scale: string; readonly step: number };

export const scaleStepOf = ({ theme, scale, step }: ScaleStepParams): Rgb => {
  const value = SCALES[theme].get(`${scale}-${step}`);
  const match = value === undefined ? null : value.match(OKLCH);
  if (match === null || match[4] !== undefined) {
    throw new Error(`styles.css has no opaque --${scale}-${step} in ${theme}`);
  }
  return oklchToSrgb(Number(match[1]), Number(match[2]), Number(match[3]));
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
