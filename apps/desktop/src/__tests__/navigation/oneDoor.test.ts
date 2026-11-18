// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const SCANNED_ROOTS = ['features', 'app', 'shared'];
const RAIL_ROOT = join(SRC, 'app', 'components', 'ShellLeft');
const SESSION_RAIL_ROOT = join(SRC, 'app', 'components', 'SessionRail');
const SESSIONS_ROOT = join(SRC, 'features', 'workspace', 'components', 'SessionsPopover');
const GOODBOY_CHIP_ROOT = join(SRC, 'app', 'components', 'GoodboyChip');
const BELL_ROOT = join(SRC, 'features', 'notifications', 'components', 'NotificationCenter');
const TOP_BAR_ROOT = join(SRC, 'app', 'components', 'AppTopBar');
const SIGN_ROOTS = [
  RAIL_ROOT,
  SESSION_RAIL_ROOT,
  SESSIONS_ROOT,
  GOODBOY_CHIP_ROOT,
  BELL_ROOT,
  TOP_BAR_ROOT,
];
const SESSION_RAIL_PREFIX = 'app/components/SessionRail/';

const SHOWN_ROWS: ReadonlySet<string> = new Set([
  'app/components/SessionRail/SessionLevel/BranchRowLine.tsx',
  'app/components/SessionRail/SessionLevel/LevelLinked.tsx',
  'app/components/SessionRail/SessionLevel/LinkedTaskRow/index.tsx',
]);

const CURRENT_MARK = "isCurrent ? 'page' : undefined";
const SHOWN_MARK = "isShown ? 'page' : undefined";

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
  const railSources = walk(RAIL_ROOT).map((path) => ({
    path: pathOf(path),
    source: readFileSync(path, 'utf8'),
  }));
  const signSources = SIGN_ROOTS.flatMap((root) => walk(root)).map((path) => ({
    path: pathOf(path),
    source: readFileSync(path, 'utf8'),
  }));

  const marksOf = () =>
    signSources.flatMap(({ path, source }) =>
      Array.from(
        source.matchAll(/(?:aria-current|ariaCurrent)=(?:\{([^}]*)\}|"([^"]*)")/g),
        (match) => ({ path, expression: match[1] ?? `"${match[2]}"` }),
      ),
    );

  it('lights a row only from isCurrent, never from its own state, on the places rail, the session rail and Sessions', () => {
    const marks = marksOf();
    expect(marks.length).toBeGreaterThan(0);
    expect(
      marks
        .filter(({ expression }) => expression !== CURRENT_MARK && expression !== SHOWN_MARK)
        .map(({ path, expression }) => `${path}: ${expression}`),
    ).toEqual([]);
  });

  it('lets only the session rail branch and linked rows light from the shown work', () => {
    const shown = marksOf().filter(({ expression }) => expression === SHOWN_MARK);

    expect(shown.map(({ path }) => path).sort()).toEqual([...SHOWN_ROWS].sort());
  });

  it('derives every place current from the one column place', () => {
    const currents = railSources.flatMap(({ path, source }) =>
      Array.from(source.matchAll(/isCurrent=\{([^}]*)\}/g), (match) => `${path}: ${match[1]}`),
    );
    expect(currents.length).toBeGreaterThan(0);
    expect(currents.filter((current) => !/place === /.test(current))).toEqual([]);
  });

  it('keeps the session rail on its own sign: the shown worktree, or never current', () => {
    const railSessionSources = signSources.filter(({ path }) =>
      path.startsWith(SESSION_RAIL_PREFIX),
    );

    expect(
      railSessionSources
        .filter(({ source }) => /isCurrent=\{/.test(source))
        .map(({ path }) => path),
    ).toEqual([]);
  });

  it('lights the logo for Help and the bell for Notifications, from the same place', () => {
    const rail = signSources.find(({ path }) => path === 'app/components/ShellLeft/index.tsx');
    const topBar = signSources.find(({ path }) => path === 'app/components/AppTopBar/index.tsx');
    const help = "isCurrent={place === 'help'}";

    expect(rail?.source).toContain(help);
    expect(topBar?.source).toContain('useColumnPlace()');
    expect(topBar?.source).toContain("isCurrent={place === 'notifications'}");
  });

  it('lights the places rail from the one column place, the Board standing for an open session', () => {
    const rail = signSources.find(({ path }) => path === 'app/components/ShellLeft/index.tsx');
    const railPlace = readFileSync(join(SRC, 'shared', 'navigation', 'railPlaceOf.ts'), 'utf8');

    expect(rail?.source).toContain(
      'const columnPlace = placeOverride === undefined ? storePlace : placeOverride;',
    );
    expect(rail?.source).toContain('railPlaceOf({ place: columnPlace })');
    expect(rail?.source).toContain('isCurrent={place === door.id}');
    expect(rail?.source).toContain("isCurrent={place === 'new'}");
    expect(railPlace).toContain("place === null ? 'board' : place");
  });

  it('reads the place from one selector, the same one the places rail reads', () => {
    const shellLeft = readFileSync(join(RAIL_ROOT, 'index.tsx'), 'utf8');
    const placeReaders = SCANNED_ROOTS.flatMap((root) => walk(join(SRC, root))).filter((path) =>
      readFileSync(path, 'utf8').includes('columnPlaceOf('),
    );

    const hook = readFileSync(join(SRC, 'app', 'hooks', 'useColumnPlace', 'index.ts'), 'utf8');

    expect(shellLeft).toContain('useColumnPlace()');
    expect(hook).toContain('selectColumnPlace({ state })');
    expect(placeReaders.map((path) => relative(SRC, path).split(sep).join('/'))).toEqual([
      'shared/navigation/selectColumnPlace.ts',
    ]);
  });
});
