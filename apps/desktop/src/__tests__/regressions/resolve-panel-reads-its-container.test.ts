import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const RESOLVE = join(SRC, 'features', 'resolve');
const VIEWPORT_BREAKPOINT = /(?<![@\w-])(sm|md|lg|xl|2xl):[\w[]/;

const isSource = (path: string): boolean =>
  /\.(ts|tsx)$/.test(path) && !/\.test\.(ts|tsx)$/.test(path);

const walk = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return walk(path);
    }
    return isSource(path) ? [path] : [];
  });

describe('the resolve panel reads its container, never the viewport', () => {
  it('keeps viewport breakpoints out of features/resolve', () => {
    const offenders = walk(RESOLVE)
      .filter((path) => VIEWPORT_BREAKPOINT.test(readFileSync(path, 'utf8')))
      .map((path) => relative(SRC, path).split(sep).join('/'));
    expect(offenders).toEqual([]);
  });
});
