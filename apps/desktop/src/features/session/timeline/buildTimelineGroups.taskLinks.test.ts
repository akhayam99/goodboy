// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProjectId, SessionExternalTask, SessionId } from '@goodboy/types';
import { buildTimelineGroups } from './buildTimelineGroups';

const SESSION = 'session-northwind' as SessionId;
const TASK = {
  sessionId: SESSION,
  provider: 'linear',
  externalId: 'nw-142',
  identifier: 'NW-142',
  url: 'https://linear.app/northwind/issue/NW-142',
  title: 'Reconcile duplicate refunds',
  createdAt: '2026-10-03T10:00:00.000Z' as IsoDateTime,
} satisfies SessionExternalTask;

type Params = {
  readonly tasks: ReadonlyArray<SessionExternalTask>;
};

const issues = ({ tasks }: Params) =>
  buildTimelineGroups({
    sessionId: SESSION,
    agents: [],
    workflows: [],
    plans: [],
    artifacts: [],
    externalTasks: tasks,
    questions: [],
    worktrees: [],
    events: [],
    learnings: [],
    agentKindOverride: {},
  }).entries.filter((entry) => entry.kind === 'issue');

describe('Activity task identity', () => {
  it('shows one task row when the session and two branches hold it', () => {
    expect(
      issues({
        tasks: [
          TASK,
          { ...TASK, scope: 'branch', branch: 'nw/refunds' },
          { ...TASK, scope: 'branch', branch: 'nw/ledger' },
        ],
      }),
    ).toHaveLength(1);
  });

  it('keeps same-numbered tasks in different projects distinct', () => {
    const rows = issues({
      tasks: [
        { ...TASK, projectId: 'project-payments-api' as ProjectId },
        { ...TASK, projectId: 'project-ledger-core' as ProjectId },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.id)).size).toBe(2);
  });
});
