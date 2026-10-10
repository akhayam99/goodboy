// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProjectId, SessionExternalTask, SessionId } from '@goodboy/types';
import { matrixOf } from '../../../__tests__/helpers/actionMatrix';
import { TASK_KIND, type TaskFacts } from './task';
import type { TaskMoveChoice } from './taskMoveTargets';

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

const facts = ({
  task,
  branch,
  branchCount = 0,
  moveTargets = [],
}: {
  readonly task: SessionExternalTask;
  readonly branch: string | null;
  readonly branchCount?: number;
  readonly moveTargets?: ReadonlyArray<TaskMoveChoice>;
}): TaskFacts => ({
  sessionId: SESSION,
  provider: task.provider,
  externalId: task.externalId,
  projectId: task.projectId ?? null,
  identifier: task.identifier,
  row: task,
  branch,
  branchCount,
  moveTargets,
  isOnlyOnSession: branchCount === 0,
});

const SESSION_CHOICE: TaskMoveChoice = {
  id: 'session',
  label: 'This session',
  isCurrent: false,
  to: { kind: 'session' },
};

const BRANCH_CHOICE: TaskMoveChoice = {
  id: 'branch:project-payments-api:hl/ledger-rounding',
  label: 'payments-api · hl/ledger-rounding',
  isCurrent: false,
  to: {
    kind: 'branch',
    projectId: 'project-payments-api' as ProjectId,
    branch: 'hl/ledger-rounding',
  },
};

describe('task actions', () => {
  it('offers open and unlink on a task not on a branch yet', () => {
    expect(
      matrixOf({
        definitions: TASK_KIND.actions,
        facts: facts({ task: row({}), branch: null }),
      }),
    ).toEqual(['task.open chip', 'task.unlink hover']);
  });

  it('adds take off on a branch row', () => {
    expect(
      matrixOf({
        definitions: TASK_KIND.actions,
        facts: facts({
          task: row({ scope: 'branch', branch: 'hl/ledger-export' }),
          branch: 'hl/ledger-export',
          branchCount: 1,
        }),
      }),
    ).toEqual(['task.open chip', 'task.takeOff hover', 'task.unlink menu']);
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
        facts: facts({ task: row({}), branch: null, moveTargets: [SESSION_CHOICE, BRANCH_CHOICE] }),
      }),
    ).toEqual(['task.open chip', 'task.moveTo menu', 'task.unlink hover']);
  });

  it('lists This session only when the task is on a branch, and checks the current one', () => {
    const onBranch = row({ scope: 'branch', branch: 'hl/ledger-rounding' });
    const moveTo = TASK_KIND.actions.find((action) => action.id === 'task.moveTo');
    const current = { ...BRANCH_CHOICE, isCurrent: true };
    const choices = moveTo?.choices?.({
      facts: facts({
        task: onBranch,
        branch: 'hl/ledger-rounding',
        branchCount: 1,
        moveTargets: [SESSION_CHOICE, current],
      }),
    });
    expect(choices?.map(({ label, isCurrent }) => [label, isCurrent])).toEqual([
      ['This session', false],
      ['payments-api · hl/ledger-rounding', true],
    ]);
    const sessionOnly = moveTo?.choices?.({
      facts: facts({ task: row({}), branch: null, moveTargets: [SESSION_CHOICE, BRANCH_CHOICE] }),
    });
    expect(sessionOnly?.map(({ label }) => label)).toEqual(['payments-api · hl/ledger-rounding']);
  });
});
