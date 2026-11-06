import { beforeEach, describe, expect, it } from 'vitest';
import { brandId } from '@goodboy/types';
import type {
  IsoDateTime,
  SessionId,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import type { Database } from '../client';
import { attachWorkflowToSession, updateUserWorkflowRunTitle } from './session-workflow';
import { updateGeneratedWorkflowRunTitle } from './generated-workflow-run-title';
import { getSessionById, renameSession } from './session';

const workspaceId = brandId<WorkspaceId>({ value: 'ws-1' });
const sessionId = brandId<SessionId>({ value: 'ses-1' });
const workflowId = brandId<WorkflowId>({ value: 'wf-1' });
const runId = brandId<WorkflowRunId>({ value: 'run-1' });
const NOW = brandId<IsoDateTime>({ value: '2026-06-12T00:00:00.000Z' });
const GOAL = 'fix the login redirect loop';
const THINKING_ALOUD = 'Il titolo è in italiano, quindi';

type DbParams = {
  readonly db: Database;
};

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  const now = Date.now();
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'Northwind', '/tmp/northwind', now, now],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, workspaceId, 'Original goal', 'idle', now, now],
  );
  await db.execute(
    'INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [workflowId, workspaceId, 'Workflow 1', '', now, now],
  );
  await attachWorkflowToSession({
    db,
    sessionId,
    workflowRunId: runId,
    workflowId,
    autoRun: false,
    updatedAt: NOW,
    goal: GOAL,
  });
  return db;
};

const readRunTitle = async ({ db }: DbParams): Promise<string | undefined> =>
  (await getSessionById(db, sessionId))?.workflowRuns[0]?.title;

const readStoredRunTitle = async ({ db }: DbParams): Promise<string | undefined> => {
  const rows = await db.select<{ readonly title: string | null }>(
    'SELECT title FROM session_workflows WHERE workflow_run_id = ?',
    [runId],
  );
  return rows[0]?.title ?? undefined;
};

describe('run titles on read', () => {
  let db: Database;

  beforeEach(async () => {
    db = await seed();
  });

  it('shows the goal derived title for an old thinking aloud title and writes nothing', async () => {
    await db.execute('UPDATE session_workflows SET title = ? WHERE workflow_run_id = ?', [
      THINKING_ALOUD,
      runId,
    ]);

    expect(await readRunTitle({ db })).toBe('fix login redirect');
    expect(await readStoredRunTitle({ db })).toBe(THINKING_ALOUD);
  });

  it('keeps an old title that passes the check', async () => {
    await updateGeneratedWorkflowRunTitle({ db, workflowRunId: runId, title: 'Fix login loop' });

    expect(await readRunTitle({ db })).toBe('Fix login loop');
  });

  it('never rewrites a name the user chose, even one that reads like talk', async () => {
    await updateUserWorkflowRunTitle({ db, workflowRunId: runId, title: 'Title generation' });

    expect(await readRunTitle({ db })).toBe('Title generation');
  });

  it('discards a generated write that talks about the title and stores the derived one', async () => {
    const written = await updateGeneratedWorkflowRunTitle({
      db,
      workflowRunId: runId,
      title: 'Auto routed to Claude Haiku',
    });

    expect(written).toBe('fix login redirect');
    expect(await readStoredRunTitle({ db })).toBe('fix login redirect');
  });
});

describe('renameSession by a generated title', () => {
  let db: Database;

  beforeEach(async () => {
    db = await seed();
  });

  it('replaces a generated title', async () => {
    await renameSession(db, sessionId, 'Block double credits', NOW, false);

    const stored = await getSessionById(db, sessionId);
    expect(stored?.goal).toBe('Block double credits');
    expect(stored?.titleUserEdited).toBe(false);
  });

  it('never replaces a name the user chose', async () => {
    await renameSession(db, sessionId, 'Ledger cleanup', NOW);
    await renameSession(db, sessionId, 'Block double credits', NOW, false);

    const stored = await getSessionById(db, sessionId);
    expect(stored?.goal).toBe('Ledger cleanup');
    expect(stored?.titleUserEdited).toBe(true);
  });

  it('lets the user rename again', async () => {
    await renameSession(db, sessionId, 'Ledger cleanup', NOW);
    await renameSession(db, sessionId, 'Ledger tidy', NOW);

    expect((await getSessionById(db, sessionId))?.goal).toBe('Ledger tidy');
  });
});
