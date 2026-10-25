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

const BASELINE_FILE = 'disabled-opacity.baseline.json';

const DISABLED_LINE =
  /(?:\bdisabled:|\b(?:is|close)?[dD]isabled\b)[^\n]*\bopacity-(?:[3-8]0)\b|\bopacity-(?:[3-8]0)\b[^\n]*\b(?:disabled:|(?:is|close)?[dD]isabled\b)/;

const countDisabledOpacity = ({ text }: { readonly text: string }): number =>
  text.split('\n').filter((line) => DISABLED_LINE.test(line)).length;

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().map(({ path, text }) => [path, countDisabledOpacity({ text })]),
    ),
  });

describe('a disabled control uses the DISABLED string, never an opacity step', () => {
  it('counts a disabled line that steps opacity and leaves drag and reveal alone', () => {
    expect(countDisabledOpacity({ text: "disabled && 'opacity-50'" })).toBe(1);
    expect(
      countDisabledOpacity({ text: "'disabled:cursor-not-allowed disabled:opacity-60'" }),
    ).toBe(1);
    expect(countDisabledOpacity({ text: "isDisabled ? 'cursor-default opacity-40' : ''" })).toBe(1);
    expect(countDisabledOpacity({ text: "isDragging && 'opacity-50'" })).toBe(0);
    expect(countDisabledOpacity({ text: 'disabled && DISABLED' })).toBe(0);
  });

  it('keeps every ui primitive off disabled opacity', () => {
    const offenders = Object.keys(measure()).filter((path) => path.startsWith('packages/ui/'));
    expect(offenders).toEqual(['packages/ui/src/components/SelectionCheckbox.tsx']);
  });

  it('adds no disabled opacity beyond the baseline, which only falls', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      [
        'Disabled is the DISABLED string from @goodboy/ui: the disabled-foreground',
        'label on its surface, never an opacity step. The baseline only falls.',
        grown.join('\n'),
      ].join('\n'),
    ).toEqual([]);
  });
});
