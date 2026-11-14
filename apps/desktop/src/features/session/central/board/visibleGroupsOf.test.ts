// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { BoardRow, BranchBoard } from './boardTypes';
import { sessionKpisOf } from './sessionKpisOf';
import { isRowInFilter, visibleGroupsOf } from './visibleGroupsOf';

const stage = {
  stage: 'building',
  reason: 'Building',
  addsFact: false,
  attention: null,
  prState: null,
} as const;

type RowOptions = {
  readonly group: BoardRow['group'];
  readonly needsYouIds?: ReadonlyArray<string>;
  readonly checks?: BoardRow['checks'];
  readonly isMerged?: boolean;
};

const rowOf = (
  id: string,
  { group, needsYouIds = [], checks = null, isMerged = false }: RowOptions,
) =>
  ({
    id,
    mountId: id,
    projectName: 'ledger-core',
    branch: `feat/${id}`,
    group,
    isMerged,
    stage,
    checks,
    askIds: needsYouIds,
    agentIds: [],
    leadIds: [],
    needsYouIds,
    spendUsd: 0,
    elapsedMs: 0,
  }) satisfies BoardRow;

const rows = [
  rowOf('a', { group: 'needs-you', needsYouIds: ['q1'], checks: 'failure' }),
  rowOf('b', { group: 'needs-you', needsYouIds: ['q2'] }),
  rowOf('c', { group: 'in-progress', checks: 'success' }),
  rowOf('d', { group: 'merged', isMerged: true }),
] satisfies ReadonlyArray<BoardRow>;

const board: BranchBoard = {
  rows,
  groups: [
    {
      id: 'needs-you',
      label: 'Needs you',
      rowIds: ['a', 'b'],
      visibleRowIds: ['a', 'b'],
      hiddenCount: 0,
    },
    {
      id: 'in-progress',
      label: 'In progress',
      rowIds: ['c'],
      visibleRowIds: ['c'],
      hiddenCount: 0,
    },
    { id: 'merged', label: 'Merged', rowIds: ['d'], visibleRowIds: ['d'], hiddenCount: 0 },
  ],
  isGrouped: true,
  isAlone: false,
};

const shownCount = (groups: ReturnType<typeof visibleGroupsOf>) =>
  groups.reduce((sum, group) => sum + group.rowIds.length, 0);

describe('visibleGroupsOf', () => {
  it('shows every row when no tile filters', () => {
    expect(shownCount(visibleGroupsOf({ board, filter: null, isMergedExpanded: false }))).toBe(4);
  });

  it('shows as many rows behind Needs you as the tile counts asks, one ask per row', () => {
    const groups = visibleGroupsOf({ board, filter: 'needs-you', isMergedExpanded: false });

    expect(shownCount(groups)).toBe(sessionKpisOf({ board }).needsYou.count);
    expect(groups.map((group) => group.id)).toEqual(['needs-you']);
  });

  it('shows as many rows behind Checks as the tile counts failing', () => {
    const groups = visibleGroupsOf({ board, filter: 'checks', isMergedExpanded: false });

    expect(shownCount(groups)).toBe(sessionKpisOf({ board }).checks.failing);
  });

  it('folds the merged group only while it is not expanded', () => {
    const folded: BranchBoard = {
      ...board,
      groups: board.groups.map((group) =>
        group.id === 'merged'
          ? {
              ...group,
              rowIds: ['d', 'e', 'f', 'g'],
              visibleRowIds: ['d', 'e', 'f'],
              hiddenCount: 1,
            }
          : group,
      ),
    };

    const closed = visibleGroupsOf({ board: folded, filter: null, isMergedExpanded: false });
    const open = visibleGroupsOf({ board: folded, filter: null, isMergedExpanded: true });

    expect(closed.find((group) => group.id === 'merged')?.rowIds).toHaveLength(3);
    expect(open.find((group) => group.id === 'merged')?.rowIds).toHaveLength(4);
  });

  it('matches a row to a filter the same way the groups do', () => {
    const [first] = rows;
    expect(first === undefined ? false : isRowInFilter({ row: first, filter: 'checks' })).toBe(
      true,
    );
  });
});
