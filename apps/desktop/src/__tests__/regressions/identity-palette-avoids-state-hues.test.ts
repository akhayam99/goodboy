import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const STYLES = join(__dirname, '..', '..', 'styles.css');

const MIN_HUE_DISTANCE = 30;

const huesOf = ({ css, token }: { readonly css: string; readonly token: string }) =>
  [...css.matchAll(new RegExp(`--color-${token}: oklch\\([\\d.]+ [\\d.]+ ([\\d.]+)\\)`, 'g'))].map(
    (match) => Number(match[1]),
  );

const hueDistance = ({ first, second }: { readonly first: number; readonly second: number }) => {
  const distance = Math.abs(first - second) % 360;
  return Math.min(distance, 360 - distance);
};

describe('identity palette', () => {
  it('keeps every lane hue away from the warning and danger hues', () => {
    const css = readFileSync(STYLES, 'utf8');
    const identities = huesOf({ css, token: 'identity-\\d' });
    const states = [...huesOf({ css, token: 'warning' }), ...huesOf({ css, token: 'danger' })];

    expect(identities).toHaveLength(16);
    expect(states.length).toBeGreaterThan(0);
    for (const identity of identities) {
      for (const state of states) {
        expect(hueDistance({ first: identity, second: state })).toBeGreaterThanOrEqual(
          MIN_HUE_DISTANCE,
        );
      }
    }
  });
});
