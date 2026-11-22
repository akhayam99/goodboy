// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../..', import.meta.url));
const OVERLAP = join(SRC, 'features', 'overlap');
const IMPORTS_OVERLAP = /from '[^']*\/overlap\/[^']*'/;
const MERGE_PATH = /merge|pr-series|prSeries/i;
const SOURCE = /\.tsx?$/;

type WalkParams = {
  readonly dir: string;
};

const walk = ({ dir }: WalkParams): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return walk({ dir: path });
    }
    return SOURCE.test(name) && !name.includes('.test.') ? [path] : [];
  });

describe('the overlap warning', () => {
  it('is never read by a merge path, so it cannot stop a merge', () => {
    const readers = walk({ dir: SRC })
      .filter((path) => !path.startsWith(OVERLAP))
      .filter((path) => IMPORTS_OVERLAP.test(readFileSync(path, 'utf8')))
      .map((path) => relative(SRC, path));

    expect(readers.filter((path) => MERGE_PATH.test(path))).toEqual([]);
  });

  it('reaches no merge action itself', () => {
    const reaches = walk({ dir: OVERLAP }).filter((path) =>
      /from '[^']*(pr-series|prSeries|mergePullRequest|mergeSeries)[^']*'/.test(
        readFileSync(path, 'utf8'),
      ),
    );

    expect(reaches).toEqual([]);
  });
});
