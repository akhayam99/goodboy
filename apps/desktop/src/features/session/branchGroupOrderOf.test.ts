// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aProject, nextSessionId } from '@goodboy/types/testing';
import type { MountRowView } from '../../store/slices/project-mounts/mountRowModel';
import { aMountRow, aRequest } from './central/branches/testing/aMountRow';
import { branchGroupOrderOf } from './branchGroupOrderOf';
import { branchGroupsOf, NO_BRANCH_KEY } from './branchGroupsOf';
import type { SessionRun } from './sessionRunsOf';
import { aMountView } from './testing/aMountView';
import { aSessionRun } from './testing/aSessionRun';

const SESSION = nextSessionId();
const PAYMENTS = aProject({ name: 'payments-api' });
const LEDGER = aProject({ name: 'ledger-core' });
const NOTIFY = aProject({ name: 'notify-relay' });

type BranchParams = {
  readonly key: string;
  readonly project: typeof PAYMENTS;
  readonly branch: string;
};

const branchOf = ({ key, project, branch }: BranchParams) => {
  const view = aMountView({
    key,
    sessionId: SESSION,
    projectId: project.id,
    projectName: project.name,
    branch,
  });
  return {
    mountId: view.id,
    projectId: project.id,
    projectName: project.name,
    branch,
    worktreePath: view.worktreePath,
  };
};

const MERGED = branchOf({ key: 'merged', project: PAYMENTS, branch: 'fix/duplicate-credit' });
const CLOSED = branchOf({ key: 'closed', project: LEDGER, branch: 'rec/old-backfill' });
const OPEN = branchOf({ key: 'open', project: NOTIFY, branch: 'feat/retry-budget' });
const FRESH = branchOf({ key: 'fresh', project: LEDGER, branch: 'rec/1-schema' });
const GONE = branchOf({ key: 'gone', project: PAYMENTS, branch: 'fix/refund-window' });

const MOUNTS: ReadonlyArray<MountRowView> = [
  {
    ...aMountRow({
      key: 'merged',
      projectName: 'payments-api',
      branch: 'fix/duplicate-credit',
      request: aRequest({ provider: 'github', number: 10198, state: 'merged' }),
    }),
    isFinished: true,
  },
  {
    ...aMountRow({
      key: 'closed',
      projectName: 'ledger-core',
      branch: 'rec/old-backfill',
      request: aRequest({ provider: 'gitlab', number: 41, state: 'closed' }),
    }),
    isFinished: true,
  },
  aMountRow({
    key: 'open',
    projectName: 'notify-relay',
    branch: 'feat/retry-budget',
    request: aRequest({ provider: 'github', number: 10240 }),
  }),
  aMountRow({ key: 'fresh', projectName: 'ledger-core', branch: 'rec/1-schema' }),
  {
    ...aMountRow({ key: 'gone', projectName: 'payments-api', branch: 'fix/refund-window' }),
    isAttached: false,
  },
];

type DoneParams = {
  readonly id: string;
  readonly startedAt: number;
  readonly branches?: SessionRun['branches'];
  readonly goneBranches?: SessionRun['goneBranches'];
};

const doneRun = ({ id, startedAt, branches = [], goneBranches = [] }: DoneParams) =>
  aSessionRun({
    id,
    dot: 'done',
    stateWord: 'Done',
    isFinished: true,
    startedAt,
    branches,
    goneBranches,
  });

type OrderParams = {
  readonly runs: ReadonlyArray<SessionRun>;
};

const orderOf = ({ runs }: OrderParams) => {
  const order = branchGroupOrderOf({
    groups: branchGroupsOf({ runs, mounts: MOUNTS }),
    mounts: MOUNTS,
  });
  return {
    shown: order.shown.map((group) => group.key),
    finished: order.finished.map((group) => group.key),
  };
};

describe('branchGroupOrderOf', () => {
  it('lists an open branch above a merged one even when the merged one moved last', () => {
    const order = orderOf({
      runs: [
        doneRun({ id: 'old', startedAt: 200, branches: [MERGED] }),
        doneRun({ id: 'new', startedAt: 100, branches: [OPEN] }),
      ],
    });

    expect(order.shown).toEqual([`mount:${OPEN.mountId}`]);
    expect(order.finished).toEqual([`mount:${MERGED.mountId}`]);
  });

  it('keeps a merged branch in view while one of its runs is live', () => {
    const order = orderOf({
      runs: [aSessionRun({ id: 'live', branches: [MERGED], startedAt: 10 })],
    });

    expect(order.shown).toEqual([`mount:${MERGED.mountId}`]);
    expect(order.finished).toEqual([]);
  });

  it('lifts No branch to the top when one of its runs needs you', () => {
    const order = orderOf({
      runs: [
        aSessionRun({ id: 'run', branches: [OPEN], startedAt: 300 }),
        aSessionRun({ id: 'ask', dot: 'needsYou', stateWord: 'Needs you', startedAt: 10 }),
      ],
    });

    expect(order.shown).toEqual([NO_BRANCH_KEY, `mount:${OPEN.mountId}`]);
  });

  it('puts needs you, then running, then open branches newest first', () => {
    const order = orderOf({
      runs: [
        doneRun({ id: 'none', startedAt: 50 }),
        doneRun({ id: 'fresh', startedAt: 400, branches: [FRESH] }),
        aSessionRun({ id: 'run', branches: [OPEN], startedAt: 10 }),
        aSessionRun({
          id: 'ask',
          branches: [MERGED],
          dot: 'needsYou',
          stateWord: 'Needs you',
          startedAt: 5,
        }),
      ],
    });

    expect(order.shown).toEqual([
      `mount:${MERGED.mountId}`,
      `mount:${OPEN.mountId}`,
      `mount:${FRESH.mountId}`,
      NO_BRANCH_KEY,
    ]);
  });

  it('files closed and merged branches as finished, newest first', () => {
    const order = orderOf({
      runs: [
        doneRun({ id: 'merged', startedAt: 100, branches: [MERGED] }),
        doneRun({ id: 'closed', startedAt: 200, branches: [CLOSED] }),
      ],
    });

    expect(order.shown).toEqual([]);
    expect(order.finished).toEqual([`mount:${CLOSED.mountId}`, `mount:${MERGED.mountId}`]);
  });

  it('files a branch whose worktree was removed as finished once its runs are done', () => {
    const order = orderOf({
      runs: [
        doneRun({ id: 'gone', startedAt: 500, goneBranches: [GONE] }),
        doneRun({ id: 'open', startedAt: 100, branches: [OPEN] }),
      ],
    });

    expect(order.shown).toEqual([`mount:${OPEN.mountId}`]);
    expect(order.finished).toEqual([`mount:${GONE.mountId}`]);
  });
});
