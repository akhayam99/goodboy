// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  SessionExternalTask,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import { matrixOf } from '../../../__tests__/helpers/actionMatrix';
import { TASK_KIND, type TaskFacts } from './task';

const SESSION = 'session-ledger-export' as SessionId;

const row = (overrides: Partial<SessionExternalTask>): SessionExternalTask => ({
  sessionId: SESSION,
  provider: 'linear',
  externalId: 'lin-412',
  identifier: 'HBL-412',
  title: 'Duplicate credit on webhook redelivery',
  url: 'https://linear.app/harborline/issue/HBL-412',
  createdAt: '2026-10-02T09:00:00.000Z' as IsoDateTime,
  scope: 'session',
  ...overrides,
});

const PAYMENTS = 'project-payments-api' as ProjectId;

const mountOn = (branch: string): SessionProjectMount => ({
  mountId: `mount-${branch}` as MountId,
  sessionId: SESSION,
  projectId: PAYMENTS,
  mountName: 'payments-api',
  worktreePath: '/worktrees/payments-api',
  lastWorktreePath: null,
  repoRoot: '/code/payments-api',
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

type FactsParams = {
  readonly task: SessionExternalTask;
  readonly branch: string | null;
  readonly branchCount?: number;
  readonly mounts?: ReadonlyArray<SessionProjectMount>;
};

const facts = ({ task, branch, branchCount = 0, mounts = [] }: FactsParams): TaskFacts => ({
  sessionId: SESSION,
  provider: task.provider,
  externalId: task.externalId,
  projectId: task.projectId ?? null,
  identifier: task.identifier,
  row: task,
  branch,
  branchCount,
  rows: [task],
  mounts,
  projectNames: { [PAYMENTS]: 'payments-api' },
  isOnlyOnSession: branchCount === 0,
});

describe('task actions', () => {
  it('offers open and unlink on a task not on a branch yet', () => {
    expect(
      matrixOf({
        definitions: TASK_KIND.actions,
        facts: facts({ task: row({}), branch: null }),
      }),
    ).toEqual(['task.open chip', 'task.unlink hover']);
  });

  it('adds take off and Move to session on a branch row', () => {
    expect(
      matrixOf({
        definitions: TASK_KIND.actions,
        facts: facts({
          task: row({ scope: 'branch', branch: 'hl/ledger-export' }),
          branch: 'hl/ledger-export',
          branchCount: 1,
        }),
      }),
    ).toEqual(['task.open chip', 'task.moveTo menu', 'task.takeOff hover', 'task.unlink menu']);
  });

  it('runs reversible removals without confirmation', () => {
    const unlink = TASK_KIND.actions.find((action) => action.id === 'task.unlink');
    const takeOff = TASK_KIND.actions.find((action) => action.id === 'task.takeOff');
    expect(unlink?.confirm).toBeUndefined();
    expect(unlink?.isUndoable).toBe(true);
    expect(takeOff?.confirm).toBeUndefined();
    expect(takeOff?.isUndoable).toBe(true);
  });

  it('offers Move to in the menu once a branch can take the task', () => {
    expect(
      matrixOf({
        definitions: TASK_KIND.actions,
        facts: facts({ task: row({}), branch: null, mounts: [mountOn('hl/ledger-rounding')] }),
      }),
    ).toEqual(['task.open chip', 'task.moveTo menu', 'task.unlink hover']);
  });

  it('offers no Move to when no branch is open', () => {
    expect(
      matrixOf({ definitions: TASK_KIND.actions, facts: facts({ task: row({}), branch: null }) }),
    ).not.toContain('task.moveTo menu');
  });

  it('lists This session only when the task is on a branch, and checks the current one', () => {
    const onBranch = row({ scope: 'branch', branch: 'hl/ledger-rounding', projectId: PAYMENTS });
    const moveTo = TASK_KIND.actions.find((action) => action.id === 'task.moveTo');
    const choices = moveTo?.choices?.({
      facts: facts({
        task: onBranch,
        branch: 'hl/ledger-rounding',
        branchCount: 1,
        mounts: [mountOn('hl/ledger-rounding'), mountOn('hl/fix-duplicate-credit')],
      }),
    });
    expect(choices?.map(({ label, isCurrent }) => [label, isCurrent])).toEqual([
      ['This session', false],
      ['payments-api · hl/ledger-rounding', true],
      ['payments-api · hl/fix-duplicate-credit', false],
    ]);
    const sessionOnly = moveTo?.choices?.({
      facts: facts({ task: row({}), branch: null, mounts: [mountOn('hl/fix-duplicate-credit')] }),
    });
    expect(sessionOnly?.map(({ label }) => label)).toEqual([
      'payments-api · hl/fix-duplicate-credit',
    ]);
  });

  it('cuts a long branch name in the middle', () => {
    const long = 'hl/a-very-long-branch-name-that-keeps-going-past-the-limit-of-the-menu';
    const moveTo = TASK_KIND.actions.find((action) => action.id === 'task.moveTo');
    const label = moveTo?.choices?.({
      facts: facts({ task: row({}), branch: null, mounts: [mountOn(long)] }),
    })?.[0]?.label;
    expect(label).toMatch(/^payments-api · hl\/a-very-long.+….+of-the-menu$/);
  });
});
