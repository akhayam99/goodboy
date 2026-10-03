// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { HistoryAbsorbed } from '../../store/slices/history/types';
import { appliedChips, groupAppliedEdits } from './groupAppliedEdits';

const absorbedOf = ({
  titles,
}: {
  readonly titles: ReadonlyArray<string>;
}): ReadonlyArray<HistoryAbsorbed> =>
  titles.map((title, index) => ({ sha: `sha-${index}`, title, mode: 'fixup' }));

describe('groupAppliedEdits', () => {
  it('groups absorbed commits by their conventional type, biggest first', () => {
    const groups = groupAppliedEdits({
      absorbed: absorbedOf({
        titles: [
          'feat: add a dry run flag',
          'refactor: drop unused batch options',
          'refactor(ledger): rename BatchQueue',
          'test: cover the retry path',
          'refactor!: drop the legacy flush route',
          'feat: open the endpoint',
          'refactor: reuse retry copy',
        ],
      }),
    });
    expect(groups.map((group) => [group.type, group.items.length])).toEqual([
      ['refactor', 4],
      ['feat', 2],
      ['test', 1],
    ]);
  });

  it('keeps the order of the commits inside a type', () => {
    const groups = groupAppliedEdits({
      absorbed: absorbedOf({ titles: ['fix: first', 'fix: second'] }),
    });
    expect(groups[0]?.items.map((item) => item.title)).toEqual(['fix: first', 'fix: second']);
  });

  it('puts titles without a type last, as other', () => {
    const groups = groupAppliedEdits({
      absorbed: absorbedOf({
        titles: ['wip export tests', 'Fix typo in CSV header', 'feat: batch writer'],
      }),
    });
    expect(groups.map((group) => group.type)).toEqual(['feat', 'other']);
  });

  it('reads the type whatever its case, and leaves a fixup title untyped', () => {
    const groups = groupAppliedEdits({
      absorbed: absorbedOf({ titles: ['Fix: typo', 'fixup! feat: thing'] }),
    });
    expect(groups.map((group) => group.type)).toEqual(['fix', 'other']);
  });
});

describe('appliedChips', () => {
  it('counts folds and combines together, then the other kinds', () => {
    const chips = appliedChips({
      lines: [
        { action: 'fixup' },
        { action: 'squash' },
        { action: 'fixup' },
        { action: 'move' },
        { action: 'reword' },
      ],
    });
    expect(chips.map((chip) => `${chip.count} ${chip.noun}`)).toEqual([
      '3 folded',
      '1 renamed',
      '1 moved',
    ]);
  });
});
