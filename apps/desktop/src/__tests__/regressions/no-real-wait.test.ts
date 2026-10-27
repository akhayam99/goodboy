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

const BASELINE_FILE = 'no-real-wait.baseline.json';
const REAL_WAIT =
  /new Promise(?:<[^>]*>)?\(\s*\(?\w+\)?\s*=>\s*(?:\{\s*)?(?:void\s+)?setTimeout\(/g;
const FAKE_CLOCK = /\buseFakeTimers\b/;

const count = (text: string): number => countMatches({ text, pattern: REAL_WAIT });

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      testSources()
        .filter(({ text }) => !FAKE_CLOCK.test(text))
        .map(({ path, text }) => [path, count(text)]),
    ),
  });

describe('a test waits on a condition or a fake clock, never on real time', () => {
  it('counts a promise that resolves on a timer, and leaves a timer under test alone', () => {
    expect(count(['await new Promise((resolve) => ', 'setTimeout(resolve, 10));'].join(''))).toBe(
      1,
    );
    expect(count(['await new Promise<void>((r) => ', '{ setTimeout(r, 50); });'].join(''))).toBe(1);
    expect(count('await new Promise((resolve) => queueMicrotask(resolve));')).toBe(0);
    expect(count('const id = setTimeout(done, 10);')).toBe(0);
  });

  it('adds no real wait beyond the baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      `Use fake timers or wait on the condition (waitFor, findBy). docs/testing.md, Content and rules, has the rule.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
