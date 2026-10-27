// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'gen']);
const DIRECT_READ = /(?<![.\w])worktreeStatus\(/g;
const OWNERS: ReadonlySet<string> = new Set([
  'features/worktree/worktree.ts',
  'store/runtime/worktreeStatuses/cache.ts',
]);

const ALLOWED: Readonly<Record<string, number>> = {
  'features/diff/hooks/useSessionDiff/index.ts': 1,
  'store/runtime/auto/makeAutoRuntime.ts': 1,
  'store/slices/resolve/beginResolveCandidate.ts': 1,
  'store/slices/resolve/drainResolveQueue.ts': 2,
  'store/slices/resolve/publication/preparePublication.ts': 1,
  'store/slices/resolve/publication/publicationDrift.ts': 1,
  'store/slices/resolve/recordResolveAttempt.ts': 1,
  'store/slices/resolve/recoverUncapturedResolveWork.ts': 1,
  'store/slices/resolve/runResolveCheck.ts': 3,
  'store/slices/resolve/verifiedPush.ts': 1,
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
  !path.endsWith('/storyHarness.ts') &&
  !path.endsWith('/mockFixtureData.ts') &&
  !OWNERS.has(path);

const productSources = (): ReadonlyArray<string> =>
  walk(DESKTOP_SRC).map(toPath).filter(isProductSource);

const countDirectReads = (text: string): number => (text.match(DIRECT_READ) ?? []).length;

const measure = (): Readonly<Record<string, number>> =>
  Object.fromEntries(
    productSources()
      .map(
        (path) => [path, countDirectReads(readFileSync(join(DESKTOP_SRC, path), 'utf8'))] as const,
      )
      .filter(([, count]) => count > 0),
  );

describe('git state of a worktree is read through the cache', () => {
  it('scans the store and the features, never an empty sweep', () => {
    const sources = productSources();

    expect(sources.some((path) => path.startsWith('store/slices/'))).toBe(true);
    expect(sources.some((path) => path.startsWith('features/'))).toBe(true);
    expect(sources).not.toContain('store/runtime/worktreeStatuses/cache.ts');
  });

  it('recognises a direct call, and neither a method nor a longer name', () => {
    expect(countDirectReads('const s = await worktreeStatus({ worktreePath });')).toBe(1);
    expect(countDirectReads('const s = await deps.worktreeStatus(found);')).toBe(0);
    expect(countDirectReads('const s = await readWorktreeStatusNow({ worktreePath });')).toBe(0);
    expect(countDirectReads('const s = await refreshworktreeStatus(x);')).toBe(0);
  });

  it('adds no direct call beyond the allowlist', () => {
    const grown = Object.entries(measure()).flatMap(([path, count]) => {
      const allowed = ALLOWED[path] ?? 0;
      return count > allowed ? [`  - ${path}: ${count} (allowed ${allowed})`] : [];
    });

    expect(
      grown,
      `read the git state of a worktree with readWorktreeStatusNow, ensure or read from ` +
        `store/runtime/worktreeStatuses/cache.ts, so every surface shares one answer ` +
        `(docs/file-system.md, Store slices). The allowlist only shrinks:\n${grown.join('\n')}`,
    ).toEqual([]);
  });

  it('drops an allowlist entry once its direct call is gone', () => {
    const current = measure();
    const stale = Object.entries(ALLOWED).flatMap(([path, allowed]) => {
      const count = current[path] ?? 0;
      return count < allowed ? [`  - ${path}: ${count} (allowed ${allowed})`] : [];
    });

    expect(stale, `lower or delete these entries:\n${stale.join('\n')}`).toEqual([]);
  });
});
