// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId } from '@goodboy/types';
import type { IsoDateTime, MountId, Session, SessionId, WorkspaceId } from '@goodboy/types';
import type { BranchFacts } from '../branches/branchFactsOf';
import { branchEntriesOf } from '../branches/branchStoryOf';
import { boardRowCellsOf, type BoardRowCells } from './boardRowCellsOf';
import type { BoardAgent, BoardAsk } from './boardTypes';
import { branchBoardOf } from './branchBoardOf';

const DATE = brandId<IsoDateTime>({ value: '2026-08-04T00:00:00.000Z' });

const session: Session = {
  id: brandId<SessionId>({ value: 'session-1' }),
  workspaceId: brandId<WorkspaceId>({ value: 'workspace-1' }),
  goal: 'Fix the settlement export',
  state: { kind: 'idle', lastActivityAt: DATE },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: DATE,
  updatedAt: DATE,
};

type BranchParams = {
  readonly id: string;
  readonly checks: 'success' | 'failure' | 'pending' | null;
  readonly state: 'open' | 'merged' | 'closed';
};

const branchOf = ({ id, checks, state }: BranchParams): BranchFacts => ({
  mountId: brandId<MountId>({ value: id }),
  mountPath: `/wt/${id}`,
  projectName: 'ledger-core',
  branch: `nw/${id}`,
  baseBranch: 'main',
  request: {
    noun: '#',
    number: 57,
    isDraft: false,
    state,
    checksWord: null,
    checks,
    reviewDecision: null,
    isMergeable: true,
    isChecksAbsent: false,
    isReviewOptional: false,
  },
  behind: null,
  isStale: false,
  checkedAgo: null,
  liveCount: 0,
  liveTitle: null,
  isFinished: state !== 'open',
  status: null,
  series: null,
});

type IdParams = {
  readonly id: string;
};

const askOf = ({ id }: IdParams): BoardAsk => ({
  id,
  mountId: null,
  leadId: null,
});

const agentOf = ({ id }: IdParams): BoardAgent => ({
  id,
  leadId: null,
  mountId: null,
  spendUsd: 0,
  elapsedMs: 1000,
  isRunning: true,
  isBlocked: false,
  isFailed: false,
});

type CellsParams = {
  readonly branch: BranchFacts | null;
  readonly asks?: ReadonlyArray<BoardAsk>;
  readonly agents?: ReadonlyArray<BoardAgent>;
  readonly runningCount?: number;
  readonly nextTitle?: string | null;
  readonly settledAt?: number | null;
  readonly now?: number;
};

const cellsOf = ({
  branch,
  asks = [],
  agents = [],
  runningCount = 0,
  nextTitle = null,
  settledAt = null,
  now = 0,
}: CellsParams) => {
  const branches = branch === null ? [] : [branch];
  const board = branchBoardOf({ session, branches, asks, agents, leads: [] });
  const row = board.rows[board.rows.length - 1];
  if (row === undefined) {
    throw new Error('no row');
  }
  const entries = branchEntriesOf({ facts: branches, detailByMountId: new Map() });
  const entry = [...entries.live, ...entries.finished][0] ?? null;
  return boardRowCellsOf({ row, entry, settledAt, now, runningCount, nextTitle });
};

type WordsParams = {
  readonly cells: BoardRowCells;
};

const wordsOf = ({ cells }: WordsParams): ReadonlyArray<string> =>
  [cells.title, cells.stage, cells.checks.text, cells.next, cells.agents]
    .filter((text) => text !== '')
    .map((text) => text.toLowerCase());

describe('boardRowCellsOf', () => {
  it('says checks failing once when the stage already says it', () => {
    const cells = cellsOf({
      branch: branchOf({ id: 'fix-rounding', checks: 'failure', state: 'open' }),
    });
    expect(cells.stage).toBe('Checks failing');
    expect(cells.checks.text).toBe('');
  });

  it('says checks running once when the stage already says it', () => {
    const cells = cellsOf({
      branch: branchOf({ id: 'retry-state', checks: 'pending', state: 'open' }),
    });
    expect(wordsOf({ cells }).filter((word) => word === 'checks running')).toHaveLength(1);
  });

  it('drops the checks word on a merged branch', () => {
    const cells = cellsOf({
      branch: branchOf({ id: 'idempotency', checks: 'success', state: 'merged' }),
    });
    expect(cells.checks.text).toBe('');
  });

  it('says Closed with its age on a closed request and drops the checks word', () => {
    const now = Date.parse('2026-08-06T00:00:00.000Z');
    const cells = cellsOf({
      branch: branchOf({ id: 'retired-fix', checks: 'success', state: 'closed' }),
      settledAt: Date.parse('2026-08-04T00:00:00.000Z'),
      now,
    });
    expect(cells.stage).toBe('Closed 2d ago');
    expect(cells.checks.text).toBe('');
  });

  it('keeps Merged with its age on a merged branch', () => {
    const now = Date.parse('2026-08-06T00:00:00.000Z');
    const cells = cellsOf({
      branch: branchOf({ id: 'idempotency', checks: 'success', state: 'merged' }),
      settledAt: Date.parse('2026-08-04T00:00:00.000Z'),
      now,
    });
    expect(cells.stage).toBe('Merged 2d ago');
  });

  it('titles a branchless question row by its question, not by its count', () => {
    const question = 'Round half up or half to even at the settlement total?';
    const cells = cellsOf({
      branch: null,
      asks: [askOf({ id: 'ask-1' })],
      nextTitle: question,
    });
    expect(cells.title).toBe(question);
    expect(cells.next).toBe('');
    expect(new Set(wordsOf({ cells })).size).toBe(wordsOf({ cells }).length);
  });

  it('says the open question count once when no card names it', () => {
    const cells = cellsOf({ branch: null, asks: [askOf({ id: 'ask-1' })] });
    expect(wordsOf({ cells }).filter((word) => word === '1 open question')).toHaveLength(1);
  });

  it('says agents running once on a branchless row', () => {
    const cells = cellsOf({
      branch: null,
      agents: [agentOf({ id: 'agent-1' })],
      runningCount: 1,
    });
    expect(cells.title).toBe('1 agent running');
    expect(cells.stage).toBe('');
    expect(cells.agents).toBe('');
  });
});
