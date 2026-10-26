// @vitest-environment node
import { existsSync, readdirSync } from 'fs';
import { basename, dirname, join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  grownEntries,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const DESKTOP_SRC = join(__dirname, '..', '..');
const KEY_PREFIX = 'apps/desktop/src/';

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'gen',
  'MockScene',
  '__tests__',
]);

const FLAT_PAIRS_BASELINE = 'flat-component-pairs.baseline.json';
const INDEX_ONLY_BASELINE = 'index-only-folders.baseline.json';
const KEBAB_BASELINE = 'kebab-modules.baseline.json';
const HOOK_FOLDERS_BASELINE = 'hook-folders-under-hooks.baseline.json';

type TreeEntry = {
  readonly path: string;
  readonly isDirectory: boolean;
};

type PathParams = {
  readonly path: string;
};

type TreeParams = {
  readonly entries: ReadonlyArray<TreeEntry>;
};

const walk = ({ directory }: { readonly directory: string }): ReadonlyArray<TreeEntry> => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry.name)) {
      return [];
    }
    const full = join(directory, entry.name);
    const path = relative(DESKTOP_SRC, full).split(sep).join('/');
    return entry.isDirectory()
      ? [{ path, isDirectory: true }, ...walk({ directory: full })]
      : [{ path, isDirectory: false }];
  });
};

const isHookFolderName = ({ path }: PathParams): boolean => /^use[A-Z]/.test(basename(path));

const flatComponentPairs = ({ entries }: TreeParams): ReadonlyArray<string> => {
  const files = new Set(entries.filter((entry) => !entry.isDirectory).map((entry) => entry.path));
  return [...files].filter(
    (path) =>
      /^[A-Z][A-Za-z0-9]*\.tsx$/.test(basename(path)) &&
      files.has(path.replace(/\.tsx$/, '.test.tsx')),
  );
};

const indexOnlyFolders = ({ entries }: TreeParams): ReadonlyArray<string> => {
  const byFolder = new Map<string, string[]>();
  for (const entry of entries.filter((item) => !item.isDirectory)) {
    byFolder.set(dirname(entry.path), [...(byFolder.get(dirname(entry.path)) ?? []), entry.path]);
  }
  return [...byFolder.entries()]
    .filter(
      ([folder, paths]) =>
        paths.length === 1 &&
        basename(paths[0] ?? '') === 'index.tsx' &&
        !isHookFolderName({ path: folder }),
    )
    .map(([, paths]) => paths[0] ?? '');
};

const kebabModules = ({ entries }: TreeParams): ReadonlyArray<string> =>
  entries
    .filter((entry) => !entry.isDirectory)
    .map((entry) => entry.path)
    .filter(
      (path) =>
        /^[a-z0-9]+(-[a-z0-9]+)+\.ts$/.test(basename(path)) && !/\.(test|d)\.ts$/.test(path),
    );

const hookFoldersOutsideHooks = ({ entries }: TreeParams): ReadonlyArray<string> =>
  entries
    .filter((entry) => entry.isDirectory && isHookFolderName({ path: entry.path }))
    .map((entry) => entry.path)
    .filter((path) => {
      const parent = basename(dirname(path));
      return parent !== 'hooks' && !/^[A-Z]/.test(parent);
    });

const toCounts = ({ paths }: { readonly paths: ReadonlyArray<string> }): FileCounts =>
  Object.fromEntries([...paths].sort().map((path) => [`${KEY_PREFIX}${path}`, 1] as const));

const entries = (): ReadonlyArray<TreeEntry> => walk({ directory: DESKTOP_SRC });

type LedgerParams = {
  readonly file: string;
  readonly measure: (params: TreeParams) => ReadonlyArray<string>;
  readonly hint: string;
};

const expectLedgerOnlyFalls = ({ file, measure, hint }: LedgerParams): void => {
  const current = toCounts({ paths: measure({ entries: entries() }) });
  if (IS_UPDATING) {
    writeBaseline({ file, counts: current });
    return;
  }
  const baseline = readBaseline({ file });
  const grown = grownEntries({ current, baseline });
  const stale = Object.keys(baseline)
    .filter((key) => current[key] === undefined)
    .map((key) => `  - ${key}: gone, delete it from ${file}`);
  expect([...grown, ...stale], `${hint}\n${[...grown, ...stale].join('\n')}`).toEqual([]);
};

describe('folder and naming conventions only ever shrink', () => {
  it('finds a flat component and test pair', () => {
    const tree: ReadonlyArray<TreeEntry> = [
      { path: 'a/Panel.tsx', isDirectory: false },
      { path: 'a/Panel.test.tsx', isDirectory: false },
      { path: 'a/Lonely.tsx', isDirectory: false },
      { path: 'a/helper.test.ts', isDirectory: false },
    ];
    expect(flatComponentPairs({ entries: tree })).toEqual(['a/Panel.tsx']);
  });

  it('finds a folder that holds only index.tsx and leaves a hook folder alone', () => {
    const tree: ReadonlyArray<TreeEntry> = [
      { path: 'a/Panel/index.tsx', isDirectory: false },
      { path: 'a/Full/index.tsx', isDirectory: false },
      { path: 'a/Full/index.test.tsx', isDirectory: false },
      { path: 'a/useThing/index.tsx', isDirectory: false },
    ];
    expect(indexOnlyFolders({ entries: tree })).toEqual(['a/Panel/index.tsx']);
  });

  it('finds a kebab-case module and not a test or a declaration file', () => {
    const tree: ReadonlyArray<TreeEntry> = [
      { path: 'a/turn-errors.ts', isDirectory: false },
      { path: 'a/turn-errors.test.ts', isDirectory: false },
      { path: 'a/types.d.ts', isDirectory: false },
      { path: 'a/turnErrors.ts', isDirectory: false },
    ];
    expect(kebabModules({ entries: tree })).toEqual(['a/turn-errors.ts']);
  });

  it('finds a hook folder that is neither under hooks nor inside a component folder', () => {
    const tree: ReadonlyArray<TreeEntry> = [
      { path: 'features/a/useThing', isDirectory: true },
      { path: 'features/a/hooks/useThing', isDirectory: true },
      { path: 'features/a/components/Panel/useThing', isDirectory: true },
    ];
    expect(hookFoldersOutsideHooks({ entries: tree })).toEqual(['features/a/useThing']);
  });

  it('holds the flat pairs to the baseline: a component with a test is a folder', () => {
    expectLedgerOnlyFalls({
      file: FLAT_PAIRS_BASELINE,
      measure: flatComponentPairs,
      hint: 'A component with a test is a folder: Name/index.tsx and Name/index.test.tsx (docs/file-system.md, The folder rule).',
    });
  });

  it('holds the index-only folders to the baseline: a lone index.tsx is a flat file', () => {
    expectLedgerOnlyFalls({
      file: INDEX_ONLY_BASELINE,
      measure: indexOnlyFolders,
      hint: 'A folder that holds only index.tsx is a flat Name.tsx (docs/file-system.md, Components).',
    });
  });

  it('holds the kebab-case modules to the baseline: a module is camelCase', () => {
    expectLedgerOnlyFalls({
      file: KEBAB_BASELINE,
      measure: kebabModules,
      hint: 'A new module is camelCase and named after its main export (docs/file-system.md, Naming).',
    });
  });

  it('holds the hook folders to the baseline: a hook lives under hooks or beside its component', () => {
    expectLedgerOnlyFalls({
      file: HOOK_FOLDERS_BASELINE,
      measure: hookFoldersOutsideHooks,
      hint: 'A use* folder lives in the feature hooks/ folder, or inside the component folder it belongs to (docs/file-system.md, Hooks).',
    });
  });
});
