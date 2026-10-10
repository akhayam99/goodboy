// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist', 'test']);
const PRODUCERS = new Set(['shared/names.ts', 'features/plans/planPrimaryOf.ts']);

const RUN_PLAN_NAME = /NAMES\.runPlan|['"`]Run plan['"`]/;

const isSource = (entry: string): boolean =>
  /\.tsx?$/.test(entry) && !/\.(test|rows|runner)\.tsx?$/.test(entry);

const listSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, acc);
    } else if (isSource(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

describe('the Run plan label', () => {
  it('is produced by planPrimaryOf and nowhere else, so no surface offers it on its own', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(DESKTOP_SRC)) {
      const name = relative(DESKTOP_SRC, file);
      if (PRODUCERS.has(name) || name.includes('/scenes/')) {
        continue;
      }
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (RUN_PLAN_NAME.test(line)) {
            offenders.push(`${name}:${index + 1} ${line.trim()}`);
          }
        });
    }
    expect(
      offenders,
      `Run plan is a plan primary. Ask planPrimaryOf for the label instead of writing it:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
