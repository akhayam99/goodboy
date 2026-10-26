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

const BASELINE_FILE = 'hand-made-meters.baseline.json';

const CLASS_STRING = /(["'`])((?:(?!\1)[^\n])*)\1/g;
const SIZED_BY_STYLE = /style=\{\{\s*width/;
const TRACK_FILL = /(?<![\w-])bg-(?:fill|muted|subtle|border-soft)(?![\w-])/;

const isTrack = ({ text }: { readonly text: string }): boolean =>
  /(?<![\w-])overflow-hidden(?![\w-])/.test(text) &&
  /(?<![\w-])rounded-full(?![\w-])/.test(text) &&
  TRACK_FILL.test(text);

const countTracks = ({ text }: { readonly text: string }): number => {
  if (SIZED_BY_STYLE.test(text) === false) {
    return 0;
  }
  return [...text.matchAll(CLASS_STRING)].filter((match) => isTrack({ text: match[2] ?? '' }))
    .length;
};

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().map(({ path, text }) => [path, countTracks({ text })]),
    ),
  });

describe('a bar that draws a number is a Meter, not a hand-made track', () => {
  it('counts a track with a styled-width fill and leaves a Meter alone', () => {
    const handMade = `<div className="h-1.5 overflow-hidden rounded-full bg-muted"><div style={{ width: '40%' }} /></div>`;

    expect(countTracks({ text: handMade })).toBe(1);
    expect(countTracks({ text: `<Meter label="Spent" value={4} max={10} />` })).toBe(0);
    expect(countTracks({ text: `<div className="overflow-hidden rounded-full bg-muted" />` })).toBe(
      0,
    );
    expect(
      countTracks({ text: `<div className="rounded-full bg-fill" style={{ width: 4 }} />` }),
    ).toBe(0);
  });

  it('adds no hand-made track beyond the baseline, which only falls', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      [
        'A bar that shows a value is Meter from @goodboy/ui: it carries the track, the',
        'meter role, the value range and the label once. A stacked bar takes METER_TRACK.',
        'The baseline only falls.',
        grown.join('\n'),
      ].join('\n'),
    ).toEqual([]);
  });
});
