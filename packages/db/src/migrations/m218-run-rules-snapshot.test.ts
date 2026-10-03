import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKFLOW_RULES,
  type IsoDateTime,
  type SessionId,
  type WorkflowId,
  type WorkflowRunId,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  SESSION_WORKFLOW_COLS,
  attachWorkflowToSession,
  toWorkflowRun,
  type SessionWorkflowRow,
} from '../queries/session-workflow';
import { migrations } from './index';
import { migrate } from './runner';

const SESSION = 'session' as SessionId;

describe('m218 run rules snapshot', () => {
  it('keeps runs that existed without a copy and stores the copy of a new run', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 217 });
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('harborline', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'harborline', 'Goal', 'idle', 1, 1)",
    );
    await db.execute(
      "INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at, is_preset) VALUES ('workflow', 'harborline', 'Feature', '', 1, 1, 0)",
    );
    await db.execute(
      "INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run, trigger_mode, execution_mode, created_at) VALUES ('old', 'session', 'workflow', 0, 0, 0, 'immediate', 'static', 1)",
    );

    await migrate(db, migrations);
    const rules = { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan' as const, spendLimitUsd: 25 };
    await attachWorkflowToSession({
      db,
      workflowRunId: 'new' as WorkflowRunId,
      sessionId: SESSION,
      workflowId: 'workflow' as WorkflowId,
      autoRun: true,
      updatedAt: '2026-10-03T10:00:00.000Z' as IsoDateTime,
      rulesSnapshot: rules,
    });
    const rows = await db.select<SessionWorkflowRow>(
      `SELECT ${SESSION_WORKFLOW_COLS} FROM session_workflows WHERE session_id = ? ORDER BY ordinal`,
      [SESSION],
    );
    const runs = rows.map(toWorkflowRun);

    expect(runs.map((run) => [run.id, run.rulesSnapshot ?? null])).toEqual([
      ['old', null],
      ['new', rules],
    ]);
  });
});
