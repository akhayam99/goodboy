// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  countMatches,
  grownEntries,
  nonZero,
  openingTags,
  productSources,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const BASELINE_FILE = 'busy-controls.baseline.json';
const ASYNC_CLICK = /onClick=\{\(\) => void (?!openUrl\b|copy\b)[A-Za-z_$][\w$.]*\(/;
const BUSY_PROP = /\b(?:disabled|isBusy|busy)\b/;
const SAME_BRANCH_TERNARY = /\?\s*(['"])([^'"\n]*)\1\s*:\s*\1\2\1/g;

type ControlParams = {
  readonly text: string;
};

const unguardedAsyncControls = ({ text }: ControlParams): number => {
  if (text.includes('usePendingAction')) {
    return 0;
  }
  return ['Button', 'IconButton']
    .flatMap((name) => openingTags({ text, name }))
    .filter((tag) => ASYNC_CLICK.test(tag) && !BUSY_PROP.test(tag)).length;
};

const measure = ({ count }: { readonly count: (params: ControlParams) => number }): FileCounts =>
  nonZero({
    counts: Object.fromEntries(productSources().map(({ path, text }) => [path, count({ text })])),
  });

const identicalBranches = ({ text }: ControlParams): number =>
  countMatches({ text, pattern: SAME_BRANCH_TERNARY });

const runRatchet = ({
  file,
  count,
  fix,
}: {
  readonly file: string;
  readonly count: (params: ControlParams) => number;
  readonly fix: string;
}): void => {
  const current = measure({ count });
  if (IS_UPDATING) {
    writeBaseline({ file, counts: current });
    return;
  }
  const grown = grownEntries({ current, baseline: readBaseline({ file }) });
  expect(grown, `${fix}\n${grown.join('\n')}`).toEqual([]);
};

describe('a control that starts async work says when it is busy', () => {
  it('counts an async click with no disabled or busy state and ignores a guarded one', () => {
    const bare = '<Button onClick={() => void save()}>Save</Button>';
    const busy = '<Button isBusy={isSaving} onClick={() => void save()}>Save</Button>';
    const disabled = '<IconButton disabled={isSaving} onClick={() => void save()} />';
    const pending = `usePendingAction ${bare}`;
    expect(unguardedAsyncControls({ text: bare })).toBe(1);
    expect(unguardedAsyncControls({ text: busy })).toBe(0);
    expect(unguardedAsyncControls({ text: disabled })).toBe(0);
    expect(unguardedAsyncControls({ text: pending })).toBe(0);
  });

  it('adds no unguarded async control beyond the baseline', () => {
    runRatchet({
      file: BASELINE_FILE,
      count: unguardedAsyncControls,
      fix: 'Give the control disabled or isBusy, and a tooltip that says why ("Wait for the turn to finish"), or run it through usePendingAction.',
    });
  });
});

describe('a ternary picks between two different values', () => {
  it('counts a ternary whose branches are the same string', () => {
    expect(identicalBranches({ text: "x ? 'a' : 'a'" })).toBe(1);
    expect(identicalBranches({ text: "x ? 'a' : 'b'" })).toBe(0);
  });

  it('adds no identical-branch ternary beyond the baseline', () => {
    runRatchet({
      file: 'identical-ternary.baseline.json',
      count: identicalBranches,
      fix: 'Drop the ternary or give each branch its own value.',
    });
  });
});
