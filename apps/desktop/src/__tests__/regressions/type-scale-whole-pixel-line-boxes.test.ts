import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const STYLES = join(__dirname, '..', '..', 'styles.css');

const css = readFileSync(STYLES, 'utf8');

const readTokenPx = ({ token }: { token: string }): number => {
  const match = new RegExp(`${token}:\\s*(\\d+(?:\\.\\d+)?)px\\s*;`).exec(css);
  if (match === null) {
    throw new Error(`styles.css must declare ${token} as a px value`);
  }
  return Number(match[1]);
};

const hasToken = ({ token }: { token: string }): boolean => new RegExp(`${token}:`).test(css);

const rootFontSizePx = (): number => {
  const match = /#root\s*\{[^}]*font-size:\s*(\d+(?:\.\d+)?)px/.exec(css);
  if (match === null) {
    throw new Error('styles.css must declare the root font size in px');
  }
  return Number(match[1]);
};

const ROOT_PX = rootFontSizePx();
const SPACING_PX = readTokenPx({ token: '--spacing' });

const isWhole = (value: number): boolean => Number.isInteger(value);

const leadingPx = ({ step }: { step: number }): number => step * SPACING_PX;

const PINNED_GRADES = ['3xs', '2xs', 'sm'] as const;

const UNPINNED_GRADES = ['xs', 'base', 'lg', 'xl'] as const;

const CORRECTED_ROW_LEADING_STEPS = [4, 5] as const;

describe('type scale line boxes on the corrected surfaces', () => {
  it('reads a 15px root, the size the pinned line boxes were chosen against', () => {
    expect(ROOT_PX).toBe(15);
  });

  it('keeps every pinned line box a whole pixel and taller than its glyph', () => {
    for (const grade of PINNED_GRADES) {
      const size = readTokenPx({ token: `--text-${grade}` });
      const lineHeight = readTokenPx({ token: `--text-${grade}--line-height` });

      expect(isWhole(lineHeight)).toBe(true);
      expect(lineHeight).toBeGreaterThan(size);
    }
  });

  it('leaves text-xs unpinned, which is why a repeated row pairs its own leading', () => {
    expect(hasToken({ token: '--text-xs--line-height' })).toBe(false);
    expect(readTokenPx({ token: '--text-xs' }) * 1.55).not.toBe(
      Math.round(readTokenPx({ token: '--text-xs' }) * 1.55),
    );
  });

  it('names every unpinned grade, so a row reaching for one knows to pair a leading', () => {
    for (const grade of UNPINNED_GRADES) {
      expect(hasToken({ token: `--text-${grade}--line-height` })).toBe(false);
    }
  });

  it('resolves the leading a corrected row pairs to a whole pixel', () => {
    for (const step of CORRECTED_ROW_LEADING_STEPS) {
      const box = leadingPx({ step });

      expect(isWhole(box)).toBe(true);
      expect(box).toBeGreaterThan(readTokenPx({ token: '--text-xs' }));
    }
  });

  it('matches the paired leading to the pinned box of the grade above it', () => {
    expect(leadingPx({ step: 4 })).toBe(readTokenPx({ token: '--text-2xs--line-height' }));
    expect(leadingPx({ step: 5 })).toBe(readTokenPx({ token: '--text-sm--line-height' }));
  });

  it('declares the spacing base in px, so a leading utility never follows the root', () => {
    expect(css).toContain(`--spacing: ${SPACING_PX}px;`);
    expect(isWhole(SPACING_PX)).toBe(true);
  });
});
