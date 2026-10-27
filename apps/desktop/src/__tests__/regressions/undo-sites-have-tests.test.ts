// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, dirname, join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'gen']);
const UNDO_CALL = /\bundoable\(/;
const UNDO_OWNER = 'shared/utils/undoable.ts';

const EXEMPT: ReadonlyArray<string> = [
  'features/resolve/components/FixCommentsDrawer/OutcomeFixProposed.tsx',
  'features/storage/components/BranchesSection/index.tsx',
  'features/suggestions/useSuggestionRunner/index.ts',
  'features/workflows/components/WorkflowStudio/SavedStepsList/index.tsx',
  'features/workflows/components/WorkflowsPanel/useWorkflowEditor/index.ts',
  'features/workflows/deleteWorkflowWithUndo.ts',
  'store/slices/starred-issues/index.ts',
];

type Walk = Readonly<{ directory: string }>;

const walk = ({ directory }: Walk): ReadonlyArray<string> => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk({ directory: full }) : [full];
  });
};

type PathOf = Readonly<{ path: string }>;

const toPath = ({ path }: PathOf): string => relative(DESKTOP_SRC, path).split(sep).join('/');

const isTestFile = ({ path }: PathOf): boolean => /\.test\.tsx?$/.test(path);

const isUndoSite = ({ path }: PathOf): boolean =>
  /\.tsx?$/.test(path) &&
  !path.endsWith('.d.ts') &&
  !isTestFile({ path }) &&
  !path.startsWith('__tests__/') &&
  !path.startsWith('app/components/MockScene/') &&
  path !== UNDO_OWNER;

const readSource = ({ path }: PathOf): string => readFileSync(join(DESKTOP_SRC, path), 'utf8');

const ownerName = ({ path }: PathOf): string => {
  const name = basename(path).replace(/\.tsx?$/, '');
  return name === 'index' ? basename(dirname(path)) : name;
};

type Paths = Readonly<{ paths: ReadonlyArray<string> }>;

const sitesFrom = ({ paths }: Paths): ReadonlyArray<string> =>
  paths.filter((path) => isUndoSite({ path }) && UNDO_CALL.test(readSource({ path })));

const hasTest = ({ site, paths }: Paths & Readonly<{ site: string }>): boolean => {
  const folder = dirname(site);
  const name = ownerName({ path: site });
  return paths
    .filter((path) => isTestFile({ path }) && !path.startsWith('__tests__/regressions/'))
    .some((path) => {
      const text = readSource({ path });
      const isBeside = dirname(path) === folder;
      const isUndoTest = /undo/i.test(text);
      return isBeside ? isUndoTest || text.includes(name) : isUndoTest && text.includes(name);
    });
};

describe('every undoable( site is pinned by a test', () => {
  const paths = walk({ directory: DESKTOP_SRC }).map((path) => toPath({ path }));
  const sites = sitesFrom({ paths });
  const untested = sites.filter((site) => !hasTest({ site, paths }));

  it('finds the sites', () => {
    expect(sites.length).toBeGreaterThan(20);
  });

  it('has a test next to each site, naming undo or the site, except the listed ones', () => {
    const unlisted = untested.filter((site) => !EXEMPT.includes(site));

    expect(unlisted).toEqual([]);
  });

  it('lists only sites that still lack a test, so the list only shrinks', () => {
    const settled = EXEMPT.filter((site) => !untested.includes(site));

    expect(settled).toEqual([]);
  });
});
