// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type MountId } from '@goodboy/types';
import { aProject, nextSessionId } from '@goodboy/types/testing';
import { aMountRow } from './central/branches/testing/aMountRow';
import { branchRunLinkOf } from './branchRunLinkOf';
import { aMountView } from './testing/aMountView';
import { aSessionRun } from './testing/aSessionRun';

const SESSION = nextSessionId();
const PAYMENTS = aProject({ name: 'payments-api' });
const NOTIFY = aProject({ name: 'notify-relay' });

const viewOf = (params: { readonly key: string; readonly branch: string }) =>
  aMountView({
    key: params.key,
    sessionId: SESSION,
    projectId: PAYMENTS.id,
    projectName: 'payments-api',
    branch: params.branch,
  });

const DUP = viewOf({ key: 'dup', branch: 'fix/duplicate-credit' });
const RETRY = aMountView({
  key: 'retry',
  sessionId: SESSION,
  projectId: NOTIFY.id,
  projectName: 'notify-relay',
  branch: 'feat/retry-budget',
});

const branchOf = (view: typeof DUP) => ({
  mountId: view.id,
  projectId: view.projectId,
  projectName: view.mountName,
  branch: view.branch,
  worktreePath: view.worktreePath,
});

const MOUNTS = [
  aMountRow({ key: 'dup', projectName: 'payments-api', branch: 'fix/duplicate-credit' }),
  aMountRow({ key: 'retry', projectName: 'notify-relay', branch: 'feat/retry-budget' }),
];

describe('branchRunLinkOf', () => {
  it('counts each run once on the branch and names the group it lands on', () => {
    const runs = [
      aSessionRun({ id: 'block', branches: [branchOf(DUP)] }),
      aSessionRun({ id: 'limit', branches: [branchOf(DUP), branchOf(RETRY)] }),
      aSessionRun({ id: 'explain' }),
    ];

    expect(branchRunLinkOf({ runs, mounts: MOUNTS, mountId: DUP.id })).toEqual({
      groupKey: `mount:${DUP.id}`,
      count: 2,
      label: '2 runs',
    });
    expect(branchRunLinkOf({ runs, mounts: MOUNTS, mountId: RETRY.id })?.label).toBe('1 run');
  });

  it('is absent when no run touched the branch', () => {
    const runs = [aSessionRun({ id: 'explain' })];

    expect(
      branchRunLinkOf({
        runs,
        mounts: MOUNTS,
        mountId: brandId<MountId>({ value: 'mount-elsewhere' }),
      }),
    ).toBeNull();
    expect(branchRunLinkOf({ runs: [], mounts: MOUNTS, mountId: DUP.id })).toBeNull();
  });

  it('lands on the series group when the branch is a part of a series', () => {
    const part = {
      ...aMountRow({ key: 'dup', projectName: 'payments-api', branch: 'fix/duplicate-credit' }),
      series: {
        seriesId: 'series-rec',
        name: 'Ledger reconciliation',
        position: 1,
        plannedCount: 3,
        label: '1',
      },
    };
    const runs = [aSessionRun({ id: 'split', branches: [branchOf(DUP)] })];

    expect(branchRunLinkOf({ runs, mounts: [part], mountId: DUP.id })?.groupKey).toBe(
      'series:series-rec',
    );
  });
});
