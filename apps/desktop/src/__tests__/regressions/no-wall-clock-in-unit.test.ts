// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  countMatches,
  grownEntries,
  nonZero,
  readBaseline,
  testSources,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const BASELINE_FILE = 'no-wall-clock-in-unit.baseline.json';
const WALL_CLOCK_BUDGET =
  /\bexpect\(\s*(?:(?:performance|Date)\.now\(\)[^;)]*|\w*[eE]lapsed\w*)\)\s*\.toBeLessThan(?:OrEqual)?\(/g;

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      testSources()
        .filter(({ path }) => !/\.perf\.test\.tsx?$/.test(path))
        .map(({ path, text }) => [path, countMatches({ text, pattern: WALL_CLOCK_BUDGET })]),
    ),
  });

describe('a unit test never asserts a time budget', () => {
  it('counts a clock read compared with a budget, and leaves a size bound alone', () => {
    const count = (text: string): number => countMatches({ text, pattern: WALL_CLOCK_BUDGET });
    const budget = ['.toBe', 'LessThan(500);'].join('');
    expect(count(`expect(performance.now() - startedAt)${budget}`)).toBe(1);
    expect(count(`expect(Date.now() - started)${budget}`)).toBe(1);
    expect(count(`expect(elapsed)${budget}`)).toBe(1);
    expect(count(`expect(result.length)${budget}`)).toBe(0);
  });

  it('adds no time budget to a unit test beyond the baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      `A time budget fails when the runner is loaded, not when the code is slow. Move it to a *.perf.test.ts file and keep the result assertion in the unit test. docs/testing.md, No stopwatch in the gate, has the rule.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
