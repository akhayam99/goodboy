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
import type { BranchFacts, BranchRequestFacts } from '../branches/branchFactsOf';
import { branchEntriesOf } from '../branches/branchStoryOf';
import type { ActionCardModel } from '../next/actionCardsOf';
import { NAMES } from '../../../../shared/utils/names';
import type { BoardAsk } from './boardTypes';
import { branchBoardOf } from './branchBoardOf';
import { branchRowOf, type BranchRowOverlap } from './branchRowOf';

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
  readonly state?: 'open' | 'merged' | 'closed' | 'queued';
  readonly hasRequest?: boolean;
  readonly noun?: '#' | '!';
  readonly isDraft?: boolean;
  readonly isMergeable?: boolean;
  readonly reviewDecision?: BranchRequestFacts['reviewDecision'];
  readonly behind?: number | null;
  readonly isRebasing?: boolean;
  readonly push?: 'not-pushed' | 'pushed';
};

const branchOf = ({
  checks = null,
  state = 'open',
  hasRequest = true,
  noun = '#',
  isDraft = false,
  isMergeable = true,
  reviewDecision = null,
  behind = null,
  isRebasing = false,
  push = 'not-pushed',
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
        isDraft,
        state,
        checksWord: null,
        checks,
        reviewDecision,
        isMergeable,
        isChecksAbsent: false,
        isReviewOptional: false,
      }
    : null,
  behind,
  isStale: false,
  checkedAgo: null,
  liveCount: 0,
  liveTitle: null,
  isFinished: state === 'merged' || state === 'closed',
  status: hasRequest
    ? null
    : {
        ahead: 2,
        changedFiles: 0,
        isRebasing,
        push: push === 'pushed' ? { kind: 'in-sync' } : { kind: 'not-pushed', commits: 2 },
      },
  series: null,
});

const ASK: BoardAsk = { id: 'ask-1', mountId: 'ledger', leadId: null };

type CardKind = ActionCardModel['kind'];

type RowParams = {
  readonly branch: BranchFacts;
  readonly asks?: ReadonlyArray<BoardAsk>;
  readonly runningCount?: number;
  readonly cards?: ReadonlyArray<CardKind>;
  readonly shownAskIds?: ReadonlySet<string>;
  readonly isPermissionShown?: boolean;
  readonly isRebaseStopped?: boolean;
  readonly failingCheckName?: string | null;
  readonly overlap?: BranchRowOverlap | null;
  readonly attention?: 'plan-approval' | 'needs-approval' | 'pr-approved';
};

const NO_ASKS: ReadonlySet<string> = new Set();

const rowFor = ({
  branch,
  asks = [],
  runningCount = 0,
  cards = [],
  shownAskIds = NO_ASKS,
  isPermissionShown = false,
  isRebaseStopped = false,
  failingCheckName = null,
  overlap = null,
  attention = undefined,
}: RowParams) => {
  const board = branchBoardOf({ session, branches: [branch], asks, agents: [], leads: [] });
  const [row] = board.rows;
  if (row === undefined) {
    throw new Error('no row');
  }
  const entries = branchEntriesOf({ facts: [branch], detailByMountId: new Map() });
  const entry = [...entries.live, ...entries.finished][0] ?? null;
  return branchRowOf({
    row:
      attention === undefined
        ? row
        : { ...row, group: 'needs-you', stage: { ...row.stage, attention } },
    entry,
    runningCount,
    cards: cards.map((kind) => ({ kind })),
    shownAskIds,
    isPermissionShown,
    isRebaseStopped,
    failingCheckName,
    overlap,
  });
};

describe('branchRowOf', () => {
  it('rung 1: says Merged with Remove worktree, and Closed with nothing', () => {
    expect(rowFor({ branch: branchOf({ state: 'merged', checks: 'success' }) })).toMatchObject({
      rung: 'settled',
      word: { word: 'Merged', tone: 'merged' },
      action: { kind: 'remove', mountId: 'ledger' },
    });
    expect(rowFor({ branch: branchOf({ state: 'closed', checks: 'success' }) })).toMatchObject({
      rung: 'settled',
      word: { word: 'Closed', tone: 'neutral' },
      action: { kind: 'none' },
    });
  });

  it('rung 2: says Asks you with Answer over failing checks, and never offers Rebase', () => {
    expect(
      rowFor({
        branch: branchOf({ checks: 'failure' }),
        asks: [ASK],
        cards: ['rebase-project', 'question'],
      }),
    ).toEqual({
      rung: 'asked',
      word: { word: NAMES.asksYou, tone: 'warning' },
      action: { kind: 'card', index: 1 },
      hoverFacts: [],
      caution: null,
    });
  });

  it('rung 2: opens the first question no card answers, and none when Needs you shows it all', () => {
    expect(rowFor({ branch: branchOf({}), asks: [ASK], cards: ['rebase-project'] }).action).toEqual(
      { kind: 'question', questionId: 'ask-1' },
    );
    expect(
      rowFor({
        branch: branchOf({}),
        asks: [ASK],
        cards: ['rebase-project'],
        shownAskIds: new Set(['ask-1']),
      }).action,
    ).toEqual({ kind: 'none' });
  });

  it('rung 3: says Rebase stopped with Open rebase', () => {
    expect(
      rowFor({ branch: branchOf({}), isRebaseStopped: true, runningCount: 1, cards: ['merge-pr'] }),
    ).toMatchObject({
      rung: 'stopped',
      word: { word: NAMES.rebaseStopped, tone: 'warning' },
      action: { kind: 'open', label: NAMES.openRebase, fact: 'rebasing' },
    });
  });

  it('rung 4: says Needs permission with Open, and the plan approval as Needs approval', () => {
    expect(
      rowFor({ branch: branchOf({ checks: 'pending' }), attention: 'needs-approval' }),
    ).toMatchObject({
      rung: 'permission',
      word: { word: NAMES.waitingForPermission, tone: 'warning' },
      action: { kind: 'open', label: 'Open', fact: null },
    });
    expect(
      rowFor({
        branch: branchOf({ checks: 'pending' }),
        cards: ['approve-tool'],
        attention: 'plan-approval',
      }),
    ).toMatchObject({
      word: { word: NAMES.needsApproval },
      action: { kind: 'card', index: 0 },
    });
  });

  it('rung 4: drops the permission word while the Needs you tile asks for it', () => {
    expect(
      rowFor({
        branch: branchOf({ checks: 'pending' }),
        isPermissionShown: true,
        cards: ['rebase-project'],
        attention: 'needs-approval',
      }),
    ).toMatchObject({ rung: 'permission', word: null, action: { kind: 'none' } });
  });

  it('keeps Ready to merge and Merge on an approved pull request grouped under Needs you', () => {
    expect(
      rowFor({
        branch: branchOf({ checks: 'success', reviewDecision: 'approved' }),
        cards: ['merge-pr'],
        isPermissionShown: true,
        attention: 'pr-approved',
      }),
    ).toMatchObject({
      rung: 'ready',
      word: { word: 'Approved' },
      action: { kind: 'card', index: 0 },
    });
  });

  it('rung 5: says Checks failing in red, or the named check, over Running', () => {
    expect(rowFor({ branch: branchOf({ checks: 'failure' }), runningCount: 1 })).toMatchObject({
      rung: 'blocked',
      word: { word: 'Checks failing', tone: 'danger' },
      action: { kind: 'open', label: 'Open check', fact: 'checks-failing' },
    });
    expect(
      rowFor({
        branch: branchOf({ checks: 'failure' }),
        failingCheckName: 'static-analysis',
        cards: ['fix-checks'],
      }),
    ).toMatchObject({
      word: { word: 'static-analysis failed' },
      action: { kind: 'card', index: 0 },
    });
  });

  it('rung 5: offers Rebase on Conflicts and Open comments on Changes requested', () => {
    expect(
      rowFor({
        branch: branchOf({ checks: 'success', isMergeable: false, behind: 3 }),
        cards: ['push-branch', 'rebase-project'],
      }),
    ).toMatchObject({
      rung: 'blocked',
      word: { word: 'Conflicts' },
      action: { kind: 'card', index: 1 },
    });
    expect(
      rowFor({
        branch: branchOf({ checks: 'success', reviewDecision: 'changes_requested' }),
      }),
    ).toMatchObject({
      word: { word: 'Changes requested' },
      action: { kind: 'open', label: 'Open comments', fact: 'changes-requested' },
    });
  });

  it('rung 6: says Running with no action', () => {
    expect(
      rowFor({ branch: branchOf({ checks: 'pending' }), runningCount: 2, cards: ['push-branch'] }),
    ).toMatchObject({
      rung: 'running',
      word: { word: NAMES.running, tone: 'info' },
      action: { kind: 'none' },
    });
  });

  it('rung 7: says Checks running with no action', () => {
    expect(
      rowFor({ branch: branchOf({ checks: 'pending' }), cards: ['push-branch'] }),
    ).toMatchObject({
      rung: 'waiting',
      word: { word: 'Checks running' },
      action: { kind: 'none' },
    });
  });

  it('rung 8: says Ready to merge with Merge', () => {
    expect(
      rowFor({ branch: branchOf({ checks: 'success' }), cards: ['push-branch', 'merge-pr'] }),
    ).toMatchObject({
      rung: 'ready',
      word: { word: 'Ready to merge', tone: 'success' },
      action: { kind: 'card', index: 1 },
    });
  });

  it('rung 9: says Not pushed with Push, No pull request with Open PR, Draft with Mark ready', () => {
    expect(
      rowFor({ branch: branchOf({ hasRequest: false }), cards: ['push-branch'] }),
    ).toMatchObject({
      rung: 'your-move',
      word: { word: 'Not pushed' },
      action: { kind: 'card', index: 0 },
    });
    expect(
      rowFor({ branch: branchOf({ hasRequest: false, push: 'pushed' }), cards: ['open-pr'] }),
    ).toMatchObject({ word: { word: NAMES.noPullRequest }, action: { kind: 'card', index: 0 } });
    expect(rowFor({ branch: branchOf({ isDraft: true }), cards: ['mark-ready'] })).toMatchObject({
      word: { word: 'Draft' },
      action: { kind: 'card', index: 0 },
    });
  });

  it('rung 9: says N behind main with Rebase on an open branch that fell behind', () => {
    expect(rowFor({ branch: branchOf({ behind: 4 }), cards: ['rebase-project'] })).toMatchObject({
      rung: 'your-move',
      word: { word: '4 behind main' },
      action: { kind: 'card', index: 0 },
    });
  });

  it('names the open pull request by its kind, the number living in the same line', () => {
    expect(rowFor({ branch: branchOf({}) }).word?.word).toBe('PR open');
    expect(rowFor({ branch: branchOf({ noun: '!' }) }).word?.word).toBe('MR open');
  });

  it('keeps what lost the ladder in the hover facts, once each', () => {
    expect(
      rowFor({ branch: branchOf({ checks: 'failure', behind: 2 }), runningCount: 2 }).hoverFacts,
    ).toEqual(['2 runs', '2 behind main']);
  });

  it('puts the overlap caution on a ready row only, once, and never on a settled one', () => {
    const overlap = { fileCount: 3, otherName: 'Northwind invoice cleanup' };
    const sentence = '3 shared files. Merge Northwind invoice cleanup first.';

    expect(rowFor({ branch: branchOf({ checks: 'success' }), overlap })).toMatchObject({
      caution: sentence,
      hoverFacts: [],
    });
    expect(rowFor({ branch: branchOf({ checks: 'failure' }), overlap }).caution).toBeNull();
    expect(rowFor({ branch: branchOf({ state: 'merged' }), overlap }).hoverFacts).toEqual([]);
  });

  it('never lets the word and the action come from two rungs', () => {
    const cases: ReadonlyArray<RowParams> = [
      { branch: branchOf({ state: 'merged' }) },
      { branch: branchOf({}), asks: [ASK], cards: ['rebase-project'] },
      { branch: branchOf({}), isRebaseStopped: true, cards: ['rebase-project'] },
      { branch: branchOf({ checks: 'pending' }), attention: 'needs-approval' },
      { branch: branchOf({ checks: 'failure' }), cards: ['rebase-project', 'fix-checks'] },
      { branch: branchOf({ checks: 'pending' }), runningCount: 1, cards: ['rebase-project'] },
      { branch: branchOf({ checks: 'pending' }), cards: ['rebase-project'] },
      { branch: branchOf({ checks: 'success', behind: 3 }), cards: ['rebase-project', 'merge-pr'] },
      { branch: branchOf({ hasRequest: false }), cards: ['rebase-project', 'push-branch'] },
    ];
    const rows = cases.map((params) => ({
      params,
      row: rowFor(params),
    }));
    expect(rows.map(({ row }) => [row.rung, row.word?.word, row.action.kind])).toEqual([
      ['settled', 'Merged', 'remove'],
      ['asked', 'Asks you', 'question'],
      ['stopped', 'Rebase stopped', 'open'],
      ['permission', 'Needs permission', 'open'],
      ['blocked', 'Checks failing', 'card'],
      ['running', 'Running', 'none'],
      ['waiting', 'Checks running', 'none'],
      ['ready', 'Ready to merge', 'card'],
      ['your-move', 'Not pushed', 'card'],
    ]);
    const mergeRow = rows[7];
    const pushRow = rows[8];
    expect(mergeRow?.row.action).toEqual({ kind: 'card', index: 1 });
    expect(pushRow?.row.action).toEqual({ kind: 'card', index: 1 });
  });
});
