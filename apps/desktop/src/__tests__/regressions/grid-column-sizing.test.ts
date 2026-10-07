// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const ROOTS = ['apps/desktop/src', 'packages/ui/src'];
const SKIPPED: ReadonlySet<string> = new Set(['node_modules', 'dist', 'target', 'gen']);
const BOUNDED_ROW = 'grid-rows-[minmax(0,1fr)]';
const QUOTED = /(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g;

const walk = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory).flatMap((entry) => {
    if (SKIPPED.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const isSource = (path: string): boolean => /\.tsx$/.test(path) && !/\.test\.tsx$/.test(path);

type Use = { readonly path: string; readonly classes: string };

const usesOf = (): ReadonlyArray<Use> =>
  ROOTS.flatMap((root) => walk(join(REPO_ROOT, root)))
    .filter(isSource)
    .flatMap((full) =>
      [...readFileSync(full, 'utf8').matchAll(QUOTED)]
        .map((match) => String(match[2]))
        .filter((classes) => classes.split(' ').includes(BOUNDED_ROW))
        .map((classes) => ({ path: relative(REPO_ROOT, full).split(sep).join('/'), classes })),
    );

describe('a grid that bounds one row also sizes its column', () => {
  it('finds the grids that bound a row, never an empty sweep', () => {
    expect(usesOf().length).toBeGreaterThan(0);
  });

  it('gives every grid with a bounded row an explicit column, so long text cannot widen it', () => {
    const unsized = usesOf().filter(
      ({ classes }) => !classes.split(' ').some((name) => name.startsWith('grid-cols-')),
    );

    expect(unsized.map(({ path }) => path)).toEqual([]);
  });

  it('lets that column shrink below its content with minmax(0,1fr)', () => {
    const unbounded = usesOf().filter(
      ({ classes }) =>
        !classes.split(' ').some((name) => name.startsWith('grid-cols-[minmax(0,1fr)')),
    );

    expect(unbounded.map(({ path }) => path)).toEqual([]);
  });
});
