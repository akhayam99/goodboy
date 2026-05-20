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
      skipInit: false,
      userStatus: 'wip',
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
      skipInit: false,
      userStatus: 'wip',
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
      skipInit: false,
      userStatus: 'wip',
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
    if (!fetched) throw new Error('fetched should not be null');
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
    if (!agents[0]) throw new Error('agents[0] should exist');
    expect(agents[0].status).toBe('pending');

    await updateAgentStatus(db, agent.id, {
      status: 'completed',
      outputSummary: 'Found issues',
    });
    const updated = await listAgentsForSession(db, session.id);

    if (!updated[0]) throw new Error('updated[0] should exist');
    expect(updated[0].status).toBe('completed');
    expect(updated[0].outputSummary).toBe('Found issues');

    await deleteWorkflow(db, workflow.id);
    const deleted = await getWorkflow(db, workflow.id);
    expect(deleted).toBeNull();
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
      skipInit: false,
      userStatus: 'wip',
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
      skipInit: false,
      userStatus: 'wip',
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
    if (!fetched) throw new Error('fetched should not be null');
    expect(fetched.id).toBe(group1.id);
    expect(fetched.mergeStrategy).toBe('last_write_wins');
    expect(fetched.completedAt).toBeNull();

    const completedAt = now();
    await updateGroupCompletedAt(db, group1.id, completedAt);
    const updated = await getGroupById(db, group1.id);
    expect(updated).not.toBeNull();
    if (!updated) throw new Error('updated should not be null');
    expect(updated.completedAt).toBe(completedAt);

    await deleteGroup(db, group1.id);
    const afterDelete = await listGroupsForSession(db, session.id);
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0]!.id).toBe(group2.id);
  });
});
