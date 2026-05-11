import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  ParallelGroup,
  ParallelGroupId,
  Session,
  SessionId,
  Step,
  StepId,
  Task,
  TaskId,
  Workflow,
  WorkflowId,
  Workspace,
  WorkspaceId,
} from '@kay-am/types';
import { DEFAULT_TASK_PROVIDER_PREFERENCE } from '@kay-am/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';
import { getWorkspaceById, insertWorkspace } from '../queries/workspace';
import { getTaskById, insertTask } from '../queries/task';
import { listWorkflows, getWorkflow, upsertWorkflow, deleteWorkflow } from '../queries/workflow';
import { listSessionsForTask, insertSession, updateSessionStatus } from '../queries/session';
import {
  insertTaskWorktree,
  listWorktreesForTask,
  deleteWorktreesForTask,
} from '../queries/task-worktree';
import {
  insertGroup,
  listGroupsForTask,
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

  it('round-trips a task with discriminated turn state', async () => {
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

    const task: Task = {
      id: 'task_1' as TaskId,
      workspaceId: workspace.id,
      goal: 'refactor auth',
      state: { kind: 'idle', lastActivityAt: now() },
      contextSlots: [],
      providerPreference: DEFAULT_TASK_PROVIDER_PREFERENCE,
      permissionMode: 'bypassPermissions',
      autoRun: false,
      titleUserEdited: false,
      createdAt: now(),
      updatedAt: now(),
    };
    await insertTask(db, task);
    const fetched = await getTaskById(db, task.id);

    expect(fetched).not.toBeNull();
    expect(fetched?.goal).toBe('refactor auth');
    expect(fetched?.state.kind).toBe('idle');
  });

  it('round-trips task providerPreference columns', async () => {
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

    const task: Task = {
      id: 'task_2' as TaskId,
      workspaceId: workspace.id,
      goal: 'test provider pref',
      state: { kind: 'draft' },
      contextSlots: [],
      providerPreference: { defaultProvider: 'cursor', allowTurnOverride: false },
      permissionMode: 'bypassPermissions',
      autoRun: false,
      titleUserEdited: false,
      createdAt: now(),
      updatedAt: now(),
    };
    await insertTask(db, task);
    const fetched = await getTaskById(db, task.id);

    expect(fetched?.providerPreference.defaultProvider).toBe('cursor');
    expect(fetched?.providerPreference.allowTurnOverride).toBe(false);
  });

  it('round-trips workflows with steps and sessions', async () => {
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

    const task: Task = {
      id: 'task_3' as TaskId,
      workspaceId: workspace.id,
      goal: 'test workflow',
      state: { kind: 'draft' },
      contextSlots: [],
      providerPreference: DEFAULT_TASK_PROVIDER_PREFERENCE,
      permissionMode: 'bypassPermissions',
      autoRun: false,
      titleUserEdited: false,
      createdAt: now(),
      updatedAt: now(),
    };
    await insertTask(db, task);

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

    const session: Session = {
      id: 'sess_1' as SessionId,
      taskId: task.id,
      stepId: step1.id,
      ordinal: 0,
      name: 'Discovery',
      status: 'pending',
    };

    await insertSession(db, session);
    const sessions = await listSessionsForTask(db, task.id);

    expect(sessions).toHaveLength(1);
    if (!sessions[0]) throw new Error('sessions[0] should exist');
    expect(sessions[0].status).toBe('pending');

    await updateSessionStatus(db, session.id, {
      status: 'completed',
      outputSummary: 'Found issues',
    });
    const updated = await listSessionsForTask(db, task.id);

    if (!updated[0]) throw new Error('updated[0] should exist');
    expect(updated[0].status).toBe('completed');
    expect(updated[0].outputSummary).toBe('Found issues');

    await deleteWorkflow(db, workflow.id);
    const deleted = await getWorkflow(db, workflow.id);
    expect(deleted).toBeNull();
  });

  it('round-trips task_worktrees: insert, list, delete', async () => {
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

    const task: Task = {
      id: 'task_wt' as TaskId,
      workspaceId: workspace.id,
      goal: 'worktree test',
      state: { kind: 'draft' },
      contextSlots: [],
      providerPreference: DEFAULT_TASK_PROVIDER_PREFERENCE,
      permissionMode: 'bypassPermissions',
      autoRun: false,
      titleUserEdited: false,
      createdAt: now(),
      updatedAt: now(),
    };
    await insertTask(db, task);

    await insertTaskWorktree(db, {
      id: 'wt_1',
      taskId: task.id,
      worktreePath: '/tmp/worktrees/wt_1',
      branch: 'kay/feat-1',
      parallelIndex: 0,
      createdAt: Date.now(),
    });
    await insertTaskWorktree(db, {
      id: 'wt_2',
      taskId: task.id,
      worktreePath: '/tmp/worktrees/wt_2',
      branch: 'kay/feat-2',
      parallelIndex: 1,
      createdAt: Date.now(),
    });

    const rows = await listWorktreesForTask(db, task.id);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.worktreePath).toBe('/tmp/worktrees/wt_1');
    expect(rows[0]!.parallelIndex).toBe(0);
    expect(rows[1]!.worktreePath).toBe('/tmp/worktrees/wt_2');
    expect(rows[1]!.parallelIndex).toBe(1);

    await deleteWorktreesForTask(db, task.id);
    const afterDelete = await listWorktreesForTask(db, task.id);
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

    const task: Task = {
      id: 'task_pg' as TaskId,
      workspaceId: workspace.id,
      goal: 'parallel group test',
      state: { kind: 'draft' },
      contextSlots: [],
      providerPreference: DEFAULT_TASK_PROVIDER_PREFERENCE,
      permissionMode: 'bypassPermissions',
      autoRun: false,
      titleUserEdited: false,
      createdAt: now(),
      updatedAt: now(),
    };
    await insertTask(db, task);

    const group1: ParallelGroup = {
      id: 'pg_1' as ParallelGroupId,
      taskId: task.id,
      ordinal: 0,
      mergeStrategy: 'last_write_wins',
      createdAt: now(),
      completedAt: null,
    };

    const group2: ParallelGroup = {
      id: 'pg_2' as ParallelGroupId,
      taskId: task.id,
      ordinal: 1,
      mergeStrategy: 'manual',
      createdAt: now(),
      completedAt: null,
    };

    await insertGroup(db, group1);
    await insertGroup(db, group2);

    const groups = await listGroupsForTask(db, task.id);
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
    const afterDelete = await listGroupsForTask(db, task.id);
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0]!.id).toBe(group2.id);
  });
});
