// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const SCANNED_ROOTS = ['features', 'app', 'shared'];
const COLUMN_ROOT = join(SRC, 'app', 'components', 'SideColumn');
const SESSION_RAIL_ROOT = join(SRC, 'app', 'components', 'SessionRail');
const SESSION_LIST_ROOT = join(SRC, 'features', 'workspace', 'components', 'SessionActivityBar');
const SIGN_ROOTS = [COLUMN_ROOT, SESSION_RAIL_ROOT, SESSION_LIST_ROOT];
const SESSION_RAIL_PREFIX = 'app/components/SessionRail/';

const SESSION_LEVEL_PAGES: ReadonlySet<string> = new Set([
  'app/components/SessionRail/RailSessionLevel.tsx',
  'app/components/SessionRail/RailWorktreeButton.tsx',
  'app/components/SessionRail/RailBranchesButton.tsx',
]);

const INTERNAL_MOVES = /\b(setActiveLens|setCurrentSession|selectAgent)\b/;

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

const pathOf = (path: string): string => relative(SRC, path).split(sep).join('/');

describe('one selected sign across the navigation surfaces', () => {
  const columnSources = walk(COLUMN_ROOT).map((path) => ({
    path: pathOf(path),
    source: readFileSync(path, 'utf8'),
  }));
  const signSources = SIGN_ROOTS.flatMap((root) => walk(root)).map((path) => ({
    path: pathOf(path),
    source: readFileSync(path, 'utf8'),
  }));

  it('lights a row only from isCurrent, never from its own state, in the column, the session rail and the session list', () => {
    const marks = signSources.flatMap(({ path, source }) =>
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

  it('keeps the session rail on its own sign: the session pages sign, the shown worktree, or never current', () => {
    const railSources = signSources.filter(({ path }) => path.startsWith(SESSION_RAIL_PREFIX));
    const marked = railSources.filter(({ source }) => /isCurrent=\{/.test(source));

    expect(marked.map(({ path }) => path).sort()).toEqual([...SESSION_LEVEL_PAGES].sort());
    const level = railSources.find(
      ({ path }) => path === 'app/components/SessionRail/RailSessionLevel.tsx',
    );
    expect(level?.source).toContain('currentSignOf(');
    expect(level?.source).toContain('sign === page.id');
  });

  it('lights the New session row from the draft selector, never from its own state', () => {
    const row = signSources.find(({ path }) =>
      path.endsWith('SessionActivityBar/NewSessionRow.tsx'),
    );
    expect(row?.source).toContain('selectIsSessionDraftShown(');
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
