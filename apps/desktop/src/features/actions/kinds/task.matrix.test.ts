// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, SessionExternalTask, SessionId } from '@goodboy/types';
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

const facts = ({
  task,
  branch,
  branchCount = 0,
  canPut = true,
}: {
  readonly task: SessionExternalTask;
  readonly branch: string | null;
  readonly branchCount?: number;
  readonly canPut?: boolean;
}): TaskFacts => ({
  sessionId: SESSION,
  provider: task.provider,
  externalId: task.externalId,
  projectId: task.projectId ?? null,
  identifier: task.identifier,
  row: task,
  branch,
  branchCount,
  canPut,
});

describe('task actions', () => {
  it('offers open, put on a branch and unlink on a task not on a branch yet', () => {
    expect(
      matrixOf({
        definitions: TASK_KIND.actions,
        facts: facts({ task: row({}), branch: null }),
      }),
    ).toEqual(['task.open menu', 'task.putOnBranch menu', 'task.unlink menu']);
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
    ).toEqual(['task.open menu', 'task.takeOff menu', 'task.putOnBranch menu', 'task.unlink menu']);
  });

  it('hides put on a branch while the session has no worktree', () => {
    expect(
      matrixOf({
        definitions: TASK_KIND.actions,
        facts: facts({ task: row({}), branch: null, canPut: false }),
      }),
    ).toEqual(['task.open menu', 'task.unlink menu']);
  });

  it('says what unlink does to a task that sits on branches', () => {
    const unlink = TASK_KIND.actions.find((action) => action.id === 'task.unlink');
    const confirm = unlink?.confirm?.({
      facts: facts({ task: row({}), branch: null, branchCount: 2 }),
    });
    expect(confirm?.title).toBe('Remove link to HBL-412 from this session?');
    expect(confirm?.description).toBe('It also leaves 2 branches.');
  });
});
