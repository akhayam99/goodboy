import { beforeEach, describe, expect, it } from 'vitest';
import {
  brandId,
  DEFAULT_WORKFLOW_RULES,
  type IsoDateTime,
  type SessionId,
  type WorkflowId,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import type { Database } from '../client';
import {
  attachWorkflowToSession,
  getWorkflowRunRulesText,
  replaceWorkflowRunRulesIfUnchanged,
  updateWorkflowRunOrchestrationStop,
} from './session-workflow';
import { getSessionById } from './session';

const workspaceId = brandId<WorkspaceId>({ value: 'ws-1' });
const sessionId = brandId<SessionId>({ value: 'ses-1' });
const workflowId = brandId<WorkflowId>({ value: 'wf-1' });
const workflowRunId = brandId<WorkflowRunId>({ value: 'run-1' });
const NOW = brandId<IsoDateTime>({ value: '2026-06-12T00:00:00.000Z' });
const NOTIFY_RULES = { ...DEFAULT_WORKFLOW_RULES, spendLimitMode: 'notify' as const };

let db: Database;

const storedText = async (): Promise<string | null> =>
  (await getWorkflowRunRulesText({ db, workflowRunId }))?.text ?? null;

const stopOfRun = async () =>
  (await getSessionById(db, sessionId))?.workflowRuns?.find((run) => run.id === workflowRunId)
    ?.orchestrationStop;

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
    [workspaceId, 'Harborline', 'harborline'],
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, 'goal', 'idle', 1, 1)",
    [sessionId, workspaceId],
  );
  await db.execute(
    "INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at) VALUES (?, ?, 'Build', '', 1, 1)",
    [workflowId, workspaceId],
  );
  await attachWorkflowToSession({
    db,
    sessionId,
    workflowRunId,
    workflowId,
    autoRun: true,
    updatedAt: NOW,
    rulesSnapshot: DEFAULT_WORKFLOW_RULES,
  });
});

describe('replaceWorkflowRunRulesIfUnchanged', () => {
  it('writes the new rules when the stored text is the one the caller read', async () => {
    const expected = await storedText();

    const isWritten = await replaceWorkflowRunRulesIfUnchanged({
      db,
      workflowRunId,
      expected,
      rulesSnapshot: NOTIFY_RULES,
    });

    expect(isWritten).toBe(true);
    expect(await storedText()).toBe(JSON.stringify(NOTIFY_RULES));
  });

  it('refuses the write when another window changed the rules first', async () => {
    const expected = await storedText();
    await replaceWorkflowRunRulesIfUnchanged({
      db,
      workflowRunId,
      expected,
      rulesSnapshot: NOTIFY_RULES,
    });

    const isWritten = await replaceWorkflowRunRulesIfUnchanged({
      db,
      workflowRunId,
      expected,
      rulesSnapshot: DEFAULT_WORKFLOW_RULES,
    });

    expect(isWritten).toBe(false);
    expect(await storedText()).toBe(JSON.stringify(NOTIFY_RULES));
  });

  it('clears the stop only when asked and only when the write lands', async () => {
    await updateWorkflowRunOrchestrationStop(db, workflowRunId, {
      kind: 'budget',
      message: 'the limit is reached',
    });

    await replaceWorkflowRunRulesIfUnchanged({
      db,
      workflowRunId,
      expected: 'not what is stored',
      rulesSnapshot: NOTIFY_RULES,
      shouldClearStop: true,
    });
    expect((await stopOfRun())?.kind).toBe('budget');

    await replaceWorkflowRunRulesIfUnchanged({
      db,
      workflowRunId,
      expected: await storedText(),
      rulesSnapshot: NOTIFY_RULES,
      shouldClearStop: true,
    });
    expect(await stopOfRun()).toBeUndefined();
  });
});
