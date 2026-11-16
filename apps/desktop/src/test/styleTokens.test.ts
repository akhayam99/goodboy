// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { oklchToSrgb } from './colorMath';
import { resolveToken, scaleStepOf, THEME_NAMES, tokenOf } from './styleTokens';

const DECLARED = new Map([
  ['danger', 'oklch(0.5 0.19 22)'],
  ['border', 'oklch(1 0 0 / 0.4)'],
  ['danger-solid', 'var(--color-danger)'],
  ['border-control', 'var(--color-border)'],
  ['danger-subtle', 'color-mix(in oklab, var(--color-danger) 10%, transparent)'],
  ['border-wash', 'color-mix(in oklab, var(--color-border-control) 50%, transparent)'],
  ['gutter', 'transparent'],
  ['loop', 'var(--color-loop)'],
  ['selection', 'Highlight'],
]);

describe('resolveToken', () => {
  it('follows an alias to the token it names', () => {
    expect(resolveToken({ declared: DECLARED, name: 'danger-solid' })).toEqual({
      rgb: oklchToSrgb(0.5, 0.19, 22),
      alpha: 1,
    });
    expect(resolveToken({ declared: DECLARED, name: 'border-control' })).toEqual({
      rgb: oklchToSrgb(1, 0, 0),
      alpha: 0.4,
    });
  });

  it('reads a color-mix toward transparent as the same color at that alpha', () => {
    expect(resolveToken({ declared: DECLARED, name: 'danger-subtle' })).toEqual({
      rgb: oklchToSrgb(0.5, 0.19, 22),
      alpha: 0.1,
    });
    expect(resolveToken({ declared: DECLARED, name: 'border-wash' })?.alpha).toBeCloseTo(0.2);
  });

  it('reads transparent as zero alpha', () => {
    expect(resolveToken({ declared: DECLARED, name: 'gutter' })?.alpha).toBe(0);
  });

  it('returns null for a loop, a missing token and a system color', () => {
    expect(resolveToken({ declared: DECLARED, name: 'loop' })).toBeNull();
    expect(resolveToken({ declared: DECLARED, name: 'missing' })).toBeNull();
    expect(resolveToken({ declared: DECLARED, name: 'selection' })).toBeNull();
  });
});

describe('the styles.css reader', () => {
  it.each(THEME_NAMES)('resolves an alias against the %s theme', (theme) => {
    expect(tokenOf({ theme, name: 'focus-ring' })).toEqual(tokenOf({ theme, name: 'primary' }));
  });

  it('reads a raw scale step per theme', () => {
    expect(scaleStepOf({ theme: 'light', scale: 'gray', step: 1 })).not.toEqual(
      scaleStepOf({ theme: 'dark', scale: 'gray', step: 1 }),
    );
  });
});
