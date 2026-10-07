// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  over,
  THEME_NAMES,
  tokenOf,
  type Theme,
} from '../../../../test/styleTokens';
import { SESSION_CARD_CLASS } from './sessionCard';

const MIN_CARD_CONTRAST = 1.25;

const tokenNamed = ({ pattern }: { readonly pattern: RegExp }): string => {
  const match = pattern.exec(SESSION_CARD_CLASS);
  if (match === null || match[1] === undefined) {
    throw new Error(`the card class has no ${pattern.source}`);
  }
  return match[1];
};

const surfaceName = tokenNamed({ pattern: /(?:^| )bg-([a-z-]+)(?: |$)/ });
const borderName = tokenNamed({ pattern: /(?:^| )border-(border-[a-z]+|border)(?: |$)/ });

const contrastOf = ({ theme, name }: { readonly theme: Theme; readonly name: string }): number =>
  contrastRatio({
    first: tokenOf({ theme, name }).rgb,
    second: tokenOf({ theme, name: 'chrome' }).rgb,
  });

describe('the selected session card in the sidebar', () => {
  it.each(THEME_NAMES)(
    'reads against the chrome in %s, by its surface or by its border, at 1.25:1',
    (theme) => {
      const surface = contrastOf({ theme, name: surfaceName });
      const border = contrastOf({ theme, name: borderName });

      expect(Math.max(surface, border)).toBeGreaterThanOrEqual(MIN_CARD_CONTRAST);
    },
  );

  it('draws a border at all, because the light surface alone is not enough', () => {
    expect(SESSION_CARD_CLASS).toMatch(/(^| )border( |$)/);
    expect(contrastOf({ theme: 'light', name: surfaceName })).toBeLessThan(MIN_CARD_CONTRAST);
  });

  it.each(THEME_NAMES)('keeps the selected row distinct from the card in %s', (theme) => {
    const card = tokenOf({ theme, name: surfaceName }).rgb;
    const selected = tokenOf({ theme, name: 'overlay-selected' });
    const row = over({ top: selected.rgb, base: card, alpha: selected.alpha });

    expect(contrastRatio({ first: row, second: card })).toBeGreaterThan(1.1);
  });

  it('keeps the rows where the old card put them, 4px in from the list edge', () => {
    expect(SESSION_CARD_CLASS).toContain('p-0.75');
    expect(SESSION_CARD_CLASS).toMatch(/(^| )border( |$)/);
  });
});
