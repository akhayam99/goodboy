// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Rgb } from '../../test/colorMath';
import { contrastRatio, over, THEME_NAMES, tokenOf, type Theme } from '../../test/styleTokens';

const MIN_TEXT_CONTRAST = 4.5;
const MIN_FAINT_ON_SUBTLE = 4.6;
const TINT_ALPHA = 0.1;

const SYNTAX_TOKENS = [
  'syntax-keyword',
  'syntax-string',
  'syntax-number',
  'syntax-comment',
  'syntax-function',
  'syntax-type',
  'syntax-constant',
  'syntax-property',
  'syntax-operator',
  'syntax-punctuation',
  'syntax-tag',
  'syntax-regex',
] as const;

const SURFACES = ['chrome', 'background', 'subtle', 'muted', 'elevated'] as const;

const tinted = ({
  theme,
  tone,
  layers,
}: {
  readonly theme: Theme;
  readonly tone: 'success' | 'danger';
  readonly layers: number;
}): Rgb => {
  let base = tokenOf({ theme, name: 'background' }).rgb;
  for (let layer = 0; layer < layers; layer += 1) {
    base = over({ top: tokenOf({ theme, name: tone }).rgb, base, alpha: TINT_ALPHA });
  }
  return base;
};

const ratioOn = ({
  theme,
  name,
  background,
}: {
  readonly theme: Theme;
  readonly name: string;
  readonly background: Rgb;
}): number => contrastRatio({ first: tokenOf({ theme, name }).rgb, second: background });

describe.each(THEME_NAMES)('text contrast in %s', (theme) => {
  it.each(SURFACES)('faint foreground reads at 4.5:1 on %s', (surface) => {
    expect(
      ratioOn({
        theme,
        name: 'faint-foreground',
        background: tokenOf({ theme, name: surface }).rgb,
      }),
    ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each(['background', 'subtle', 'muted'] as const)(
    'faint foreground reads at 4.5:1 on a fill chip sunk into %s',
    (surface) => {
      const base = tokenOf({ theme, name: surface }).rgb;
      const fill = tokenOf({ theme, name: 'fill' });
      expect(
        ratioOn({
          theme,
          name: 'faint-foreground',
          background: over({ top: fill.rgb, base, alpha: fill.alpha }),
        }),
      ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    },
  );

  it('faint foreground reads at 4.6:1 on the subtle surface it sits on in panels', () => {
    expect(
      ratioOn({
        theme,
        name: 'faint-foreground',
        background: tokenOf({ theme, name: 'subtle' }).rgb,
      }),
    ).toBeGreaterThanOrEqual(MIN_FAINT_ON_SUBTLE);
  });

  it.each(SYNTAX_TOKENS)(
    '%s reads at 4.5:1 on an added and a removed line, word fill included',
    (name) => {
      for (const tone of ['success', 'danger'] as const) {
        for (const layers of [1, 2]) {
          expect(
            ratioOn({ theme, name, background: tinted({ theme, tone, layers }) }),
          ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
        }
      }
    },
  );

  it.each(SYNTAX_TOKENS)('%s reads at 4.5:1 on the plain diff background', (name) => {
    expect(
      ratioOn({ theme, name, background: tokenOf({ theme, name: 'background' }).rgb }),
    ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
});
