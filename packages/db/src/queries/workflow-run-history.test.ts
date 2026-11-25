import { describe, expect, it } from 'vitest';
import { brandId, type WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { listWorkspaceWorkflowRuns } from './workflow-run-history';

const WORKSPACE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const OTHER_WORKSPACE = brandId<WorkspaceId>({ value: 'ws-northwind' });

type WorkspaceSeed = {
  readonly id: WorkspaceId;
  readonly name: string;
};

const WORKSPACES: ReadonlyArray<WorkspaceSeed> = [
  { id: WORKSPACE, name: 'Harborline' },
  { id: OTHER_WORKSPACE, name: 'Northwind' },
];
const LEDGER_AT = Date.parse('2026-10-15T15:08:00.000Z');
const NIGHTLY_AT = Date.parse('2026-10-14T15:00:00.000Z');
const ACME_AT = Date.parse('2026-10-10T15:00:00.000Z');

type DbParams = {
  readonly db: Database;
};

type SessionParams = DbParams & {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly goal: string;
  readonly archivedAt?: number | null;
  readonly deletedAt?: number | null;
};

const insertSession = async ({
  db,
  id,
  workspaceId,
  goal,
  archivedAt = null,
  deletedAt = null,
}: SessionParams): Promise<void> => {
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at, archived_at, deleted_at) VALUES (?, ?, ?, ?, 1, 1, ?, ?)',
    [id, workspaceId, goal, 'idle', archivedAt, deletedAt],
  );
};

type RunParams = DbParams & {
  readonly id: string;
  readonly sessionId: string;
  readonly createdAt: number;
  readonly workflowId?: string;
  readonly discardedAt?: number | null;
};

const insertRun = async ({
  db,
  id,
  sessionId,
  createdAt,
  workflowId = 'wf-flaky',
  discardedAt = null,
}: RunParams): Promise<void> => {
  await db.execute(
    'INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, created_at, discarded_at) VALUES (?, ?, ?, 0, ?, ?)',
    [id, sessionId, workflowId, createdAt, discardedAt],
  );
};

type AgentParams = DbParams & {
  readonly id: string;
  readonly sessionId: string;
  readonly runId: string;
  readonly status: string;
  readonly providerRunId?: string | null;
  readonly parentId?: string | null;
};

const insertAgent = async ({
  db,
  id,
  sessionId,
  runId,
  status,
  providerRunId = null,
  parentId = null,
}: AgentParams): Promise<void> => {
  await db.execute(
    'INSERT INTO agents (id, session_id, ordinal, name, status, workflow_run_id, provider_run_id, parent_agent_id) VALUES (?, ?, 0, ?, ?, ?, ?, ?)',
    [id, sessionId, id, status, runId, providerRunId, parentId],
  );
};

type CostParams = DbParams & {
  readonly providerRunId: string;
  readonly sessionId: string;
  readonly costUsd: number;
  readonly kind?: string;
};

const insertCost = async ({
  db,
  providerRunId,
  sessionId,
  costUsd,
  kind = 'turn',
}: CostParams): Promise<void> => {
  await db.execute(
    'INSERT OR IGNORE INTO provider_runs (id, session_id, provider, model, status_kind, status_payload, created_at) VALUES (?, ?, ?, ?, ?, ?, 1)',
    [providerRunId, sessionId, 'anthropic', 'claude-opus-5-5', 'succeeded', '{}'],
  );
  await db.execute(
    'INSERT INTO telemetry_records (id, run_id, session_id, kind, provider, model, input_tokens, output_tokens, estimated_cost_usd, recorded_at) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, 1)',
    [
      `t-${providerRunId}-${kind}`,
      providerRunId,
      sessionId,
      kind,
      'anthropic',
      'claude-opus-5-5',
      costUsd,
    ],
  );
};

type SpanParams = DbParams & {
  readonly providerRunId: string;
  readonly agentId: string;
  readonly sessionId: string;
  readonly runId: string;
};

const insertSpan = async ({ db, providerRunId, agentId, sessionId, runId }: SpanParams) => {
  await db.execute(
    `INSERT INTO agent_turn_spans
       (run_id, agent_id, session_id, workspace_id, workflow_run_id, step_role, provider, model, started_at, ended_at, end_reason)
     VALUES (?, ?, ?, ?, ?, 'implementer', 'anthropic', 'claude-opus-5-5', 1, 2, 'succeeded')`,
    [providerRunId, agentId, sessionId, WORKSPACE, runId],
  );
};

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  for (const { id, name } of WORKSPACES) {
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
      [id, name, name.toLowerCase()],
    );
  }
  await db.execute(
    "INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES ('wf-flaky', ?, 'Fix flaky tests', 1, 1)",
    [WORKSPACE],
  );
  for (const [index, name] of [
    'Find the flaky tests',
    'Make the export tests deterministic',
    'Check the fix',
  ].entries()) {
    await db.execute(
      "INSERT INTO steps (id, workflow_id, ordinal, name) VALUES (?, 'wf-flaky', ?, ?)",
      [`step-${index}`, index, name],
    );
  }
  await db.execute(
    "INSERT INTO steps (id, workflow_id, ordinal, name, deleted_at) VALUES ('step-gone', 'wf-flaky', 3, 'Old step', 5)",
  );
  await insertSession({
    db,
    id: 'ses-ledger',
    workspaceId: WORKSPACE,
    goal: 'Ledger export speed up',
  });
  await insertSession({
    db,
    id: 'ses-nightly',
    workspaceId: WORKSPACE,
    goal: 'Nightly reconciliation before cutoff',
  });
  await insertSession({
    db,
    id: 'ses-acme',
    workspaceId: WORKSPACE,
    goal: 'Acme refund idempotency',
    archivedAt: 9,
  });
  await insertSession({ db, id: 'ses-gone', workspaceId: WORKSPACE, goal: 'Gone', deletedAt: 9 });
  await insertSession({ db, id: 'ses-other', workspaceId: OTHER_WORKSPACE, goal: 'Cascadia' });

  await insertRun({ db, id: 'run-ledger', sessionId: 'ses-ledger', createdAt: LEDGER_AT });
  await insertRun({ db, id: 'run-nightly', sessionId: 'ses-nightly', createdAt: NIGHTLY_AT });
  await insertRun({ db, id: 'run-acme', sessionId: 'ses-acme', createdAt: ACME_AT });
  await insertRun({ db, id: 'run-gone', sessionId: 'ses-gone', createdAt: LEDGER_AT });
  await insertRun({
    db,
    id: 'run-discarded',
    sessionId: 'ses-ledger',
    createdAt: LEDGER_AT,
    discardedAt: 9,
  });

  await insertAgent({
    db,
    id: 'a-scout',
    sessionId: 'ses-ledger',
    runId: 'run-ledger',
    status: 'completed',
    providerRunId: 'pr-scout',
  });
  await insertAgent({
    db,
    id: 'a-impl',
    sessionId: 'ses-ledger',
    runId: 'run-ledger',
    status: 'completed',
    providerRunId: 'pr-impl-2',
  });
  await insertAgent({
    db,
    id: 'a-review',
    sessionId: 'ses-ledger',
    runId: 'run-ledger',
    status: 'running',
  });
  await insertAgent({
    db,
    id: 'a-sub',
    sessionId: 'ses-ledger',
    runId: 'run-ledger',
    status: 'running',
    parentId: 'a-review',
  });
  await insertCost({ db, providerRunId: 'pr-scout', sessionId: 'ses-ledger', costUsd: 0.02 });
  await insertCost({ db, providerRunId: 'pr-impl-1', sessionId: 'ses-ledger', costUsd: 0.3 });
  await insertCost({ db, providerRunId: 'pr-impl-2', sessionId: 'ses-ledger', costUsd: 0.26 });
  await insertCost({
    db,
    providerRunId: 'pr-impl-2',
    sessionId: 'ses-ledger',
    costUsd: 5,
    kind: 'summarizer',
  });
  await insertSpan({
    db,
    providerRunId: 'pr-impl-1',
    agentId: 'a-impl',
    sessionId: 'ses-ledger',
    runId: 'run-ledger',
  });

  await insertAgent({
    db,
    id: 'n-1',
    sessionId: 'ses-nightly',
    runId: 'run-nightly',
    status: 'completed',
  });
  await insertAgent({
    db,
    id: 'n-2',
    sessionId: 'ses-nightly',
    runId: 'run-nightly',
    status: 'completed',
  });
  await insertAgent({
    db,
    id: 'n-3',
    sessionId: 'ses-nightly',
    runId: 'run-nightly',
    status: 'skipped',
  });
  await insertAgent({
    db,
    id: 'c-1',
    sessionId: 'ses-acme',
    runId: 'run-acme',
    status: 'completed',
  });
  await insertAgent({ db, id: 'c-2', sessionId: 'ses-acme', runId: 'run-acme', status: 'failed' });
  return db;
};

describe('listWorkspaceWorkflowRuns', () => {
  it('lists the live runs of the workspace newest first with their session', async () => {
    const db = await seed();

    const rows = await listWorkspaceWorkflowRuns({ db, workspaceId: WORKSPACE });

    expect(rows.map((row) => [row.workflowRunId, row.sessionGoal, row.isSessionArchived])).toEqual([
      ['run-ledger', 'Ledger export speed up', false],
      ['run-nightly', 'Nightly reconciliation before cutoff', false],
      ['run-acme', 'Acme refund idempotency', true],
    ]);
    expect(rows[0]?.createdAt).toBe('2026-10-15T15:08:00.000Z');
  });

  it('counts live steps and the top level agents of each run by state', async () => {
    const db = await seed();

    const rows = await listWorkspaceWorkflowRuns({ db, workspaceId: WORKSPACE });

    expect(
      rows.map((row) => [
        row.stepCount,
        row.startedSteps,
        row.finishedSteps,
        row.runningSteps,
        row.failedSteps,
      ]),
    ).toEqual([
      [3, 3, 2, 1, 0],
      [3, 3, 3, 0, 0],
      [3, 2, 1, 0, 1],
    ]);
  });

  it('sums the spend of every provider run of the run once, summaries excluded', async () => {
    const db = await seed();

    const rows = await listWorkspaceWorkflowRuns({ db, workspaceId: WORKSPACE });

    expect(rows[0]?.costUsd).toBeCloseTo(0.58);
    expect(rows[1]?.costUsd).toBe(0);
  });

  it('never reads another workspace', async () => {
    const db = await seed();
    await insertRun({ db, id: 'run-other', sessionId: 'ses-other', createdAt: LEDGER_AT });

    const rows = await listWorkspaceWorkflowRuns({ db, workspaceId: OTHER_WORKSPACE });

    expect(rows.map((row) => row.workflowRunId)).toEqual(['run-other']);
  });
});

const LEAD_AT = Date.parse('2026-10-16T09:00:00.000Z');

type LeadRunParams = DbParams & {
  readonly treeId: string;
  readonly sessionId: string;
  readonly rootId: string;
  readonly createdAt: number;
  readonly phase?: string;
};

const insertLeadRun = async ({
  db,
  treeId,
  sessionId,
  rootId,
  createdAt,
  phase = 'waiting',
}: LeadRunParams): Promise<void> => {
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status, kind) VALUES (?, ?, 0, 'Lead', 'completed', 'auto')",
    [rootId, sessionId],
  );
  await db.execute(
    'INSERT INTO auto_trees (id, root_agent_id, session_id, phase, created_at, updated_at, hard_deadline_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [treeId, rootId, sessionId, phase, createdAt, createdAt, createdAt + 1],
  );
};

type HelperParams = DbParams & {
  readonly treeId: string;
  readonly sessionId: string;
  readonly helperId: string;
  readonly status: string;
  readonly providerRunId: string;
};

const insertHelper = async ({
  db,
  treeId,
  sessionId,
  helperId,
  status,
  providerRunId,
}: HelperParams): Promise<void> => {
  await db.execute(
    'INSERT INTO agents (id, session_id, ordinal, name, status, provider_run_id) VALUES (?, ?, 1, ?, ?, ?)',
    [helperId, sessionId, helperId, status, providerRunId],
  );
  await db.execute(
    `INSERT INTO auto_delegations
      (id, tree_id, generation, request_id, request_hash, batch_id, slot, child_agent_id,
       first_attempt_id, role, request_json, target_json, routing_json, deadline_at, created_at)
     VALUES (?, ?, 1, ?, 'hash', 'batch-1', 0, ?, ?, 'implementer', '{}', '{}', '{}', 1, 1)`,
    [`d-${helperId}`, treeId, `r-${helperId}`, helperId, `at-${helperId}`],
  );
};

type ReservationParams = DbParams & {
  readonly treeId: string;
  readonly ownerId: string;
  readonly actualUsd: number;
};

const insertReservation = async ({
  db,
  treeId,
  ownerId,
  actualUsd,
}: ReservationParams): Promise<void> => {
  await db.execute(
    `INSERT INTO auto_reservations
      (id, tree_id, owner_kind, owner_id, reserved_usd, state, actual_usd, cost_known, created_at, updated_at)
     VALUES (?, ?, 'auto_turn', ?, ?, 'reconciled', ?, 0, 1, 1)`,
    [`res-${ownerId}`, treeId, ownerId, actualUsd, actualUsd],
  );
};

type RoutesParams = DbParams & {
  readonly sessionId: string;
  readonly value: string;
};

const insertRoutes = async ({ db, sessionId, value }: RoutesParams): Promise<void> => {
  await db.execute('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, 1)', [
    `runs.routes.${sessionId}`,
    value,
  ]);
};

type LeadRouteParams = {
  readonly extra: Readonly<Record<string, unknown>>;
};

const leadRoute = ({ extra }: LeadRouteParams) => ({
  shape: 'lead',
  row: 1,
  closeness: 'adapt',
  role: null,
  choice: 'The Lead plans it',
  why: 'Picked',
  ...extra,
});

describe('listWorkspaceWorkflowRuns with Lead runs', () => {
  it('counts a Lead run that followed the workflow, with its Lead and its helpers as steps', async () => {
    const db = await seed();
    await insertLeadRun({
      db,
      treeId: 'tree-ledger',
      sessionId: 'ses-ledger',
      rootId: 'lead-ledger',
      createdAt: LEAD_AT,
    });
    await insertHelper({
      db,
      treeId: 'tree-ledger',
      sessionId: 'ses-ledger',
      helperId: 'h-impl',
      status: 'running',
      providerRunId: 'pr-h-impl',
    });
    await insertCost({ db, providerRunId: 'pr-h-impl', sessionId: 'ses-ledger', costUsd: 9 });
    await insertReservation({ db, treeId: 'tree-ledger', ownerId: 'turn-1', actualUsd: 0.4 });
    await insertRoutes({
      db,
      sessionId: 'ses-ledger',
      value: JSON.stringify({
        'lead-ledger': leadRoute({
          extra: { presetName: 'Renamed later', workflowId: 'wf-flaky' },
        }),
      }),
    });

    const rows = await listWorkspaceWorkflowRuns({ db, workspaceId: WORKSPACE });

    expect(rows.map((row) => [row.workflowRunId, row.workflowId, row.leadAgentId])).toEqual([
      ['tree-ledger', 'wf-flaky', 'lead-ledger'],
      ['run-ledger', 'wf-flaky', null],
      ['run-nightly', 'wf-flaky', null],
      ['run-acme', 'wf-flaky', null],
    ]);
    const lead = rows[0];
    expect([lead?.executionMode, lead?.stepCount, lead?.startedSteps, lead?.runningSteps]).toEqual([
      'dynamic',
      3,
      2,
      1,
    ]);
    expect(lead?.costUsd).toBeCloseTo(0.4);
  });

  it('matches an older Lead run by the name it kept and leaves out a run with no workflow', async () => {
    const db = await seed();
    await insertLeadRun({
      db,
      treeId: 'tree-nightly',
      sessionId: 'ses-nightly',
      rootId: 'lead-nightly',
      createdAt: LEAD_AT,
      phase: 'finished',
    });
    await insertLeadRun({
      db,
      treeId: 'tree-plain',
      sessionId: 'ses-nightly',
      rootId: 'lead-plain',
      createdAt: LEAD_AT + 1,
    });
    await insertRoutes({
      db,
      sessionId: 'ses-nightly',
      value: JSON.stringify({
        'lead-nightly': leadRoute({ extra: { presetName: 'Fix flaky tests' } }),
        'lead-plain': leadRoute({ extra: { presetName: null } }),
      }),
    });

    const rows = await listWorkspaceWorkflowRuns({ db, workspaceId: WORKSPACE });

    expect(rows.map((row) => row.workflowRunId)).toEqual([
      'tree-nightly',
      'run-ledger',
      'run-nightly',
      'run-acme',
    ]);
    expect(rows[0]?.lead?.phase).toBe('finished');
  });

  it('skips a stored route that is not JSON, a plan route and a workflow of another workspace', async () => {
    const db = await seed();
    await insertLeadRun({
      db,
      treeId: 'tree-acme',
      sessionId: 'ses-acme',
      rootId: 'lead-acme',
      createdAt: LEAD_AT,
    });
    await insertLeadRun({
      db,
      treeId: 'tree-ledger',
      sessionId: 'ses-ledger',
      rootId: 'lead-ledger',
      createdAt: LEAD_AT,
    });
    await insertLeadRun({
      db,
      treeId: 'tree-other',
      sessionId: 'ses-other',
      rootId: 'lead-other',
      createdAt: LEAD_AT,
    });
    await insertRoutes({ db, sessionId: 'ses-acme', value: 'not json' });
    await insertRoutes({
      db,
      sessionId: 'ses-ledger',
      value: JSON.stringify({
        'lead-ledger': { ...leadRoute({ extra: { workflowId: 'wf-flaky' } }), shape: 'plan' },
      }),
    });
    await insertRoutes({
      db,
      sessionId: 'ses-other',
      value: JSON.stringify({ 'lead-other': leadRoute({ extra: { workflowId: 'wf-flaky' } }) }),
    });

    const own = await listWorkspaceWorkflowRuns({ db, workspaceId: WORKSPACE });
    const other = await listWorkspaceWorkflowRuns({ db, workspaceId: OTHER_WORKSPACE });

    expect(own.map((row) => row.workflowRunId)).toEqual(['run-ledger', 'run-nightly', 'run-acme']);
    expect(other).toEqual([]);
  });

  it('charges a Lead run what the tree spend charges, a reserved ceiling included', async () => {
    const db = await seed();
    await insertLeadRun({
      db,
      treeId: 'tree-ledger',
      sessionId: 'ses-ledger',
      rootId: 'lead-ledger',
      createdAt: LEAD_AT,
    });
    await insertReservation({ db, treeId: 'tree-ledger', ownerId: 'turn-1', actualUsd: 0.25 });
    await insertReservation({ db, treeId: 'tree-ledger', ownerId: 'turn-2', actualUsd: 1.5 });
    await insertRoutes({
      db,
      sessionId: 'ses-ledger',
      value: JSON.stringify({
        'lead-ledger': leadRoute({ extra: { workflowId: 'wf-flaky' } }),
      }),
    });

    const rows = await listWorkspaceWorkflowRuns({ db, workspaceId: WORKSPACE });

    expect(rows[0]?.costUsd).toBeCloseTo(1.75);
  });

  it('carries the tree phase, the block reason, the budget left and the open asks of a Lead run', async () => {
    const db = await seed();
    await insertLeadRun({
      db,
      treeId: 'tree-ledger',
      sessionId: 'ses-ledger',
      rootId: 'lead-ledger',
      createdAt: LEAD_AT,
      phase: 'blocked',
    });
    await db.execute(
      "UPDATE auto_trees SET blocked_reason = 'budget', cap_usd = 2 WHERE id = 'tree-ledger'",
    );
    await insertReservation({ db, treeId: 'tree-ledger', ownerId: 'turn-1', actualUsd: 0.5 });
    await insertHelper({
      db,
      treeId: 'tree-ledger',
      sessionId: 'ses-ledger',
      helperId: 'h-impl',
      status: 'completed',
      providerRunId: 'pr-h-impl',
    });
    await db.execute("UPDATE auto_delegations SET state = 'paused' WHERE tree_id = 'tree-ledger'");
    await insertRoutes({
      db,
      sessionId: 'ses-ledger',
      value: JSON.stringify({
        'lead-ledger': leadRoute({ extra: { workflowId: 'wf-flaky' } }),
      }),
    });

    const rows = await listWorkspaceWorkflowRuns({ db, workspaceId: WORKSPACE });

    expect(rows[0]?.lead).toMatchObject({
      phase: 'blocked',
      blockedReason: 'budget',
      isTurnLive: false,
      isAsking: true,
    });
    expect(rows[0]?.lead?.remainingUsd).toBeCloseTo(1.5);
    expect(rows[1]?.lead).toBeNull();
  });
});
