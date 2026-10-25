// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { oklchToSrgb, type Rgb } from '../../test/colorMath';

const STYLES = join(__dirname, '..', '..', 'styles.css');

const BODY_FLOOR = 4.5;
const BORDER_FLOOR = 3;
const FRAME_EDGE_FLOOR = 2;
const SURFACES = [
  'chrome',
  'background',
  'drawer',
  'subtle',
  'muted',
  'elevated',
  'floating',
] as const;

type Paint = { readonly rgb: Rgb; readonly alpha: number };

const linearise = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const luminance = ([r, g, b]: Rgb): number =>
  0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);

const contrast = ({ first, second }: { first: Rgb; second: Rgb }): number => {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

const over = ({ paint, surface }: { paint: Paint; surface: Rgb }): Rgb => [
  paint.rgb[0] * paint.alpha + surface[0] * (1 - paint.alpha),
  paint.rgb[1] * paint.alpha + surface[1] * (1 - paint.alpha),
  paint.rgb[2] * paint.alpha + surface[2] * (1 - paint.alpha),
];

const OKLCH =
  /--color-([a-z0-9-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)\s*;/g;
const ALIAS = /--color-([a-z0-9-]+):\s*var\(--color-([a-z0-9-]+)\)\s*;/g;

type Tokens = Record<string, Paint>;

const readTokens = ({ block, into }: { block: string; into: Tokens }): Tokens => {
  const next: Tokens = { ...into };
  for (const match of block.matchAll(OKLCH)) {
    next[String(match[1])] = {
      rgb: oklchToSrgb(Number(match[2]), Number(match[3]), Number(match[4])),
      alpha: match[5] === undefined ? 1 : Number(match[5]),
    };
  }
  for (const match of block.matchAll(ALIAS)) {
    const source = next[String(match[2])];
    if (source === undefined) {
      throw new Error(`styles.css has no --color-${String(match[2])} to alias`);
    }
    next[String(match[1])] = source;
  }
  return next;
};

const blockAt = ({ css, opening }: { css: string; opening: string }): string => {
  const start = css.indexOf(opening);
  if (start < 0) {
    throw new Error(`styles.css has no ${opening}`);
  }
  return css.slice(start, css.indexOf('\n}', start));
};

const css = readFileSync(STYLES, 'utf8');
const darkBase = readTokens({
  block: css.slice(css.indexOf('@theme {'), css.indexOf("html[data-theme='light'] {")),
  into: {},
});
const lightBase = readTokens({
  block: blockAt({ css, opening: "html[data-theme='light'] {" }),
  into: darkBase,
});
const darkMore = readTokens({
  block: blockAt({ css, opening: "html[data-contrast='more'] {" }),
  into: darkBase,
});
const lightMore = readTokens({
  block: blockAt({ css, opening: "html[data-theme='light'][data-contrast='more'] {" }),
  into: readTokens({
    block: blockAt({ css, opening: "html[data-contrast='more'] {" }),
    into: lightBase,
  }),
});

const THEMES = [
  { theme: 'dark', base: darkBase, more: darkMore },
  { theme: 'light', base: lightBase, more: lightMore },
] as const;

const token = ({ tokens, name }: { tokens: Tokens; name: string }): Paint => {
  const paint = tokens[name];
  if (paint === undefined) {
    throw new Error(`styles.css has no --color-${name}`);
  }
  return paint;
};

const solid = ({ tokens, name }: { tokens: Tokens; name: string }): Rgb =>
  token({ tokens, name }).rgb;

describe.each(THEMES)('more contrast in the $theme palette', ({ base, more }) => {
  it.each(SURFACES)('draws the soft border at 3:1 on %s', (surface) => {
    const parent = solid({ tokens: more, name: surface });
    const painted = over({ paint: token({ tokens: more, name: 'border-soft' }), surface: parent });

    expect(contrast({ first: painted, second: parent })).toBeGreaterThanOrEqual(BORDER_FLOOR);
  });

  it.each(SURFACES)('lifts idle marks and disabled text to body contrast on %s', (surface) => {
    const parent = solid({ tokens: more, name: surface });

    for (const name of ['idle', 'disabled-foreground']) {
      expect(
        contrast({ first: solid({ tokens: more, name }), second: parent }),
        `${name} on ${surface}`,
      ).toBeGreaterThanOrEqual(BODY_FLOOR);
    }
  });

  it.each(['chrome', 'background'])('draws the frame edge at 2:1 on %s', (surface) => {
    const parent = solid({ tokens: more, name: surface });
    const painted = over({ paint: token({ tokens: more, name: 'frame-edge' }), surface: parent });

    expect(contrast({ first: painted, second: parent })).toBeGreaterThanOrEqual(FRAME_EDGE_FLOOR);
  });

  it('raises the hover and selected washes one step and keeps text readable on them', () => {
    expect(token({ tokens: more, name: 'overlay-hover' }).alpha).toBeGreaterThan(
      token({ tokens: base, name: 'overlay-hover' }).alpha,
    );
    expect(token({ tokens: more, name: 'overlay-selected' }).alpha).toBeGreaterThan(
      token({ tokens: base, name: 'overlay-selected' }).alpha,
    );
    for (const surface of SURFACES) {
      const parent = solid({ tokens: more, name: surface });
      const hovered = over({
        paint: token({ tokens: more, name: 'overlay-hover' }),
        surface: parent,
      });
      const selected = over({
        paint: token({ tokens: more, name: 'overlay-selected' }),
        surface: parent,
      });
      expect(
        contrast({ first: solid({ tokens: more, name: 'muted-foreground' }), second: hovered }),
        `muted text on hover over ${surface}`,
      ).toBeGreaterThanOrEqual(BODY_FLOOR);
      expect(
        contrast({ first: solid({ tokens: more, name: 'foreground' }), second: selected }),
        `text on selected over ${surface}`,
      ).toBeGreaterThanOrEqual(BODY_FLOOR);
    }
  });

  it('leaves the standard palette softer than the more-contrast one', () => {
    const background = solid({ tokens: base, name: 'background' });
    const standard = contrast({
      first: over({ paint: token({ tokens: base, name: 'border-soft' }), surface: background }),
      second: background,
    });
    const raised = contrast({
      first: over({ paint: token({ tokens: more, name: 'border-soft' }), surface: background }),
      second: background,
    });

    expect(raised).toBeGreaterThan(standard);
  });
});
