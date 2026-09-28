import { describe, expect, it } from 'vitest';
import { combineInto, initialPlanItems, setVerb } from './historyPlan';
import { historyGroupOf, historyRowMarks } from './historyRowMarks';
import { LEDGER, LEDGER_COMMITS, LEDGER_ORIGINAL } from './testing/ledgerFixture';
import { LEDGER_PRESET, LEDGER_RENAME } from './testing/ledgerPreset';

const { a, b, c, d, x, e, f } = LEDGER;
const marks = historyRowMarks({ items: LEDGER_PRESET, original: LEDGER_ORIGINAL });
const markOf = (sha: string) => {
  const found = marks.get(sha);
  if (found === undefined) {
    throw new Error(`no mark for ${sha}`);
  }
  return found;
};

describe('history row marks', () => {
  it('gives every row the action that changes the row itself first', () => {
    expect([f, e, x, d, c, b, a].map((sha) => markOf(sha).action)).toEqual([
      'fixup',
      'squash',
      'drop',
      'move',
      'reword',
      'pick',
      'fixup',
    ]);
  });

  it('puts the move only on the commit that moved', () => {
    expect(markOf(d).move?.delta).toBe(1);
    expect(markOf(c).move).toBeNull();
    expect(markOf(b).move).toBeNull();
  });

  it('lists what a commit takes in, with the mode of each', () => {
    expect(markOf(d).takesIn).toEqual([{ sha: e, mode: 'squash' }]);
    expect(markOf(a).takesIn).toEqual([{ sha: f, mode: 'fixup' }]);
    expect(markOf(d).takesInMode).toBe('squash');
    expect(markOf(e).into).toEqual({ target: d, mode: 'squash' });
  });

  it('keeps the mode of each fold in a chain', () => {
    const base = initialPlanItems({ commits: LEDGER_COMMITS });
    const chained = combineInto({
      items: combineInto({ items: base, sha: e, target: d, mode: 'squash' }),
      sha: d,
      target: c,
      mode: 'fixup',
    });
    const chainMarks = historyRowMarks({ items: chained, original: LEDGER_ORIGINAL });
    expect(chainMarks.get(c)?.takesIn).toEqual([
      { sha: d, mode: 'fixup' },
      { sha: e, mode: 'squash' },
    ]);
    expect(chainMarks.get(c)?.action).toBe('squash');
  });

  it('carries the new title and the removal', () => {
    expect(markOf(c).renamedTo).toBe(LEDGER_RENAME);
    expect(markOf(x).isRemoved).toBe(true);
    const removed = historyRowMarks({
      items: setVerb({
        items: initialPlanItems({ commits: LEDGER_COMMITS }),
        sha: b,
        verb: 'drop',
      }),
      original: LEDGER_ORIGINAL,
    });
    expect(removed.get(b)?.action).toBe('drop');
  });

  it('gives every member of a three into one fold the whole group, target first', () => {
    const three = [f, e, x].reduce(
      (items, sha) => combineInto({ items, sha, target: d, mode: 'fixup' }),
      initialPlanItems({ commits: LEDGER_COMMITS }),
    );
    const groupMarks = historyRowMarks({ items: three, original: LEDGER_ORIGINAL });
    for (const sha of [d, f, e, x]) {
      expect(historyGroupOf({ marks: groupMarks, sha })).toEqual([d, x, e, f]);
    }
    expect(historyGroupOf({ marks: groupMarks, sha: c })).toEqual([c]);
  });

  it('keeps a lone commit to itself and lights a fold from either end', () => {
    expect(historyGroupOf({ marks, sha: b })).toEqual([b]);
    expect(historyGroupOf({ marks, sha: e })).toEqual([d, e]);
    expect(historyGroupOf({ marks, sha: a })).toEqual([a, f]);
  });
});
