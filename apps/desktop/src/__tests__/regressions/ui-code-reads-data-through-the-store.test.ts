// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'gen']);
const DATABASE_HANDLE_IMPORT = /import\s*\{[^}]*\btauriDatabase\b[^}]*\}\s*from/g;
const DB_IMPORT = /import\s*(type\s*)?\{([^}]*)\}\s*from\s*'@goodboy\/db'/g;
const HOOK_NAME = /^use[A-Z]/;

const DATABASE_HANDLE_ALLOWED: Readonly<Record<string, number>> = {
  'features/auto/chat/useAutoTreeCap/index.ts': 1,
  'features/auto/plan/useAutoPlanApproval/index.ts': 1,
  'features/auto/useAutoTreeLimit/index.ts': 1,
  'features/impact/hooks/useImpactMetrics/index.ts': 1,
  'features/palette/hooks/useSessionsEverywhere.ts': 1,
  'features/resolve/hooks/useResolveDeliveryReceipts/index.ts': 1,
  'features/suggestions/useNextStepOutcomes/index.ts': 1,
  'features/workflows/components/WorkflowRulesPanel/DefaultAutoLimitSetting/index.tsx': 1,
  'features/workflows/hooks/useRemovedBuiltins/index.ts': 1,
  'shared/components/NewWorkspaceForm/folderConflictOf.ts': 1,
};

const DB_VALUE_IMPORT_ALLOWED: Readonly<Record<string, number>> = {
  'app/components/BootSplash/NewerDatabaseScreen.tsx': 1,
  'features/impact/hooks/useImpactMetrics/index.ts': 1,
  'features/palette/hooks/useSessionsEverywhere.ts': 1,
  'features/resolve/hooks/useResolveDeliveryReceipts/index.ts': 1,
  'features/suggestions/useNextStepOutcomes/index.ts': 1,
  'features/workflows/hooks/useRemovedBuiltins/index.ts': 1,
  'shared/components/NewWorkspaceForm/folderConflictOf.ts': 1,
};

const walk = (directory: string): ReadonlyArray<string> => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
};

const toPath = (full: string): string => relative(DESKTOP_SRC, full).split(sep).join('/');

const isProductSource = (path: string): boolean =>
  /\.tsx?$/.test(path) &&
  !path.endsWith('.d.ts') &&
  !/\.test\.tsx?$/.test(path) &&
  !path.startsWith('__tests__/') &&
  !path.startsWith('test/') &&
  !path.includes('/MockScene/') &&
  !path.startsWith('store/');

const isUiFile = (path: string): boolean => {
  if (!isProductSource(path)) {
    return false;
  }
  const segments = path.split('/');
  const base = segments[segments.length - 1] ?? '';
  const stem = base.replace(/\.tsx?$/, '');
  const folder = segments[segments.length - 2] ?? '';
  return (
    segments.includes('components') ||
    segments.includes('hooks') ||
    segments[0] === 'app' ||
    HOOK_NAME.test(stem) ||
    (stem === 'index' && HOOK_NAME.test(folder)) ||
    base.endsWith('.tsx')
  );
};

const uiSources = (): ReadonlyArray<string> => walk(DESKTOP_SRC).map(toPath).filter(isUiFile);

const countDatabaseHandleImports = (text: string): number =>
  (text.match(DATABASE_HANDLE_IMPORT) ?? []).length;

const countDbValueImports = (text: string): number =>
  [...text.matchAll(DB_IMPORT)].filter((match) => {
    if (match[1] !== undefined) {
      return false;
    }
    return (match[2] ?? '')
      .split(',')
      .map((name) => name.trim())
      .some((name) => name !== '' && !name.startsWith('type '));
  }).length;

type CountParams = {
  readonly count: (text: string) => number;
};

const measure = ({ count }: CountParams): Readonly<Record<string, number>> =>
  Object.fromEntries(
    uiSources()
      .map((path) => [path, count(readFileSync(join(DESKTOP_SRC, path), 'utf8'))] as const)
      .filter(([, total]) => total > 0),
  );

type GrowthParams = {
  readonly current: Readonly<Record<string, number>>;
  readonly allowed: Readonly<Record<string, number>>;
};

const grownOf = ({ current, allowed }: GrowthParams): ReadonlyArray<string> =>
  Object.entries(current).flatMap(([path, total]) => {
    const limit = allowed[path] ?? 0;
    return total > limit ? [`  - ${path}: ${total} (allowed ${limit})`] : [];
  });

const staleOf = ({ current, allowed }: GrowthParams): ReadonlyArray<string> =>
  Object.entries(allowed).flatMap(([path, limit]) => {
    const total = current[path] ?? 0;
    return total < limit ? [`  - ${path}: ${total} (allowed ${limit})`] : [];
  });

describe('UI code reads data through the store', () => {
  it('scans components, hooks and the shell, never an empty sweep', () => {
    const sources = uiSources();

    expect(sources.some((path) => path.includes('/components/'))).toBe(true);
    expect(sources.some((path) => path.includes('/hooks/'))).toBe(true);
    expect(sources.some((path) => path.startsWith('app/'))).toBe(true);
    expect(sources.some((path) => path.startsWith('store/'))).toBe(false);
  });

  it('recognises the database handle and a value import of the db package', () => {
    expect(countDatabaseHandleImports("import { tauriDatabase } from '../../shared/lib/db';")).toBe(
      1,
    );
    expect(countDatabaseHandleImports("import { other } from '../../shared/lib/db';")).toBe(0);
    expect(countDbValueImports("import { listThings } from '@goodboy/db';")).toBe(1);
    expect(countDbValueImports("import { type Thing, listThings } from '@goodboy/db';")).toBe(1);
    expect(countDbValueImports("import type { Thing } from '@goodboy/db';")).toBe(0);
    expect(countDbValueImports("import { type Thing } from '@goodboy/db';")).toBe(0);
  });

  it('adds no component or hook that holds the database handle', () => {
    const grown = grownOf({
      current: measure({ count: countDatabaseHandleImports }),
      allowed: DATABASE_HANDLE_ALLOWED,
    });

    expect(
      grown,
      `a component or a hook reads and writes through a store action, so the write names its ` +
        `target, applies after success and is tested once (docs/file-system.md, Store slices). ` +
        `The allowlist only shrinks:\n${grown.join('\n')}`,
    ).toEqual([]);
  });

  it('adds no component or hook that imports a value from the db package', () => {
    const grown = grownOf({
      current: measure({ count: countDbValueImports }),
      allowed: DB_VALUE_IMPORT_ALLOWED,
    });

    expect(
      grown,
      `a component or a hook calls a store action instead of a db function. The allowlist ` +
        `only shrinks:\n${grown.join('\n')}`,
    ).toEqual([]);
  });

  it('drops an allowlist entry once its import is gone', () => {
    const stale = [
      ...staleOf({
        current: measure({ count: countDatabaseHandleImports }),
        allowed: DATABASE_HANDLE_ALLOWED,
      }),
      ...staleOf({
        current: measure({ count: countDbValueImports }),
        allowed: DB_VALUE_IMPORT_ALLOWED,
      }),
    ];

    expect(stale, `lower or delete these entries:\n${stale.join('\n')}`).toEqual([]);
  });
});
