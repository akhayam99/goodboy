// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { countMatches, testSources } from './scanControls';

const SKIPPED_TEST =
  /\b(?:it|test|describe)(?:\.concurrent)?\.(?:skip|only|todo|skipIf|fails)\b|\b(?:xit|xtest|xdescribe)\(/g;

const count = (text: string): number => countMatches({ text, pattern: SKIPPED_TEST });

describe('no test is skipped, focused or left as a todo', () => {
  it('counts a skip, a focus, a todo and the x aliases, and leaves a plain test alone', () => {
    expect(count(['it', '.skip', "('a', () => {});"].join(''))).toBe(1);
    expect(count(['describe', '.only', "('a', () => {});"].join(''))).toBe(1);
    expect(count(['test', '.todo', "('a');"].join(''))).toBe(1);
    expect(count(['it', '.skipIf', "(isCi)('a', () => {});"].join(''))).toBe(1);
    expect(count(['x', "it('a', () => {});"].join(''))).toBe(1);
    expect(count("it('a', () => {}); it.each([1])('b', () => {}); fit() {}")).toBe(0);
  });

  it('finds no skipped, focused or todo test in the repository', () => {
    const offenders = testSources()
      .map(({ path, text }) => [path, count(text)] as const)
      .filter(([, found]) => found > 0)
      .map(([path, found]) => `  - ${path}: ${found}`);
    expect(
      offenders,
      `A skipped or focused test hides a failure or the rest of its file. Fix it or delete it. docs/testing.md, Content and rules, has the rule.\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
