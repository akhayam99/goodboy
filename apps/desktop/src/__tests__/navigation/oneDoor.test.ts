// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const SCANNED_ROOTS = ['features', 'app', 'shared'];
const COLUMN_ROOT = join(SRC, 'app', 'components', 'SideColumn');

const INTERNAL_MOVES = /\b(setActiveLens|setCurrentSession|selectAgent|setSessionStudio)\b/;

const isSource = (path: string): boolean =>
  /\.(ts|tsx)$/.test(path) &&
  !/\.test\.(ts|tsx)$/.test(path) &&
  !path.includes(`${sep}__tests__${sep}`);

const walk = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return walk(path);
    }
    return isSource(path) ? [path] : [];
  });

describe('one door for navigation', () => {
  it('moves only through navigate, back, forward, up and amendFocus outside the navigation slice', () => {
    const offenders = SCANNED_ROOTS.flatMap((root) => walk(join(SRC, root)))
      .filter((path) => INTERNAL_MOVES.test(readFileSync(path, 'utf8')))
      .map((path) => relative(SRC, path).split(sep).join('/'));
    expect(offenders).toEqual([]);
  });
});

describe('one selected sign across the column doors', () => {
  const columnSources = walk(COLUMN_ROOT).map((path) => ({
    path: relative(SRC, path).split(sep).join('/'),
    source: readFileSync(path, 'utf8'),
  }));

  it('lights a door only from isCurrent, never from its own state', () => {
    const marks = columnSources.flatMap(({ path, source }) =>
      Array.from(source.matchAll(/aria-current=\{([^}]*)\}/g), (match) => `${path}: ${match[1]}`),
    );
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.filter((mark) => !mark.includes("isCurrent ? 'page' : undefined"))).toEqual([]);
  });

  it('derives every door current from the one column place', () => {
    const currents = columnSources.flatMap(({ path, source }) =>
      Array.from(source.matchAll(/isCurrent=\{([^}]*)\}/g), (match) => `${path}: ${match[1]}`),
    );
    expect(currents.length).toBeGreaterThan(0);
    expect(currents.filter((current) => !/place === /.test(current))).toEqual([]);
  });

  it('reads the place from one selector, the same one the rail and the peek read', () => {
    const shellLeft = readFileSync(join(COLUMN_ROOT, 'ShellLeft.tsx'), 'utf8');
    const placeReaders = SCANNED_ROOTS.flatMap((root) => walk(join(SRC, root))).filter((path) =>
      readFileSync(path, 'utf8').includes('columnPlaceOf('),
    );

    expect(shellLeft).toContain('useColumnPlace()');
    expect(placeReaders.map((path) => relative(SRC, path).split(sep).join('/'))).toEqual([
      'app/hooks/useColumnPlace/index.ts',
    ]);
  });
});
