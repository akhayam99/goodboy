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

const BASELINE_FILE = 'hand-made-dots.baseline.json';

const CLASS_STRING = /(["'`])((?:(?!\1)[^\n])*)\1/g;
const DOT_SIZE = /(?<![\w-])size-(?:1\.5|2)(?![\w.-])/;
const ROUND = /(?<![\w-])rounded-full(?![\w-])/;
const STATUS_FILL =
  /(?<![\w:-])bg-(?:primary|warning|info|success|danger|idle|draft|merged|border|muted-foreground|current)(?![\w-])/;

const isHandMadeDot = ({ text }: { readonly text: string }): boolean =>
  DOT_SIZE.test(text) && ROUND.test(text) && STATUS_FILL.test(text);

const countDots = ({ text }: { readonly text: string }): number =>
  [...text.matchAll(CLASS_STRING)].filter((match) => isHandMadeDot({ text: match[2] ?? '' }))
    .length;

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().map(({ path, text }) => [path, countDots({ text })]),
    ),
  });

describe('a status dot is a StatusDot, not a hand-made round span', () => {
  it('counts a sized round span with a status fill and leaves the primitive alone', () => {
    expect(
      countDots({ text: `<span className="size-1.5 shrink-0 rounded-full bg-warning" />` }),
    ).toBe(1);
    expect(countDots({ text: `<span className="size-2 rounded-full bg-primary" />` })).toBe(1);
    expect(countDots({ text: `<StatusDot size="sm" tone="warning" />` })).toBe(0);
    expect(countDots({ text: `<span className="size-2.5 rounded-full bg-primary" />` })).toBe(0);
    expect(
      countDots({
        text: `<span className="size-2 rounded-full" style={{ backgroundColor: c }} />`,
      }),
    ).toBe(0);
    expect(
      countDots({ text: `<span className="size-2 rounded-full border-2 bg-background" />` }),
    ).toBe(0);
  });

  it('adds no hand-made dot beyond the baseline, which only falls', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      [
        'A small round status mark is StatusDot from @goodboy/ui: the tone maps to the fill,',
        'a labelled dot gets its role and name, and a live one pulses with reduced motion',
        'respected. The baseline only falls.',
        grown.join('\n'),
      ].join('\n'),
    ).toEqual([]);
  });
});
