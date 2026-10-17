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
