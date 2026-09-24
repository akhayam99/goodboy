import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SOURCE_ROOTS = [
  join(REPO_ROOT, 'apps', 'desktop', 'src'),
  join(REPO_ROOT, 'packages', 'ui', 'src'),
];
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist', 'audit']);
const STRING_LITERAL = /(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g;
const ARBITRARY_TRACKING = /\btracking-\[/;

const listSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, acc);
      continue;
    }
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

const problemsIn = (source: string): ReadonlyArray<string> => {
  const problems: string[] = [];
  if (ARBITRARY_TRACKING.test(source)) {
    problems.push('arbitrary tracking value; use tracking-eyebrow');
  }
  for (const match of source.matchAll(STRING_LITERAL)) {
    const tokens = (match[2] ?? '').split(/\s+/);
    if (tokens.includes('uppercase') && tokens.includes('tracking-wide')) {
      problems.push('uppercase with tracking-wide; use Eyebrow or tracking-eyebrow');
    }
  }
  return problems;
};

describe('uppercase labels use the eyebrow grade', () => {
  it('never hand-rolls uppercase tracking outside tracking-eyebrow', () => {
    const offenders = SOURCE_ROOTS.flatMap((root) =>
      listSourceFiles(root).flatMap((file) =>
        problemsIn(readFileSync(file, 'utf8')).map(
          (problem) => `${relative(REPO_ROOT, file).split(sep).join('/')}: ${problem}`,
        ),
      ),
    );
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
