// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  domOpeningTags,
  grownEntries,
  nonZero,
  productSources,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const BASELINE_FILE = 'red-alert-text.baseline.json';

type CountParams = {
  readonly text: string;
};

const countRedAlerts = ({ text }: CountParams): number =>
  domOpeningTags({ text }).filter(
    (tag) => tag.includes('role="alert"') && /(?<![\w-])text-danger(?![\w-])/.test(tag),
  ).length;

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().map(({ path, text }) => [path, countRedAlerts({ text })]),
    ),
  });

describe('an error is FieldError, reportError or ErrorStrip, never a red alert sentence', () => {
  it('counts an alert painted danger and leaves the danger glyph alone', () => {
    expect(countRedAlerts({ text: '<p role="alert" className="text-meta text-danger">' })).toBe(1);
    expect(
      countRedAlerts({
        text: '<div\n  role="alert"\n  className={cn("text-meta", isBad && "text-danger")}\n>',
      }),
    ).toBe(1);
    expect(countRedAlerts({ text: '<p role="alert" className="text-foreground">' })).toBe(0);
    expect(countRedAlerts({ text: '<span className="text-danger">' })).toBe(0);
    expect(countRedAlerts({ text: '<p role="alert" className="text-danger-foreground">' })).toBe(0);
  });

  it('keeps FieldError off the red sentence', () => {
    expect(Object.keys(measure())).not.toContain('packages/ui/src/components/FieldError.tsx');
  });

  it('adds no red alert beyond the baseline, which only falls', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      [
        'A field you are typing in shows FieldError, a one-click action calls reportError',
        'and leaves the row as it was, a failed load is ErrorStrip (DESIGN.md, Status and',
        'signals). A red role="alert" sentence is none of them. The baseline only falls.',
        grown.join('\n'),
      ].join('\n'),
    ).toEqual([]);
  });
});
