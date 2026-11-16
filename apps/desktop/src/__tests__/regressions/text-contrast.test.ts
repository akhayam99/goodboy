// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Rgb } from '../../test/colorMath';
import { contrastRatio, over, THEME_NAMES, tokenOf, type Theme } from '../../test/styleTokens';

const MIN_TEXT_CONTRAST = 4.5;
const MIN_FAINT_ON_SUBTLE = 4.6;

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

const CODE_FILLS: ReadonlyArray<ReadonlyArray<string>> = [
  ['diff-add-line'],
  ['diff-add-line', 'diff-add-word'],
  ['diff-remove-line'],
  ['diff-remove-line', 'diff-remove-word'],
];

const GUTTER_FILLS = ['diff-add-gutter', 'diff-remove-gutter'] as const;

const layered = ({
  theme,
  fills,
}: {
  readonly theme: Theme;
  readonly fills: ReadonlyArray<string>;
}): Rgb =>
  fills.reduce(
    (base, name) => {
      const fill = tokenOf({ theme, name });
      return over({ top: fill.rgb, base, alpha: fill.alpha });
    },
    tokenOf({ theme, name: 'background' }).rgb,
  );

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
  it.each(['foreground', 'faint-foreground'])(
    'reads at 4.5:1 as %s on the floating surface of a label tooltip',
    (name) => {
      expect(
        ratioOn({ theme, name, background: tokenOf({ theme, name: 'floating' }).rgb }),
      ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    },
  );

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
      for (const fills of CODE_FILLS) {
        expect(
          ratioOn({ theme, name, background: layered({ theme, fills }) }),
        ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      }
    },
  );

  it.each(GUTTER_FILLS)('the faint line number reads at 4.5:1 on %s', (fill) => {
    expect(
      ratioOn({ theme, name: 'faint-foreground', background: layered({ theme, fills: [fill] }) }),
    ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each(SYNTAX_TOKENS)('%s reads at 4.5:1 on the plain diff background', (name) => {
    expect(
      ratioOn({ theme, name, background: tokenOf({ theme, name: 'background' }).rgb }),
    ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
});
