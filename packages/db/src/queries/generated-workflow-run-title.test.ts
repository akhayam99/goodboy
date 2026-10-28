import { beforeEach, describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type SessionId,
  type WorkflowId,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import type { Database } from '../client';
import { updateGeneratedWorkflowRunTitle } from './generated-workflow-run-title';
import { getSessionById } from './session';
import { attachWorkflowToSession, updateUserWorkflowRunTitle } from './session-workflow';

const WORKSPACE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const SESSION = brandId<SessionId>({ value: 'ses-harborline' });
const WORKFLOW = brandId<WorkflowId>({ value: 'wf-harborline' });
const RUN = brandId<WorkflowRunId>({ value: 'run-harborline' });
const NOW = brandId<IsoDateTime>({ value: '2026-10-28T09:00:00.000Z' });
const GOAL = 'Move patient settings under /patient/settings\nwith a centered layout';

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  const now = Date.now();
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [WORKSPACE, 'Harborline', '/tmp/harborline', now, now],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [SESSION, WORKSPACE, 'goal', 'idle', now, now],
  );
  await db.execute(
    'INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [WORKFLOW, WORKSPACE, 'Orchestrated', '', now, now],
  );
  await attachWorkflowToSession({
    db,
    sessionId: SESSION,
    workflowRunId: RUN,
    workflowId: WORKFLOW,
    autoRun: false,
    updatedAt: NOW,
    goal: GOAL,
  });
  return db;
};

type ReadParams = {
  readonly db: Database;
};

const storedTitleOf = async ({ db }: ReadParams): Promise<string | undefined> => {
  const session = await getSessionById(db, SESSION);
  return session?.workflowRuns[0]?.title;
};

describe('a generated run title', () => {
  let db: Database;

  beforeEach(async () => {
    db = await seed();
  });

  it('is stored without its Title label and quotes', async () => {
    const written = await updateGeneratedWorkflowRunTitle({
      db,
      workflowRunId: RUN,
      title: 'Title: "Center the patient settings"',
    });

    expect(written).toBe('Center the patient settings');
    expect(await storedTitleOf({ db })).toBe('Center the patient settings');
  });

  it('falls back to the first line of the ask when the reply is a leaked preamble', async () => {
    const written = await updateGeneratedWorkflowRunTitle({
      db,
      workflowRunId: RUN,
      title: 'Title: the user asked for a',
    });

    expect(written).toBe('Move patient settings under /patient/settings');
    expect(await storedTitleOf({ db })).toBe('Move patient settings under /patient/settings');
  });

  it('writes nothing when the reply and the ask are both empty', async () => {
    await db.execute("UPDATE session_workflows SET goal = '' WHERE workflow_run_id = ?", [RUN]);

    const written = await updateGeneratedWorkflowRunTitle({
      db,
      workflowRunId: RUN,
      title: 'Title:',
    });

    expect(written).toBeNull();
    expect(await storedTitleOf({ db })).toBeUndefined();
  });
});

describe('a run title read from the database', () => {
  let db: Database;

  beforeEach(async () => {
    db = await seed();
  });

  it('reads a stored leaked preamble as the first line of the ask', async () => {
    await db.execute('UPDATE session_workflows SET title = ? WHERE workflow_run_id = ?', [
      'Title: the user asked for a',
      RUN,
    ]);

    expect(await storedTitleOf({ db })).toBe('Move patient settings under /patient/settings');
  });

  it('reads a stored Title label and quotes as the bare title', async () => {
    await db.execute('UPDATE session_workflows SET title = ? WHERE workflow_run_id = ?', [
      'Title: "Fix login redirect loop"',
      RUN,
    ]);

    expect(await storedTitleOf({ db })).toBe('Fix login redirect loop');
  });

  it('never rewrites a name the user chose', async () => {
    await updateUserWorkflowRunTitle({ db, workflowRunId: RUN, title: 'Title: my own words' });

    expect(await storedTitleOf({ db })).toBe('Title: my own words');
  });
});
