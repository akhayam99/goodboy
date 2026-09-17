import { describe, expect, it } from 'vitest';
import type { AgentId, MountId, SessionId, WorkflowRunId } from '@goodboy/types';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import {
  getArtifactProvenance,
  putArtifactProvenance,
  updateArtifactRun,
} from './artifact-provenance';

const sessionId = 'session' as SessionId;
const agentId = 'agent' as AgentId;
const sourceRunId = 'run-source' as WorkflowRunId;
const executingRunId = 'run-executing' as WorkflowRunId;
const mountId = 'mount' as MountId;

const seed = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(db);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Northwind', 'northwind', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'ship payments-api', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES ('workflow', 'workspace', 'Delivery', 1, 1)",
  );
  await db.execute(
    `INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, created_at)
     VALUES ('run-source', 'session', 'workflow', 0, 0, 1)`,
  );
  await db.execute(
    `INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, created_at)
     VALUES ('run-executing', 'session', 'workflow', 1, 0, 1)`,
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent', 'session', 0, 'Reporter', 'completed')",
  );
  return db;
};

const input = {
  agentId,
  sessionId,
  kind: 'report',
  brief: 'explain what ledger-core changed',
  evidence: [
    { kind: 'session', id: 'session', label: 'ship payments-api' },
    { kind: 'agent', id: 'agent', label: 'Reporter' },
  ],
  omissions: ['agents: kept the last 12 of 30'],
  designProfileSummary: null,
  hasDesignEvidence: false,
  phase: 'producing',
  scoutPlan: [],
  mountIds: [],
  target: null,
  deadlineAt: null,
  sourceWorkflowRunId: sourceRunId,
  executingWorkflowRunId: executingRunId,
} as const;

describe('artifact provenance queries', () => {
  it('returns null when a generation recorded nothing', async () => {
    const db = await seed();
    expect(await getArtifactProvenance({ db, agentId })).toBeNull();
  });

  it('round trips a recorded generation', async () => {
    const db = await seed();
    await putArtifactProvenance({ db, input });
    const stored = await getArtifactProvenance({ db, agentId });
    expect(stored?.brief).toBe('explain what ledger-core changed');
    expect(stored?.kind).toBe('report');
    expect(stored?.evidence).toEqual(input.evidence);
    expect(stored?.omissions).toEqual(input.omissions);
    expect(stored?.sourceWorkflowRunId).toBe(sourceRunId);
    expect(stored?.executingWorkflowRunId).toBe(executingRunId);
    expect(stored?.designProfileSummary).toBeNull();
    expect(stored?.hasDesignEvidence).toBe(false);
  });

  it('keeps a missing brief and a wireframe design profile apart', async () => {
    const db = await seed();
    await putArtifactProvenance({
      db,
      input: {
        ...input,
        kind: 'wireframe',
        brief: null,
        designProfileSummary: 'theme name: Harborline\ncommit: abc1234',
        hasDesignEvidence: true,
        sourceWorkflowRunId: null,
        executingWorkflowRunId: executingRunId,
      },
    });
    const stored = await getArtifactProvenance({ db, agentId });
    expect(stored?.brief).toBeNull();
    expect(stored?.kind).toBe('wireframe');
    expect(stored?.designProfileSummary).toContain('Harborline');
    expect(stored?.hasDesignEvidence).toBe(true);
    expect(stored?.sourceWorkflowRunId).toBeNull();
    expect(stored?.executingWorkflowRunId).toBe(executingRunId);
  });

  it('replaces the row when the same agent records again', async () => {
    const db = await seed();
    await putArtifactProvenance({ db, input });
    await putArtifactProvenance({ db, input: { ...input, brief: 'second request' } });
    const rows = await db.select('SELECT agent_id FROM artifact_provenance');
    expect(rows).toHaveLength(1);
    const stored = await getArtifactProvenance({ db, agentId });
    expect(stored?.brief).toBe('second request');
  });

  it('keeps a summary that names no design file apart from real evidence', async () => {
    const db = await seed();
    await putArtifactProvenance({
      db,
      input: {
        ...input,
        kind: 'wireframe',
        designProfileSummary: 'theme name: generic\ncommit: abc1234',
        hasDesignEvidence: false,
      },
    });
    const stored = await getArtifactProvenance({ db, agentId });
    expect(stored?.designProfileSummary).toContain('generic');
    expect(stored?.hasDesignEvidence).toBe(false);
  });

  it('round trips the run a reload has to pick back up', async () => {
    const db = await seed();
    await putArtifactProvenance({
      db,
      input: {
        ...input,
        kind: 'wireframe',
        phase: 'gathering',
        scoutPlan: [
          { roleId: 'screens', mountId, reason: 'the goal names a route', agentId },
          { roleId: 'data', mountId, reason: 'the screens need field names', agentId: null },
        ],
        mountIds: [mountId],
        target: 'mobile',
        deadlineAt: 361_000,
      },
    });
    const stored = await getArtifactProvenance({ db, agentId });
    expect(stored?.phase).toBe('gathering');
    expect(stored?.scoutPlan).toEqual([
      { roleId: 'screens', mountId, reason: 'the goal names a route', agentId },
      { roleId: 'data', mountId, reason: 'the screens need field names', agentId: null },
    ]);
    expect(stored?.mountIds).toEqual([mountId]);
    expect(stored?.target).toBe('mobile');
    expect(stored?.deadlineAt).toBe(361_000);
  });

  it('moves a run on without rewriting the rest of the row', async () => {
    const db = await seed();
    await putArtifactProvenance({
      db,
      input: { ...input, phase: 'gathering', mountIds: [mountId], target: 'desktop' },
    });
    await updateArtifactRun({
      db,
      input: {
        agentId,
        phase: 'producing',
        scoutPlan: [{ roleId: 'screens', mountId, reason: 'the goal names a route', agentId }],
      },
    });
    const stored = await getArtifactProvenance({ db, agentId });
    expect(stored?.phase).toBe('producing');
    expect(stored?.scoutPlan).toHaveLength(1);
    expect(stored?.brief).toBe('explain what ledger-core changed');
    expect(stored?.mountIds).toEqual([mountId]);
    expect(stored?.target).toBe('desktop');
  });

  it('drops malformed scout plan entries instead of failing the read', async () => {
    const db = await seed();
    await putArtifactProvenance({ db, input });
    await db.execute('UPDATE artifact_provenance SET scout_plan_json = ? WHERE agent_id = ?', [
      JSON.stringify([
        { roleId: 'screens' },
        { mountId: 'mount' },
        'loose',
        { roleId: 'data', mountId: 'mount' },
      ]),
      agentId,
    ]);
    const stored = await getArtifactProvenance({ db, agentId });
    expect(stored?.scoutPlan).toEqual([{ roleId: 'data', mountId, reason: '', agentId: null }]);
  });

  it('drops malformed evidence entries instead of failing the read', async () => {
    const db = await seed();
    await db.execute(
      `INSERT INTO artifact_provenance (
         agent_id, session_id, kind, brief, evidence_json, omissions_json,
         design_profile_summary, source_workflow_run_id, executing_workflow_run_id, created_at
       ) VALUES ('agent', 'session', 'report', NULL, ?, ?, NULL, NULL, NULL, 1000)`,
      [JSON.stringify([{ id: 'agent' }, { kind: 'agent' }, 'loose']), JSON.stringify(['ok', 7])],
    );
    const stored = await getArtifactProvenance({ db, agentId });
    expect(stored?.evidence).toEqual([{ kind: 'unknown', id: 'agent', label: 'agent' }]);
    expect(stored?.omissions).toEqual(['ok']);
  });
});
