import { describe, expect, it } from 'vitest';
import { deriveHistoryEdits, invertHistoryEdit, moveFacts, rowsOfEdit } from './historyEdits';
import { initialPlanItems, keptOrder, moveAbove, planOrder } from './historyPlan';
import { LEDGER, LEDGER_COMMITS, LEDGER_ORIGINAL } from './testing/ledgerFixture';
import { LEDGER_PRESET } from './testing/ledgerPreset';

const { a, b, c, d, x, e, f } = LEDGER;
const original = LEDGER_ORIGINAL;
const base = initialPlanItems({ commits: LEDGER_COMMITS });

const kinds = (items: typeof base) =>
  deriveHistoryEdits({ items, original, onto: null, behind: 3 }).map(
    (edit) => `${edit.kind}:${edit.kind === 'rebase' ? '' : edit.sha}`,
  );

describe('history edits', () => {
  it('has no edits for an untouched plan', () => {
    expect(deriveHistoryEdits({ items: base, original, onto: null, behind: 3 })).toEqual([]);
  });

  it('derives one edit per change, in the order of the rows, newest first', () => {
    expect(kinds(LEDGER_PRESET)).toEqual([
      `fixup:${f}`,
      `squash:${e}`,
      `drop:${x}`,
      `move:${d}`,
      `reword:${c}`,
    ]);
  });

  it('adds starting from main as the last edit with the count of new main commits', () => {
    const edits = deriveHistoryEdits({ items: base, original, onto: 'main-sha', behind: 3 });
    expect(edits).toEqual([{ kind: 'rebase', key: 'rebase', onto: 'main-sha', count: 3 }]);
  });

  it('counts a move among the commits that stay and names its new neighbour', () => {
    expect(moveFacts({ items: LEDGER_PRESET, original }).get(d)).toEqual({
      delta: 1,
      relation: { where: 'below', sha: c },
    });
    const up = moveAbove({ items: base, sha: a, anchor: c });
    expect(moveFacts({ items: up, original }).get(a)).toEqual({
      delta: -2,
      relation: { where: 'above', sha: c },
    });
  });

  it('marks only the commit that moved, not the ones it passed', () => {
    const moved = moveAbove({ items: base, sha: f, anchor: b });
    expect([...moveFacts({ items: moved, original }).keys()]).toEqual([f]);
  });

  it('undoes one edit and leaves the others', () => {
    const edits = deriveHistoryEdits({ items: LEDGER_PRESET, original, onto: null, behind: 3 });
    const move = edits.find((edit) => edit.kind === 'move');
    if (move === undefined) {
      throw new Error('the preset moves a commit');
    }
    const undone = invertHistoryEdit({ items: LEDGER_PRESET, original, edit: move });
    expect(planOrder({ items: undone })).toEqual([a, b, c, d, x]);
    expect(kinds(undone)).toEqual([`fixup:${f}`, `squash:${e}`, `drop:${x}`, `reword:${c}`]);
  });

  it('undoes every edit back to the original plan', () => {
    let items = LEDGER_PRESET;
    for (const edit of deriveHistoryEdits({ items, original, onto: null, behind: 3 })) {
      items = invertHistoryEdit({ items, original, edit });
    }
    expect(kinds(items)).toEqual([]);
    expect(keptOrder({ items })).toEqual(original);
  });

  it('lights both rows of a combine and one row for the rest', () => {
    const edits = deriveHistoryEdits({ items: LEDGER_PRESET, original, onto: null, behind: 3 });
    expect(edits.map((edit) => rowsOfEdit({ edit }))).toEqual([[f, a], [e, d], [x], [d], [c]]);
  });
});
