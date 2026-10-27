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

const BASELINE_FILE = 'loading-is-a-skeleton.baseline.json';

const LOADING_WORD = /(?:>\s*|heading=["'])Loading\b[^<]*/g;

const countLoadingWords = ({ text }: { readonly text: string }): number =>
  (text.match(LOADING_WORD) ?? []).length;

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().map(({ path, text }) => [path, countLoadingWords({ text })]),
    ),
  });

describe('loading is a skeleton, never a word on screen', () => {
  it('counts a visible Loading word and leaves a label alone', () => {
    expect(countLoadingWords({ text: '<span>Loading people</span>' })).toBe(1);
    expect(countLoadingWords({ text: '<EmptyLine>Loading</EmptyLine>' })).toBe(1);
    expect(countLoadingWords({ text: '<div aria-label="Loading board" />' })).toBe(0);
    expect(countLoadingWords({ text: '<SkeletonRow label="Loading people" />' })).toBe(0);
  });

  it('adds no Loading word beyond the baseline, which only falls', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      [
        'A loading state is a skeleton (SkeletonRow, SkeletonText) with the word in',
        'its aria-label. The baseline only falls.',
        grown.join('\n'),
      ].join('\n'),
    ).toEqual([]);
  });
});
