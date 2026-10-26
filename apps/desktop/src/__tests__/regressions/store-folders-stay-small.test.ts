// @vitest-environment node
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const STORE_DIR = join(__dirname, '..', '..', 'store');
const ROOTS: ReadonlyArray<string> = ['slices', 'runtime'];
const MAX_FLAT_FILES = 60;

const ALLOWED: Readonly<Record<string, number>> = {
  'runtime/auto': 94,
  'slices/project-mounts': 70,
  'slices/resolve': 109,
  'slices/turn': 102,
  'slices/workflows': 101,
};

const isFlatSource = (name: string): boolean => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name);

type FolderParams = {
  readonly directory: string;
};

const flatSourcesIn = ({ directory }: FolderParams): number =>
  readdirSync(directory).filter(
    (name) => isFlatSource(name) && statSync(join(directory, name)).isFile(),
  ).length;

const measure = (): Readonly<Record<string, number>> =>
  Object.fromEntries(
    ROOTS.flatMap((root) => {
      const rootDirectory = join(STORE_DIR, root);
      if (!existsSync(rootDirectory)) {
        return [];
      }
      return readdirSync(rootDirectory)
        .filter((name) => statSync(join(rootDirectory, name)).isDirectory())
        .map(
          (name) =>
            [`${root}/${name}`, flatSourcesIn({ directory: join(rootDirectory, name) })] as const,
        );
    }),
  );

describe('a store folder stays small', () => {
  it('reads every slice and runtime folder, never an empty sweep', () => {
    const sizes = measure();

    expect(Object.keys(sizes).length).toBeGreaterThan(80);
    expect(Object.keys(sizes)).toContain('runtime/auto');
    expect(Object.keys(sizes)).toContain('slices/resolve');
  });

  it(`holds at most ${MAX_FLAT_FILES} flat source files, beyond the allowlist`, () => {
    const grown = Object.entries(measure()).flatMap(([folder, count]) => {
      const limit = Math.max(ALLOWED[folder] ?? 0, MAX_FLAT_FILES);
      return count > limit ? [`  - ${folder}: ${count} (allowed ${limit})`] : [];
    });

    expect(
      grown,
      `group the files of one concern in a folder inside the slice, with index.ts the only ` +
        `registration point (docs/file-system.md, Store slices). The allowlist only ` +
        `shrinks:\n${grown.join('\n')}`,
    ).toEqual([]);
  });

  it('drops an allowlist entry once its folder is small enough', () => {
    const current = measure();
    const stale = Object.entries(ALLOWED).flatMap(([folder, allowed]) => {
      const count = current[folder] ?? 0;
      return count < allowed ? [`  - ${folder}: ${count} (allowed ${allowed})`] : [];
    });

    expect(stale, `lower or delete these entries:\n${stale.join('\n')}`).toEqual([]);
  });
});
