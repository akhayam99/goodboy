// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type ProjectId } from '@goodboy/types';
import type { BoardRow } from './boardTypes';
import { boardProjectsOf } from './boardProjectsOf';
import { projectSectionsOf } from './projectSectionsOf';

const STAGE = {
  stage: 'building',
  reason: 'Building',
  addsFact: false,
  attention: null,
  prState: null,
} as const;

const PAYMENTS = brandId<ProjectId>({ value: 'project-payments-api' });
const LEDGER = brandId<ProjectId>({ value: 'project-ledger-core' });
const LEDGER_FORK = brandId<ProjectId>({ value: 'project-ledger-core-fork' });

type RowParams = {
  readonly id: string;
  readonly projectId: ProjectId | null;
  readonly projectName: string | null;
};

const rowOf = ({ id, projectId, projectName }: RowParams): BoardRow => ({
  id,
  mountId: projectName === null ? null : id,
  projectId,
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
  rowOf({ id: 'a', projectId: PAYMENTS, projectName: 'payments-api' }),
  rowOf({ id: 'b', projectId: LEDGER, projectName: 'ledger-core' }),
  rowOf({ id: 'c', projectId: PAYMENTS, projectName: 'payments-api' }),
  rowOf({ id: 'd', projectId: LEDGER_FORK, projectName: 'ledger-core' }),
  rowOf({ id: 'none', projectId: null, projectName: null }),
];

const rowById = new Map(ROWS.map((row) => [row.id, row]));

describe('projectSectionsOf', () => {
  it('keeps the board order and puts each row under its project', () => {
    expect(projectSectionsOf({ rowIds: ['a', 'b', 'c'], rowById })).toEqual([
      { projectId: PAYMENTS, projectName: 'payments-api', rowIds: ['a', 'c'] },
      { projectId: LEDGER, projectName: 'ledger-core', rowIds: ['b'] },
    ]);
  });

  it('keeps two projects with the same name in their own sections', () => {
    expect(projectSectionsOf({ rowIds: ['b', 'd'], rowById })).toEqual([
      { projectId: LEDGER, projectName: 'ledger-core', rowIds: ['b'] },
      { projectId: LEDGER_FORK, projectName: 'ledger-core', rowIds: ['d'] },
    ]);
  });

  it('leaves a row with no project in a section with no head', () => {
    expect(projectSectionsOf({ rowIds: ['none'], rowById })).toEqual([
      { projectId: null, projectName: null, rowIds: ['none'] },
    ]);
  });
});

describe('boardProjectsOf', () => {
  it('lists each project once by id, even when two share a name, and skips the row with no branch', () => {
    expect(boardProjectsOf({ rows: ROWS })).toEqual([
      { projectId: PAYMENTS, projectName: 'payments-api' },
      { projectId: LEDGER, projectName: 'ledger-core' },
      { projectId: LEDGER_FORK, projectName: 'ledger-core' },
    ]);
  });
});
