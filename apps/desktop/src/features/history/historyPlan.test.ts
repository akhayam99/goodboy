import { describe, expect, it } from 'vitest';
import type { HistoryStep } from '@goodboy/types';
import {
  canRemove,
  combineDown,
  combineInto,
  initialPlanItems,
  keptOrder,
  moveAbove,
  moveBy,
  normalizePlanItems,
  planOrder,
  rewordStep,
  setCombineMode,
  setVerb,
  slotAnchorIsNoop,
} from './historyPlan';
import { LEDGER, LEDGER_COMMITS } from './testing/ledgerFixture';

const base = initialPlanItems({ commits: LEDGER_COMMITS });
const { a, b, c, d, x, e, f } = LEDGER;

describe('history plan', () => {
  it('starts oldest first with every commit kept', () => {
    expect(base.map((step) => step.sha)).toEqual([a, b, c, d, x, e, f]);
    expect(base.every((step) => step.verb === 'pick')).toBe(true);
  });

  it('moves a commit directly above the anchor of a slot', () => {
    const moved = moveAbove({ items: base, sha: d, anchor: b });
    expect(planOrder({ items: moved })).toEqual([a, b, d, c, x, e, f]);
    const bottom = moveAbove({ items: base, sha: f, anchor: null });
    expect(planOrder({ items: bottom })[0]).toBe(f);
  });

  it('replaces an earlier move of the same commit instead of stacking it', () => {
    const once = moveAbove({ items: base, sha: d, anchor: b });
    const twice = moveAbove({ items: once, sha: d, anchor: e });
    expect(planOrder({ items: twice })).toEqual([a, b, c, x, e, d, f]);
  });

  it('reports a slot that would leave the commit where it is as a no-op', () => {
    expect(slotAnchorIsNoop({ items: base, sha: d, anchor: c })).toBe(true);
    expect(slotAnchorIsNoop({ items: base, sha: d, anchor: b })).toBe(false);
    expect(moveAbove({ items: base, sha: d, anchor: c })).toBe(base);
  });

  it('moves one place newer or older with the arrow keys', () => {
    expect(planOrder({ items: moveBy({ items: base, sha: d, direction: 'newer' }) })).toEqual([
      a,
      b,
      c,
      x,
      d,
      e,
      f,
    ]);
    expect(planOrder({ items: moveBy({ items: base, sha: d, direction: 'older' }) })).toEqual([
      a,
      b,
      d,
      c,
      x,
      e,
      f,
    ]);
    expect(moveBy({ items: base, sha: a, direction: 'older' })).toBe(base);
    expect(moveBy({ items: base, sha: f, direction: 'newer' })).toBe(base);
  });

  it('folds into a target with fixup by default and switches to squash', () => {
    const folded = combineInto({ items: base, sha: f, target: a, mode: 'fixup' });
    expect(folded.find((step) => step.sha === f)).toEqual({ sha: f, verb: 'fixup', target: a });
    expect(keptOrder({ items: folded })).not.toContain(f);
    const squashed = setCombineMode({ items: folded, sha: f, mode: 'squash' });
    expect(squashed.find((step) => step.sha === f)?.verb).toBe('squash');
    expect(setCombineMode({ items: squashed, sha: f, mode: 'squash' })).toBe(squashed);
  });

  it('re-points commits folded into a commit that folds elsewhere', () => {
    const first = combineInto({ items: base, sha: e, target: d, mode: 'squash' });
    const chained = combineInto({ items: first, sha: d, target: c, mode: 'fixup' });
    expect(chained.find((step) => step.sha === e)).toEqual({ sha: e, verb: 'squash', target: c });
  });

  it('refuses to combine into itself, a removed commit, or a folded one', () => {
    const removed = setVerb({ items: base, sha: c, verb: 'drop' });
    expect(combineInto({ items: removed, sha: d, target: c, mode: 'fixup' })).toBe(removed);
    expect(combineInto({ items: base, sha: d, target: d, mode: 'fixup' })).toBe(base);
    const folded = combineInto({ items: base, sha: e, target: d, mode: 'fixup' });
    expect(combineInto({ items: folded, sha: f, target: e, mode: 'fixup' })).toBe(folded);
  });

  it('combines down into the next older commit that stays, skipping removed ones', () => {
    const removed = setVerb({ items: base, sha: x, verb: 'drop' });
    const folded = combineDown({ items: removed, sha: e, mode: 'squash' });
    expect(folded.find((step) => step.sha === e)).toEqual({ sha: e, verb: 'squash', target: d });
    expect(combineDown({ items: base, sha: a, mode: 'fixup' })).toBe(base);
  });

  it('will not remove a commit that others fold into', () => {
    const folded = combineInto({ items: base, sha: f, target: a, mode: 'fixup' });
    expect(canRemove({ items: folded, sha: a })).toBe(false);
    expect(setVerb({ items: folded, sha: a, verb: 'drop' })).toBe(folded);
  });

  it('renames with a new message and goes back to keep when the title is the original', () => {
    const renamed = rewordStep({
      items: base,
      sha: c,
      message: ' Verify webhook signatures ',
      original: 'Fix webhook signature check',
    });
    expect(renamed.find((step) => step.sha === c)).toEqual({
      sha: c,
      verb: 'reword',
      message: 'Verify webhook signatures',
    });
    const back = rewordStep({
      items: renamed,
      sha: c,
      message: 'Fix webhook signature check',
      original: 'Fix webhook signature check',
    });
    expect(back.find((step) => step.sha === c)?.verb).toBe('pick');
    expect(rewordStep({ items: base, sha: c, message: '  ', original: 'x' })).toBe(base);
  });

  it('gives an older plan with neighbour squashes an explicit target', () => {
    const legacy: ReadonlyArray<HistoryStep> = [
      { sha: a, verb: 'pick' },
      { sha: b, verb: 'squash' },
      { sha: c, verb: 'drop' },
      { sha: d, verb: 'fixup', target: c },
      { sha: e, verb: 'squash', target: b },
    ];
    expect(normalizePlanItems({ items: legacy })).toEqual([
      { sha: a, verb: 'pick' },
      { sha: b, verb: 'squash', target: a },
      { sha: c, verb: 'drop' },
      { sha: d, verb: 'pick' },
      { sha: e, verb: 'squash', target: a },
    ]);
    expect(normalizePlanItems({ items: base })).toBe(base);
  });
});
