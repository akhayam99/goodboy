// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'gen']);
const RETIRED = /\b(boardTileChipOf|boardTileActionOf|boardSettledWordOf)\b/;
const OWN_PATH = '__tests__/regressions/branch-row-has-one-owner.test.ts';

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

describe('the branch row has one owner', () => {
  it('lets branchRowOf pick the word and the action, so the old pickers never come back', () => {
    const offenders = walk({ directory: DESKTOP_SRC })
      .filter((file) => /\.tsx?$/.test(file))
      .map((file) => relative(DESKTOP_SRC, file).split(sep).join('/'))
      .filter((path) => path !== OWN_PATH)
      .filter((path) => RETIRED.test(readFileSync(join(DESKTOP_SRC, path), 'utf8')));

    expect(offenders).toEqual([]);
  });
});
