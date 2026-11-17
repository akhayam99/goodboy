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

const BASELINE_FILE = 'tone-opacity.baseline.json';

const TONE_OPACITY =
  /\b(?:bg|border(?:-[trblxy])?|ring|text|from|to|via|outline|divide|shadow|fill|stroke|decoration)-(?:primary|info|danger|success|warning|merged|draft|unread)\/\d+/g;

const countToneOpacity = ({ text }: { readonly text: string }): number =>
  text.match(TONE_OPACITY)?.length ?? 0;

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().map(({ path, text }) => [path, countToneOpacity({ text })]),
    ),
  });

describe('a tone fill, edge or ring reads a tone step, never an opacity modifier', () => {
  it('counts a tone with an opacity modifier and leaves steps and neutrals alone', () => {
    expect(countToneOpacity({ text: "'bg-danger/10 hover:border-warning/40'" })).toBe(2);
    expect(countToneOpacity({ text: "'ring-primary/60 border-l-merged/30 fill-success/18'" })).toBe(
      3,
    );
    expect(countToneOpacity({ text: "'bg-danger-subtle border-warning-edge'" })).toBe(0);
    expect(countToneOpacity({ text: "'bg-primary-solid hover:bg-primary-solid-hover'" })).toBe(0);
    expect(countToneOpacity({ text: "'bg-on-tone/15 border-border/60 bg-foreground/5'" })).toBe(0);
  });

  it('adds no tone opacity beyond the baseline, which only falls', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      [
        'A tone reads its step token (T-wash, T-subtle, T-edge, T-solid, T-solid-hover),',
        'never the tone with an opacity modifier. The baseline only falls.',
        grown.join('\n'),
      ].join('\n'),
    ).toEqual([]);
  });
});
