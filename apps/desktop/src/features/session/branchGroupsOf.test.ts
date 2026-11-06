// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aProject, nextSessionId } from '@goodboy/types/testing';
import type { MountRowView } from '../../store/slices/project-mounts/mountRowModel';
import { aMountRow, aRequest } from './central/branches/testing/aMountRow';
import {
  alsoOnOf,
  branchGroupKeysOf,
  branchGroupShownCountOf,
  branchGroupsOf,
  NO_BRANCH_KEY,
} from './branchGroupsOf';
import { aMountView } from './testing/aMountView';
import { aSessionRun } from './testing/aSessionRun';
import { workBranchesOf } from './workBranchesOf';

const SESSION = nextSessionId();
const PAYMENTS = aProject({ name: 'payments-api' });
const LEDGER = aProject({ name: 'ledger-core' });
const NOTIFY = aProject({ name: 'notify-relay' });

const branchOf = (params: {
  readonly key: string;
  readonly project: typeof PAYMENTS;
  readonly branch: string;
}) => {
  const view = aMountView({
    key: params.key,
    sessionId: SESSION,
    projectId: params.project.id,
    projectName: params.project.name,
    branch: params.branch,
  });
  return {
    mountId: view.id,
    projectId: params.project.id,
    projectName: params.project.name,
    branch: params.branch,
    worktreePath: view.worktreePath,
  };
};

const DUP = branchOf({ key: 'dup', project: PAYMENTS, branch: 'fix/duplicate-credit' });
const REC1 = branchOf({ key: 'rec1', project: LEDGER, branch: 'rec/1-schema' });
const REC2 = branchOf({ key: 'rec2', project: LEDGER, branch: 'rec/2-backfill' });
const RETRY = branchOf({ key: 'retry', project: NOTIFY, branch: 'feat/retry-budget' });

const seriesPosition = (position: number) => ({
  seriesId: 'series-rec',
  name: 'Ledger reconciliation',
  position,
  plannedCount: 3,
  label: String(position),
});

const MOUNTS: ReadonlyArray<MountRowView> = [
  aMountRow({
    key: 'dup',
    projectName: 'payments-api',
    branch: 'fix/duplicate-credit',
    request: aRequest({ provider: 'github', number: 318 }),
  }),
  {
    ...aMountRow({ key: 'rec1', projectName: 'ledger-core', branch: 'rec/1-schema' }),
    series: seriesPosition(1),
  },
  {
    ...aMountRow({ key: 'rec2', projectName: 'ledger-core', branch: 'rec/2-backfill' }),
    series: seriesPosition(2),
  },
  aMountRow({ key: 'retry', projectName: 'notify-relay', branch: 'feat/retry-budget' }),
];

const keysOf = (groups: ReturnType<typeof branchGroupsOf>) => groups.map((group) => group.key);

describe('branchGroupsOf', () => {
  it('puts a run on one branch in the group of that branch with its pull request', () => {
    const block = aSessionRun({ id: 'block', branches: [DUP] });
    const groups = branchGroupsOf({ runs: [block], mounts: MOUNTS });

    expect(keysOf(groups)).toEqual([`mount:${DUP.mountId}`]);
    expect(groups[0]?.head).toMatchObject({ kind: 'branch', fact: '#318 Open' });
  });

  it('files a run split over the parts of a series once, under the series head with its parts', () => {
    const split = aSessionRun({ id: 'split', branches: [REC1, REC2] });
    const groups = branchGroupsOf({ runs: [split], mounts: MOUNTS });

    expect(keysOf(groups)).toEqual(['series:series-rec']);
    expect(groups[0]?.head).toMatchObject({ kind: 'series', name: 'Ledger reconciliation' });
    expect(groups[0]?.head.kind === 'series' ? groups[0].head.parts.length : 0).toBe(2);
  });

  it('repeats a run in every project branch it touches without counting it twice', () => {
    const limit = aSessionRun({ id: 'limit', branches: [DUP, RETRY] });
    const groups = branchGroupsOf({ runs: [limit], mounts: MOUNTS });

    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.runs.includes(limit))).toBe(true);
    expect(groups.flatMap((group) => group.runs.map((run) => run.id))).toEqual(['limit', 'limit']);
  });

  it('files a run on a series and on another project in both places', () => {
    const move = aSessionRun({ id: 'move', branches: [REC2, RETRY] });
    const groups = branchGroupsOf({ runs: [move], mounts: MOUNTS });

    expect(keysOf(groups)).toEqual(['series:series-rec', `mount:${RETRY.mountId}`]);
    expect(alsoOnOf({ run: move, groupKey: 'series:series-rec', mounts: MOUNTS })).toEqual([RETRY]);
    expect(alsoOnOf({ run: move, groupKey: `mount:${RETRY.mountId}`, mounts: MOUNTS })).toEqual([
      REC2,
    ]);
  });

  it('puts a run without a branch last, in No branch', () => {
    const explain = aSessionRun({ id: 'explain' });
    const block = aSessionRun({ id: 'block', branches: [DUP] });
    const groups = branchGroupsOf({ runs: [explain, block], mounts: MOUNTS });

    expect(keysOf(groups)).toEqual([`mount:${DUP.mountId}`, NO_BRANCH_KEY]);
    expect(groups[1]?.head).toEqual({ kind: 'none' });
  });

  it('lifts a group that holds something waiting for you above the others', () => {
    const quiet = aSessionRun({ id: 'quiet', branches: [DUP] });
    const waiting = aSessionRun({
      id: 'waiting',
      branches: [RETRY],
      dot: 'needsYou',
      stateWord: 'Needs you',
    });
    const groups = branchGroupsOf({ runs: [quiet, waiting], mounts: MOUNTS });

    expect(keysOf(groups)[0]).toBe(`mount:${RETRY.mountId}`);
    expect(groups[0]?.counts).toEqual({ needsYou: 1, running: 0, finished: 0 });
  });

  it('counts finished runs in the group and keeps the run list one row per run', () => {
    const done = aSessionRun({
      id: 'done',
      branches: [DUP],
      dot: 'done',
      stateWord: 'Done',
      isFinished: true,
    });
    const live = aSessionRun({ id: 'live', branches: [DUP] });
    const groups = branchGroupsOf({ runs: [live, done], mounts: MOUNTS });

    expect(groups[0]?.counts).toEqual({ needsYou: 0, running: 1, finished: 1 });
    expect(groups[0]?.runs.map((run) => run.id)).toEqual(['live', 'done']);
  });

  it('moves a run whose mount was detached to No branch', () => {
    const detached = aMountView({
      key: 'dup',
      sessionId: SESSION,
      projectId: PAYMENTS.id,
      projectName: 'payments-api',
      branch: 'fix/duplicate-credit',
      isAttached: false,
    });
    const branches = workBranchesOf({
      agentIds: [],
      agents: [],
      mounts: [detached],
      projects: [PAYMENTS],
    });
    const run = aSessionRun({ id: 'orphan', branches });

    expect(branchGroupKeysOf({ run, mounts: MOUNTS })).toEqual([NO_BRANCH_KEY]);
  });

  it('counts the runs a group shows and leaves archived ones out', () => {
    const runs = [
      aSessionRun({ id: 'live', branches: [DUP] }),
      aSessionRun({ id: 'done', branches: [DUP], isFinished: true }),
      aSessionRun({ id: 'old', branches: [DUP], isArchived: true }),
    ];
    const [group] = branchGroupsOf({ runs, mounts: MOUNTS });

    expect(group === undefined ? -1 : branchGroupShownCountOf({ group })).toBe(2);
  });
});
