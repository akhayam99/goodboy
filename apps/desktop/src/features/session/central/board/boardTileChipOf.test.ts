// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId } from '@goodboy/types';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  Session,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { BranchFacts } from '../branches/branchFactsOf';
import { branchEntriesOf } from '../branches/branchStoryOf';
import { NAMES } from '../../../../shared/utils/names';
import { boardSettledWordOf } from './boardSettledWordOf';
import { boardTileChipOf } from './boardTileChipOf';
import type { BoardAsk } from './boardTypes';
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
  readonly checks?: 'success' | 'failure' | 'pending' | null;
  readonly state?: 'open' | 'merged' | 'closed';
  readonly hasRequest?: boolean;
  readonly noun?: '#' | '!';
};

const branchOf = ({
  checks = null,
  state = 'open',
  hasRequest = true,
  noun = '#',
}: BranchParams): BranchFacts => ({
  mountId: brandId<MountId>({ value: 'ledger' }),
  mountPath: '/wt/ledger',
  projectId: brandId<ProjectId>({ value: 'project-ledger-core' }),
  projectName: 'ledger-core',
  branch: 'nw/ledger-rounding',
  baseBranch: 'main',
  request: hasRequest
    ? {
        noun,
        number: 57,
        url: 'https://example.test/pull/57',
        isDraft: false,
        state,
        checksWord: null,
        checks,
        reviewDecision: null,
        isMergeable: true,
        isChecksAbsent: false,
        isReviewOptional: false,
      }
    : null,
  behind: null,
  isStale: false,
  checkedAgo: null,
  liveCount: 0,
  liveTitle: null,
  isFinished: state !== 'open',
  status: hasRequest
    ? null
    : {
        ahead: 2,
        changedFiles: 0,
        isRebasing: false,
        push: { kind: 'not-pushed', commits: 2 },
      },
  series: null,
});

const ASK: BoardAsk = { id: 'ask-1', mountId: 'ledger', leadId: null };

type ChipParams = {
  readonly branch: BranchFacts;
  readonly asks?: ReadonlyArray<BoardAsk>;
  readonly runningCount?: number;
};

const chipOf = ({ branch, asks = [], runningCount = 0 }: ChipParams) => {
  const board = branchBoardOf({ session, branches: [branch], asks, agents: [], leads: [] });
  const [row] = board.rows;
  if (row === undefined) {
    throw new Error('no row');
  }
  const entries = branchEntriesOf({ facts: [branch], detailByMountId: new Map() });
  const entry = [...entries.live, ...entries.finished][0] ?? null;
  return boardTileChipOf({ row, entry, runningCount });
};

describe('boardTileChipOf', () => {
  it('draws no chip on a merged or a closed branch, whose group already says it', () => {
    expect(chipOf({ branch: branchOf({ state: 'merged', checks: 'success' }) })).toBeNull();
    expect(chipOf({ branch: branchOf({ state: 'closed', checks: 'success' }) })).toBeNull();
  });

  it('says Asks you when a question waits on the branch, before failing checks', () => {
    expect(chipOf({ branch: branchOf({ checks: 'failure' }), asks: [ASK] })).toEqual({
      word: NAMES.asksYou,
      tone: 'warning',
    });
  });

  it('never repeats Needs you inside the Needs you group, and names the plan approval', () => {
    const branch = branchOf({ checks: 'pending' });
    const board = branchBoardOf({ session, branches: [branch], asks: [], agents: [], leads: [] });
    const [row] = board.rows;
    if (row === undefined) {
      throw new Error('no row');
    }
    const waiting = { ...row, group: 'needs-you' as const };
    const entries = branchEntriesOf({ facts: [branch], detailByMountId: new Map() });
    const entry = entries.live[0] ?? null;

    expect(boardTileChipOf({ row: waiting, entry, runningCount: 0 })).toBeNull();
    expect(
      boardTileChipOf({
        row: { ...waiting, stage: { ...waiting.stage, attention: 'plan-approval' } },
        entry,
        runningCount: 0,
      }),
    ).toEqual({ word: NAMES.needsApproval, tone: 'warning' });
  });

  it('drops the permission word from the row while the Needs you tile asks for it', () => {
    const branch = branchOf({ checks: 'pending' });
    const board = branchBoardOf({ session, branches: [branch], asks: [], agents: [], leads: [] });
    const [row] = board.rows;
    if (row === undefined) {
      throw new Error('no row');
    }
    const waiting = {
      ...row,
      group: 'needs-you' as const,
      stage: { ...row.stage, attention: 'needs-approval' as const },
    };
    const entry = branchEntriesOf({ facts: [branch], detailByMountId: new Map() }).live[0] ?? null;

    expect(boardTileChipOf({ row: waiting, entry, runningCount: 0 })).toEqual({
      word: NAMES.waitingForPermission,
      tone: 'warning',
    });
    expect(
      boardTileChipOf({ row: waiting, entry, runningCount: 0, isPermissionShown: true }),
    ).toBeNull();
  });

  it('says Checks failing in red over Running', () => {
    expect(chipOf({ branch: branchOf({ checks: 'failure' }), runningCount: 1 })).toEqual({
      word: 'Checks failing',
      tone: 'danger',
    });
  });

  it('says Running while an agent runs on an open branch', () => {
    expect(chipOf({ branch: branchOf({ checks: 'pending' }), runningCount: 2 })).toEqual({
      word: NAMES.running,
      tone: 'info',
    });
  });

  it('says Not pushed on a branch with local commits and no request', () => {
    expect(chipOf({ branch: branchOf({ hasRequest: false }) })?.word).toBe('Not pushed');
  });

  it('names the open pull request by its kind, the number living on the facts line', () => {
    expect(chipOf({ branch: branchOf({}) })?.word).toBe('PR open');
    expect(chipOf({ branch: branchOf({ noun: '!' }) })?.word).toBe('MR open');
  });
});

type SettledParams = {
  readonly branch: BranchFacts;
};

const settledOf = ({ branch }: SettledParams) => {
  const board = branchBoardOf({ session, branches: [branch], asks: [], agents: [], leads: [] });
  const [row] = board.rows;
  if (row === undefined) {
    throw new Error('no row');
  }
  return boardSettledWordOf({ row });
};

describe('boardSettledWordOf', () => {
  it('tells a merged branch from a closed one once the chip is gone', () => {
    expect(settledOf({ branch: branchOf({ state: 'merged' }) })).toEqual({
      word: 'Merged',
      tone: 'merged',
    });
    expect(settledOf({ branch: branchOf({ state: 'closed' }) })).toEqual({
      word: 'Closed',
      tone: 'neutral',
    });
  });

  it('says nothing on an open branch, whose chip carries the state', () => {
    expect(settledOf({ branch: branchOf({}) })).toBeNull();
  });
});
