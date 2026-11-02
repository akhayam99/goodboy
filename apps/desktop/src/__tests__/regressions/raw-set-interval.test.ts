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

const BASELINE_FILE = 'raw-set-interval.baseline.json';

const START_POLL_PATH = 'apps/desktop/src/shared/lib/usePoll/startPoll.ts';

const RAW_INTERVAL = /\bsetInterval\s*\(/g;

type CountParams = {
  readonly text: string;
};

const countRawIntervals = ({ text }: CountParams): number =>
  (text.match(RAW_INTERVAL) ?? []).length;

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources()
        .filter(({ path }) => path !== START_POLL_PATH)
        .map(({ path, text }) => [path, countRawIntervals({ text })]),
    ),
  });

describe('every interval goes through startPoll', () => {
  it('counts a bare and a window setInterval, and leaves clearInterval alone', () => {
    expect(countRawIntervals({ text: 'const id = setInterval(run, 10);' })).toBe(1);
    expect(countRawIntervals({ text: 'const id = window.setInterval(run, 10);' })).toBe(1);
    expect(countRawIntervals({ text: 'clearInterval(id); startPoll({ run });' })).toBe(0);
  });

  it('adds no raw setInterval beyond the baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      `Start the interval with startPoll from shared/lib/usePoll and name its gate (always, visible or focused). A cleanup that lowers a count regenerates the baseline with GOODBOY_UPDATE_BASELINE=1.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
