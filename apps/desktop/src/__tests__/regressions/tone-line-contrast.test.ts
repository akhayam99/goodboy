// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contrastRatio, THEME_NAMES, tokenOf } from '../../test/styleTokens';

const MIN_GRAPHIC_CONTRAST = 3;

describe('the warning tone line', () => {
  it.each(THEME_NAMES)('clears 3:1 against the content background in %s', (theme) => {
    const ratio = contrastRatio({
      first: tokenOf({ theme, name: 'warning-mark' }).rgb,
      second: tokenOf({ theme, name: 'background' }).rgb,
    });

    expect(ratio).toBeGreaterThanOrEqual(MIN_GRAPHIC_CONTRAST);
  });

  it('is softer than the text amber in light, so a line does not read brick red', () => {
    const text = contrastRatio({
      first: tokenOf({ theme: 'light', name: 'warning' }).rgb,
      second: tokenOf({ theme: 'light', name: 'background' }).rgb,
    });
    const line = contrastRatio({
      first: tokenOf({ theme: 'light', name: 'warning-mark' }).rgb,
      second: tokenOf({ theme: 'light', name: 'background' }).rgb,
    });

    expect(line).toBeLessThan(text);
  });

  it('stays the same amber as the text in dark', () => {
    expect(tokenOf({ theme: 'dark', name: 'warning-mark' }).rgb).toEqual(
      tokenOf({ theme: 'dark', name: 'warning' }).rgb,
    );
  });
});
