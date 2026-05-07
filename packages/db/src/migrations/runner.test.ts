import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  ParallelPhaseGroup,
  ParallelPhaseGroupId,
  PhaseDefinition,
  PhaseDefinitionId,
  PhaseRun,
  PhaseRunId,
  PhaseTemplate,
  PhaseTemplateId,
  Session,
  SessionId,
  Workspace,
  WorkspaceId,
} from '@kay-am/types';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@kay-am/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';
import { getWorkspaceById, insertWorkspace } from '../queries/workspace';
import { getSessionById, insertSession } from '../queries/session';
import {
  listPhaseTemplates,
  getPhaseTemplate,
  upsertPhaseTemplate,
  deletePhaseTemplate,
} from '../queries/phase-templates';
import {
  listPhaseRunsForSession,
  insertPhaseRun,
  updatePhaseRunStatus,
} from '../queries/phase-runs';
import {
  insertSessionWorktree,
  listWorktreesForSession,
  deleteWorktreesForSession,
} from '../queries/session-worktrees';
import {
  insertGroup,
  listGroupsForSession,
  getGroupById,
  deleteGroup,
  updateGroupCompletedAt,
} from '../queries/parallel-phases';

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

  it('round-trips a session with discriminated state', async () => {
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
      id: 'sess_1' as SessionId,
      workspaceId: workspace.id,
      goal: 'refactor auth',
      state: { kind: 'idle', lastActivityAt: now() },
      contextSlots: [],
      providerPreference: DEFAULT_SESSION_PROVIDER_PREFERENCE,
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
      id: 'sess_2' as SessionId,
      workspaceId: workspace.id,
      goal: 'test provider pref',
      state: { kind: 'draft' },
      contextSlots: [],
      providerPreference: { defaultProvider: 'cursor', allowTurnOverride: false },
      createdAt: now(),
      updatedAt: now(),
    };
    await insertSession(db, session);
    const fetched = await getSessionById(db, session.id);

    expect(fetched?.providerPreference.defaultProvider).toBe('cursor');
    expect(fetched?.providerPreference.allowTurnOverride).toBe(false);
  });

  it('round-trips phase templates with definitions and phase runs', async () => {
    const db = makeTestDatabase();
    await migrate(db);

    const workspace: Workspace = {
      id: 'ws_4' as WorkspaceId,
      name: 'phase-test',
      rootPath: '/tmp/demo4',
      createdAt: now(),
      updatedAt: now(),
    };
    await insertWorkspace(db, workspace);

    const session: Session = {
      id: 'sess_3' as SessionId,
      workspaceId: workspace.id,
      goal: 'test phases',
      state: { kind: 'draft' },
      contextSlots: [],
      providerPreference: DEFAULT_SESSION_PROVIDER_PREFERENCE,
      createdAt: now(),
      updatedAt: now(),
    };
    await insertSession(db, session);

    const def1: PhaseDefinition = {
      id: 'pdef_1' as PhaseDefinitionId,
      templateId: 'pt_1' as PhaseTemplateId,
      ordinal: 0,
      name: 'Discovery',
      promptPrefix: 'Analyze the codebase.',
      providerOverride: 'anthropic',
    };

    const def2: PhaseDefinition = {
      id: 'pdef_2' as PhaseDefinitionId,
      templateId: 'pt_1' as PhaseTemplateId,
      ordinal: 1,
      name: 'Implementation',
      promptPrefix: 'Implement the solution.',
    };

    const template: PhaseTemplate = {
      id: 'pt_1' as PhaseTemplateId,
      workspaceId: workspace.id,
      name: 'Workflow',
      description: 'A standard workflow',
      definitions: [def1, def2],
      createdAt: now(),
      updatedAt: now(),
    };

    await upsertPhaseTemplate(db, template);
    const fetched = await getPhaseTemplate(db, template.id);

    expect(fetched).not.toBeNull();
    if (!fetched) throw new Error('fetched should not be null');
    expect(fetched.name).toBe('Workflow');
    expect(fetched.definitions).toHaveLength(2);
    expect(fetched.definitions[0]!.name).toBe('Discovery');
    expect(fetched.definitions[1]!.name).toBe('Implementation');

    const run: PhaseRun = {
      id: 'pr_1' as PhaseRunId,
      sessionId: session.id,
      phaseDefinitionId: def1.id,
      ordinal: 0,
      name: 'Discovery',
      status: 'pending',
    };

    await insertPhaseRun(db, run);
    const runs = await listPhaseRunsForSession(db, session.id);

    expect(runs).toHaveLength(1);
    if (!runs[0]) throw new Error('runs[0] should exist');
    expect(runs[0].status).toBe('pending');

    await updatePhaseRunStatus(db, run.id, { status: 'completed', outputSummary: 'Found issues' });
    const updated = await listPhaseRunsForSession(db, session.id);

    if (!updated[0]) throw new Error('updated[0] should exist');
    expect(updated[0].status).toBe('completed');
    expect(updated[0].outputSummary).toBe('Found issues');

    await deletePhaseTemplate(db, template.id);
    const deleted = await getPhaseTemplate(db, template.id);
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
      id: 'sess_wt' as SessionId,
      workspaceId: workspace.id,
      goal: 'worktree test',
      state: { kind: 'draft' },
      contextSlots: [],
      providerPreference: DEFAULT_SESSION_PROVIDER_PREFERENCE,
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

  it('round-trips parallel_phase_groups: insert, list, get, update, delete', async () => {
    const db = makeTestDatabase();
    await migrate(db);

    const workspace: Workspace = {
      id: 'ws_ppg' as WorkspaceId,
      name: 'ppg-test',
      rootPath: '/tmp/ppg-test',
      createdAt: now(),
      updatedAt: now(),
    };
    await insertWorkspace(db, workspace);

    const session: Session = {
      id: 'sess_ppg' as SessionId,
      workspaceId: workspace.id,
      goal: 'parallel phase group test',
      state: { kind: 'draft' },
      contextSlots: [],
      providerPreference: DEFAULT_SESSION_PROVIDER_PREFERENCE,
      createdAt: now(),
      updatedAt: now(),
    };
    await insertSession(db, session);

    const group1: ParallelPhaseGroup = {
      id: 'ppg_1' as ParallelPhaseGroupId,
      sessionId: session.id,
      ordinal: 0,
      mergeStrategy: 'last_write_wins',
      createdAt: now(),
      completedAt: null,
    };

    const group2: ParallelPhaseGroup = {
      id: 'ppg_2' as ParallelPhaseGroupId,
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

  it('backward-compat: sequential phases without group_id still work', async () => {
    const db = makeTestDatabase();
    await migrate(db);

    const workspace: Workspace = {
      id: 'ws_seq' as WorkspaceId,
      name: 'seq-test',
      rootPath: '/tmp/seq-test',
      createdAt: now(),
      updatedAt: now(),
    };
    await insertWorkspace(db, workspace);

    const session: Session = {
      id: 'sess_seq' as SessionId,
      workspaceId: workspace.id,
      goal: 'sequential phases test',
      state: { kind: 'draft' },
      contextSlots: [],
      providerPreference: DEFAULT_SESSION_PROVIDER_PREFERENCE,
      createdAt: now(),
      updatedAt: now(),
    };
    await insertSession(db, session);

    const def1: PhaseDefinition = {
      id: 'pdef_seq_1' as PhaseDefinitionId,
      templateId: 'pt_seq' as PhaseTemplateId,
      ordinal: 0,
      name: 'Phase 1',
      promptPrefix: 'First phase',
    };

    const def2: PhaseDefinition = {
      id: 'pdef_seq_2' as PhaseDefinitionId,
      templateId: 'pt_seq' as PhaseTemplateId,
      ordinal: 1,
      name: 'Phase 2',
      promptPrefix: 'Second phase',
    };

    const template: PhaseTemplate = {
      id: 'pt_seq' as PhaseTemplateId,
      workspaceId: workspace.id,
      name: 'Sequential Workflow',
      description: 'Sequential phases without groups',
      definitions: [def1, def2],
      createdAt: now(),
      updatedAt: now(),
    };

    await upsertPhaseTemplate(db, template);

    const run1: PhaseRun = {
      id: 'pr_seq_1' as PhaseRunId,
      sessionId: session.id,
      phaseDefinitionId: def1.id,
      ordinal: 0,
      name: 'Phase 1',
      status: 'completed',
    };

    const run2: PhaseRun = {
      id: 'pr_seq_2' as PhaseRunId,
      sessionId: session.id,
      phaseDefinitionId: def2.id,
      ordinal: 1,
      name: 'Phase 2',
      status: 'completed',
    };

    await insertPhaseRun(db, run1);
    await insertPhaseRun(db, run2);

    const runs = await listPhaseRunsForSession(db, session.id);
    expect(runs).toHaveLength(2);
    expect(runs[0]!.ordinal).toBe(0);
    expect(runs[1]!.ordinal).toBe(1);
  });
});
