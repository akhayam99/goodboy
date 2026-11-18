// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { BoardRow } from './boardTypes';
import { boardProjectNamesOf } from './boardProjectNamesOf';
import { projectSectionsOf } from './projectSectionsOf';

const STAGE = {
  stage: 'building',
  reason: 'Building',
  addsFact: false,
  attention: null,
  prState: null,
} as const;

type RowParams = {
  readonly id: string;
  readonly projectName: string | null;
};

const rowOf = ({ id, projectName }: RowParams): BoardRow => ({
  id,
  mountId: projectName === null ? null : id,
  projectName,
  branch: projectName === null ? null : `ak/${id}`,
  group: 'in-progress',
  isMerged: false,
  isClosed: false,
  isSettled: false,
  stage: STAGE,
  checks: null,
  askIds: [],
  agentIds: [],
  leadIds: [],
  needsYouIds: [],
  spendUsd: 0,
  elapsedMs: 0,
});

const ROWS = [
  rowOf({ id: 'a', projectName: 'payments-api' }),
  rowOf({ id: 'b', projectName: 'ledger-core' }),
  rowOf({ id: 'c', projectName: 'payments-api' }),
  rowOf({ id: 'none', projectName: null }),
];

const rowById = new Map(ROWS.map((row) => [row.id, row]));

describe('projectSectionsOf', () => {
  it('keeps the board order and puts each row under its project', () => {
    expect(projectSectionsOf({ rowIds: ['a', 'b', 'c'], rowById })).toEqual([
      { projectName: 'payments-api', rowIds: ['a', 'c'] },
      { projectName: 'ledger-core', rowIds: ['b'] },
    ]);
  });

  it('leaves a row with no project in a section with no head', () => {
    expect(projectSectionsOf({ rowIds: ['none'], rowById })).toEqual([
      { projectName: null, rowIds: ['none'] },
    ]);
  });
});

describe('boardProjectNamesOf', () => {
  it('names each project once and skips the row with no branch', () => {
    expect(boardProjectNamesOf({ rows: ROWS })).toEqual(['payments-api', 'ledger-core']);
  });
});
