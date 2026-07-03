import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  ParallelGroup,
  ParallelGroupId,
  Agent,
  AgentId,
  Session,
  SessionId,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/types';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';
import { getWorkspaceById, insertWorkspace } from '../queries/workspace';
import { getSessionById, insertSession } from '../queries/session';
import { listWorkflows, getWorkflow, upsertWorkflow, deleteWorkflow } from '../queries/workflow';
import { listAgentsForSession, insertAgent, updateAgentStatus } from '../queries/agent';
import {
  insertSessionWorktree,
  listWorktreesForSession,
  deleteWorktreesForSession,
} from '../queries/session-worktree';
import {
  insertGroup,
  listGroupsForSession,
  getGroupById,
  deleteGroup,
  updateGroupCompletedAt,
} from '../queries/parallel-group';

const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

describe('migrate', () => {
  it('applies all migrations on a fresh db', async () => {
    const db = makeTestDatabase();
    const result = await migrate(db);
    expect(result.applied).toEqual(migrations.map((m) => m.version));
    expect(result.skipped).toEqual([]);
    expect(result.currentVersion).toBe(migrations.at(-1)?.version);
  });

  it('is idempotent: re-running applies nothing', async () => {
    const db = makeTestDatabase();
    await migrate(db);
    const second = await migrate(db);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(migrations.map((m) => m.version));
  });

  it('round-trips a workspace through the schema', async () => {
    const db = makeTestDatabase();
    await migrate(db);

    const workspace: Workspace = {
      id: 'ws_1' as WorkspaceId,
      name: 'demo',
      rootPath: '/tmp/demo',
      createdAt: now(),
      updatedAt: now(),
    };
    await insertWorkspace(db, workspace);
    const fetched = await getWorkspaceById(db, workspace.id);

    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('demo');
    expect(fetched?.rootPath).toBe('/tmp/demo');
  });

  it('round-trips a session with discriminated turn state', async () => {
    const db = makeTestDatabase();
    await migrate(db);

    const workspace: Workspace = {
      id: 'ws_2' as WorkspaceId,
      name: 'demo',
      rootPath: '/tmp/demo2',
      createdAt: now(),
      updatedAt: now(),
    };
    await insertWorkspace(db, workspace);

    const session: Session = {
      id: 'session_1' as SessionId,
      workspaceId: workspace.id,
      goal: 'refactor auth',
      state: { kind: 'idle', lastActivityAt: now() },
      contextSlots: [],
      providerPreference: DEFAULT_SESSION_PROVIDER_PREFERENCE,
      permissionMode: 'bypassPermissions',
      autoRun: false,
      titleUserEdited: false,
      workflowRuns: [],
      createdAt: now(),
      updatedAt: now(),
    };
    await insertSession(db, session);
    const fetched = await getSessionById(db, session.id);

    expect(fetched).not.toBeNull();
    expect(fetched?.goal).toBe('refactor auth');
    expect(fetched?.state.kind).toBe('idle');
  });

  it('round-trips session providerPreference columns', async () => {
    const db = makeTestDatabase();
    await migrate(db);

    const workspace: Workspace = {
      id: 'ws_3' as WorkspaceId,
      name: 'prov-test',
      rootPath: '/tmp/demo3',
      createdAt: now(),
      updatedAt: now(),
    };
    await insertWorkspace(db, workspace);

    const session: Session = {
      id: 'session_2' as SessionId,
      workspaceId: workspace.id,
      goal: 'test provider pref',
      state: { kind: 'draft' },
      contextSlots: [],
      providerPreference: { defaultProvider: 'cursor', allowTurnOverride: false },
      permissionMode: 'bypassPermissions',
      autoRun: false,
      titleUserEdited: false,
      workflowRuns: [],
      createdAt: now(),
      updatedAt: now(),
    };
    await insertSession(db, session);
    const fetched = await getSessionById(db, session.id);

    expect(fetched?.providerPreference.defaultProvider).toBe('cursor');
    expect(fetched?.providerPreference.allowTurnOverride).toBe(false);
  });

  it('round-trips workflows with steps and agents', async () => {
    const db = makeTestDatabase();
    await migrate(db);

    const workspace: Workspace = {
      id: 'ws_4' as WorkspaceId,
      name: 'workflow-test',
      rootPath: '/tmp/demo4',
      createdAt: now(),
      updatedAt: now(),
    };
    await insertWorkspace(db, workspace);

    const session: Session = {
      id: 'session_3' as SessionId,
      workspaceId: workspace.id,
      goal: 'test workflow',
      state: { kind: 'draft' },
      contextSlots: [],
      providerPreference: DEFAULT_SESSION_PROVIDER_PREFERENCE,
      permissionMode: 'bypassPermissions',
      autoRun: false,
      titleUserEdited: false,
      workflowRuns: [],
      createdAt: now(),
      updatedAt: now(),
    };
    await insertSession(db, session);

    const step1: Step = {
      id: 'step_1' as StepId,
      workflowId: 'wf_1' as WorkflowId,
      ordinal: 0,
      name: 'Discovery',
      promptPrefix: 'Analyze the codebase.',
      providerOverride: 'anthropic',
    };

    const step2: Step = {
      id: 'step_2' as StepId,
      workflowId: 'wf_1' as WorkflowId,
      ordinal: 1,
      name: 'Implementation',
      promptPrefix: 'Implement the solution.',
    };

    const workflow: Workflow = {
      id: 'wf_1' as WorkflowId,
      workspaceId: workspace.id,
      name: 'Workflow',
      description: 'A standard workflow',
      steps: [step1, step2],
      createdAt: now(),
      updatedAt: now(),
    };

    await upsertWorkflow(db, workflow);
    const fetched = await getWorkflow(db, workflow.id);

    expect(fetched).not.toBeNull();
    if (!fetched) {
      throw new Error('fetched should not be null');
    }
    expect(fetched.name).toBe('Workflow');
    expect(fetched.steps).toHaveLength(2);
    expect(fetched.steps[0]!.name).toBe('Discovery');
    expect(fetched.steps[1]!.name).toBe('Implementation');

    const list = await listWorkflows(db, workspace.id);
    expect(list).toHaveLength(1);
    expect(list[0]!.steps).toHaveLength(2);

    const agent: Agent = {
      id: 'agent_1' as AgentId,
      sessionId: session.id,
      stepId: step1.id,
      ordinal: 0,
      name: 'Discovery',
      status: 'pending',
    };

    await insertAgent(db, agent);
    const agents = await listAgentsForSession(db, session.id);

    expect(agents).toHaveLength(1);
    if (!agents[0]) {
      throw new Error('agents[0] should exist');
    }
    expect(agents[0].status).toBe('pending');

    await updateAgentStatus(db, agent.id, {
      status: 'completed',
      outputSummary: 'Found issues',
    });
    const updated = await listAgentsForSession(db, session.id);

    if (!updated[0]) {
      throw new Error('updated[0] should exist');
    }
    expect(updated[0].status).toBe('completed');
    expect(updated[0].outputSummary).toBe('Found issues');

    await deleteWorkflow(db, workflow.id);
    const listAfterDelete = await listWorkflows(db, workflow.workspaceId);
    expect(listAfterDelete.find((w) => w.id === workflow.id)).toBeUndefined();
    const deleted = await getWorkflow(db, workflow.id);
    expect(deleted).not.toBeNull();
    expect(deleted?.deletedAt).toBeTruthy();
  });

  it('round-trips session_worktrees: insert, list, delete', async () => {
    const db = makeTestDatabase();
    await migrate(db);

    const workspace: Workspace = {
      id: 'ws_wt' as WorkspaceId,
      name: 'wt-test',
      rootPath: '/tmp/wt-test',
      createdAt: now(),
      updatedAt: now(),
    };
    await insertWorkspace(db, workspace);

    const session: Session = {
      id: 'session_wt' as SessionId,
      workspaceId: workspace.id,
      goal: 'worktree test',
      state: { kind: 'draft' },
      contextSlots: [],
      providerPreference: DEFAULT_SESSION_PROVIDER_PREFERENCE,
      permissionMode: 'bypassPermissions',
      autoRun: false,
      titleUserEdited: false,
      workflowRuns: [],
      createdAt: now(),
      updatedAt: now(),
    };
    await insertSession(db, session);

    await insertSessionWorktree(db, {
      id: 'wt_1',
      sessionId: session.id,
      worktreePath: '/tmp/worktrees/wt_1',
      branch: 'kay/feat-1',
      parallelIndex: 0,
      createdAt: Date.now(),
    });
    await insertSessionWorktree(db, {
      id: 'wt_2',
      sessionId: session.id,
      worktreePath: '/tmp/worktrees/wt_2',
      branch: 'kay/feat-2',
      parallelIndex: 1,
      createdAt: Date.now(),
    });

    const rows = await listWorktreesForSession(db, session.id);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.worktreePath).toBe('/tmp/worktrees/wt_1');
    expect(rows[0]!.parallelIndex).toBe(0);
    expect(rows[1]!.worktreePath).toBe('/tmp/worktrees/wt_2');
    expect(rows[1]!.parallelIndex).toBe(1);

    await deleteWorktreesForSession(db, session.id);
    const afterDelete = await listWorktreesForSession(db, session.id);
    expect(afterDelete).toHaveLength(0);
  });

  it('round-trips parallel_groups: insert, list, get, update, delete', async () => {
    const db = makeTestDatabase();
    await migrate(db);

    const workspace: Workspace = {
      id: 'ws_pg' as WorkspaceId,
      name: 'pg-test',
      rootPath: '/tmp/pg-test',
      createdAt: now(),
      updatedAt: now(),
    };
    await insertWorkspace(db, workspace);

    const session: Session = {
      id: 'session_pg' as SessionId,
      workspaceId: workspace.id,
      goal: 'parallel group test',
      state: { kind: 'draft' },
      contextSlots: [],
      providerPreference: DEFAULT_SESSION_PROVIDER_PREFERENCE,
      permissionMode: 'bypassPermissions',
      autoRun: false,
      titleUserEdited: false,
      workflowRuns: [],
      createdAt: now(),
      updatedAt: now(),
    };
    await insertSession(db, session);

    const group1: ParallelGroup = {
      id: 'pg_1' as ParallelGroupId,
      sessionId: session.id,
      ordinal: 0,
      mergeStrategy: 'last_write_wins',
      createdAt: now(),
      completedAt: null,
    };

    const group2: ParallelGroup = {
      id: 'pg_2' as ParallelGroupId,
      sessionId: session.id,
      ordinal: 1,
      mergeStrategy: 'manual',
      createdAt: now(),
      completedAt: null,
    };

    await insertGroup(db, group1);
    await insertGroup(db, group2);

    const groups = await listGroupsForSession(db, session.id);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.ordinal).toBe(0);
    expect(groups[0]!.mergeStrategy).toBe('last_write_wins');
    expect(groups[1]!.ordinal).toBe(1);
    expect(groups[1]!.mergeStrategy).toBe('manual');

    const fetched = await getGroupById(db, group1.id);
    expect(fetched).not.toBeNull();
    if (!fetched) {
      throw new Error('fetched should not be null');
    }
    expect(fetched.id).toBe(group1.id);
    expect(fetched.mergeStrategy).toBe('last_write_wins');
    expect(fetched.completedAt).toBeNull();

    const completedAt = now();
    await updateGroupCompletedAt(db, group1.id, completedAt);
    const updated = await getGroupById(db, group1.id);
    expect(updated).not.toBeNull();
    if (!updated) {
      throw new Error('updated should not be null');
    }
    expect(updated.completedAt).toBe(completedAt);

    await deleteGroup(db, group1.id);
    const afterDelete = await listGroupsForSession(db, session.id);
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0]!.id).toBe(group2.id);
  });
});

const upToV66 = migrations.filter((m) => m.version <= 66);

const withCrashOn = (db: Database, shouldCrash: (sql: string) => boolean): Database => {
  let armed = true;
  const crash = (sql: string): void => {
    if (armed && shouldCrash(sql)) {
      armed = false;
      throw new Error('simulated crash');
    }
  };
  return {
    async exec(sql) {
      crash(sql);
      await db.exec(sql);
    },
    async execute(sql, params = []) {
      crash(sql);
      return db.execute(sql, params);
    },
    select: (sql, params) => db.select(sql, params),
  };
};

const seedProviderRun = async (db: Database): Promise<void> => {
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ['ws_crash', 'crash-test', '/tmp/crash-test', Date.now(), Date.now()],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ['session_crash', 'ws_crash', 'crash test', 'idle', Date.now(), Date.now()],
  );
  await db.execute(
    'INSERT INTO provider_runs (id, session_id, provider, model, status_kind, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ['run_crash', 'session_crash', 'anthropic', 'claude-opus-4', 'succeeded', Date.now()],
  );
};

describe('migrate crash safety', () => {
  it('rolls back an interrupted table rebuild instead of losing the table', async () => {
    const db = makeTestDatabase();
    await migrate(db, upToV66);
    await seedProviderRun(db);

    const crashing = withCrashOn(db, (sql) =>
      sql.startsWith('ALTER TABLE provider_runs_new RENAME'),
    );
    await expect(migrate(crashing)).rejects.toThrow('simulated crash');

    const runs = await db.select<{ id: string }>('SELECT id FROM provider_runs');
    expect(runs).toEqual([{ id: 'run_crash' }]);
    const recorded = await db.select<{ version: number }>(
      'SELECT version FROM schema_version WHERE version = 67',
    );
    expect(recorded).toHaveLength(0);
  });

  it('completes the chain and preserves data on the run after a crash', async () => {
    const db = makeTestDatabase();
    await migrate(db, upToV66);
    await seedProviderRun(db);

    const crashing = withCrashOn(db, (sql) =>
      sql.startsWith('ALTER TABLE provider_runs_new RENAME'),
    );
    await expect(migrate(crashing)).rejects.toThrow('simulated crash');

    const result = await migrate(db);
    expect(result.applied).toContain(67);
    expect(result.currentVersion).toBe(migrations.at(-1)?.version);

    const runs = await db.select<{ id: string; provider: string }>(
      'SELECT id, provider FROM provider_runs',
    );
    expect(runs).toEqual([{ id: 'run_crash', provider: 'anthropic' }]);
  });

  it('records a version only together with its migration', async () => {
    const db = makeTestDatabase();
    await migrate(db, upToV66);
    await seedProviderRun(db);

    const crashing = withCrashOn(db, (sql) =>
      sql.startsWith('INSERT OR IGNORE INTO schema_version'),
    );
    await expect(migrate(crashing)).rejects.toThrow('simulated crash');

    const versions = await db.select<{ v: number }>('SELECT MAX(version) AS v FROM schema_version');
    expect(versions).toEqual([{ v: 66 }]);
    const runs = await db.select<{ id: string }>('SELECT id FROM provider_runs');
    expect(runs).toEqual([{ id: 'run_crash' }]);
  });

  it('does not destroy surviving data left behind by an old interrupted rebuild', async () => {
    const db = makeTestDatabase();
    await migrate(db, upToV66);
    await seedProviderRun(db);

    const m067 = migrations.find((m) => m.version === 67);
    const statements = (m067?.sql ?? '')
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      if (stmt.startsWith('ALTER TABLE provider_runs_new RENAME')) {
        break;
      }
      await db.exec(stmt);
    }

    await expect(migrate(db)).rejects.toThrow('no such table');
    const survivors = await db.select<{ id: string }>('SELECT id FROM provider_runs_new');
    expect(survivors).toEqual([{ id: 'run_crash' }]);
  });

  it('starts clean when a previous run left a transaction open', async () => {
    const db = makeTestDatabase();
    await db.exec('BEGIN');
    const result = await migrate(db);
    expect(result.applied).toEqual(migrations.map((m) => m.version));
  });

  it('keeps foreign key enforcement on after the chain runs', async () => {
    const db = makeTestDatabase();
    await migrate(db);
    const fk = await db.select<{ foreign_keys: number }>('PRAGMA foreign_keys');
    expect(fk).toEqual([{ foreign_keys: 1 }]);
  });
});
