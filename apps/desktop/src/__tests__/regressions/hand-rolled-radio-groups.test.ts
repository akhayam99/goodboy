// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  countMatches,
  grownEntries,
  nonZero,
  productSources,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const BASELINE_FILE = 'hand-rolled-radio-groups.baseline.json';
const RADIO = /role="radio"/g;

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().map(({ path, text }) => [path, countMatches({ text, pattern: RADIO })]),
    ),
  });

describe('a choice group is SegmentedTabs or ChoiceCards, not a hand-rolled radio group', () => {
  it('counts a radio role and leaves a tab role alone', () => {
    expect(countMatches({ text: '<button role="radio" aria-checked />', pattern: RADIO })).toBe(1);
    expect(countMatches({ text: '<button role="tab" />', pattern: RADIO })).toBe(0);
  });

  it('adds no radio option beyond the card groups in the baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      `Use SegmentedTabs for a short segmented choice or ChoiceCards for cards with a description. The baseline holds the card groups that stay.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
