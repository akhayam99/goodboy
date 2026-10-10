// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  grownEntries,
  nonZero,
  productSources,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const BASELINE_FILE = 'fill-child-uses-min-h-0.baseline.json';
const SCOPES = ['apps/desktop/src/features/', 'apps/desktop/src/shared/'];
const CLASS_LITERAL = /(["'`])((?:(?!\1)[^\n])*?)\1/g;

type CountParams = {
  readonly text: string;
};

const countFillRoots = ({ text }: CountParams): number =>
  [...text.matchAll(CLASS_LITERAL)].filter(
    ([, , literal]) =>
      (literal ?? '').includes('flex h-full flex-col') && !(literal ?? '').includes('min-h-0'),
  ).length;

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources()
        .filter(
          ({ path }) => SCOPES.some((scope) => path.startsWith(scope)) && path.endsWith('.tsx'),
        )
        .map(({ path, text }) => [path, countFillRoots({ text })]),
    ),
  });

describe('a flex column that fills its parent is min-h-0 flex-1, never h-full beside a shrink-0 sibling', () => {
  it('counts a column with h-full and no min-h-0, and leaves the fill form alone', () => {
    expect(countFillRoots({ text: '<div className="flex h-full flex-col">' })).toBe(1);
    expect(countFillRoots({ text: '<div className="flex min-h-0 flex-1 flex-col">' })).toBe(0);
    expect(countFillRoots({ text: '<div className="flex h-full min-h-0 flex-col">' })).toBe(0);
  });

  it('adds no h-full column beyond the ones in the baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      `A flex column that fills its parent is "flex min-h-0 flex-1 flex-col". "h-full" beside a shrink-0 sibling overflows by the sibling's height and the sheet clips the composer. See docs/styling.md, Layout: fixed-height shell.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
