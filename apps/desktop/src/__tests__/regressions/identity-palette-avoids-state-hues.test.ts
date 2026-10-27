// @vitest-environment node
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

  it('gives every agent token a value no other agent, tone or accent shares', () => {
    const css = readFileSync(STYLES, 'utf8');
    const lightStart = css.indexOf("html[data-theme='light'] {");
    const themes = [css.slice(0, lightStart), css.slice(lightStart)];
    const tokens = [
      ...new Set([...css.matchAll(/--color-(agent-[a-z-]+):/g)].map((match) => match[1] ?? '')),
    ];
    const reserved = ['primary', 'info', 'merged', 'draft', 'success', 'warning', 'danger'];

    expect(tokens.length).toBeGreaterThan(10);
    for (const scope of themes) {
      const values = [...scope.matchAll(/--color-([a-z0-9-]+): (oklch\([^)]+\))/g)].map(
        (match) => ({ token: match[1] ?? '', value: match[2] ?? '' }),
      );
      for (const token of tokens) {
        const own = values.filter((entry) => entry.token === token).map((entry) => entry.value);
        const clashes = values.filter(
          (entry) =>
            entry.token !== token &&
            (entry.token.startsWith('agent-') || reserved.includes(entry.token)) &&
            own.includes(entry.value),
        );
        expect(clashes.map((entry) => `${token}=${entry.token}`)).toEqual([]);
      }
    }
  });
});
