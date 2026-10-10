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
import { countSwallowedCatches } from './scanStateWrites';

const BASELINE_FILE = 'catch-swallow.baseline.json';

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().map(({ path, text }) => [path, countSwallowedCatches({ text })]),
    ),
  });

describe('a failure is reported, not swallowed by an empty catch', () => {
  it('counts the three swallowing forms, on one line or wrapped', () => {
    expect(countSwallowedCatches({ text: 'run().catch(() => undefined);' })).toBe(1);
    expect(countSwallowedCatches({ text: 'run().catch(() => null);' })).toBe(1);
    expect(countSwallowedCatches({ text: 'run().catch(() => {});' })).toBe(1);
    expect(countSwallowedCatches({ text: 'run().catch(\n  () => undefined,\n);' })).toBe(1);
    expect(
      countSwallowedCatches({ text: 'a().catch(() => undefined);\nb().catch(() => null);' }),
    ).toBe(2);
  });

  it('leaves a catch that handles the failure alone', () => {
    expect(countSwallowedCatches({ text: 'run().catch((error) => show(error));' })).toBe(0);
    expect(countSwallowedCatches({ text: 'run().catch(() => EMPTY_PAGE);' })).toBe(0);
    expect(countSwallowedCatches({ text: 'run().then(() => undefined);' })).toBe(0);
  });

  it('adds no swallowed catch beyond the baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      `Report the failure through commitAfterConfirm or reportError (docs/typescript/state-writes.md). A cleanup that lowers a count regenerates the baseline with GOODBOY_UPDATE_BASELINE=1.\n${grown.join('\n')}`,
    ).toEqual([]);
  });

  it('fails when a file grows its count', () => {
    const grown = grownEntries({
      current: { 'apps/desktop/src/x.ts': 3 },
      baseline: { 'apps/desktop/src/x.ts': 2 },
    });
    expect(grown).toEqual(['  - apps/desktop/src/x.ts: 3 (baseline 2)']);
  });
});
