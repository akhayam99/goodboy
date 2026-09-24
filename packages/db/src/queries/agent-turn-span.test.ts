import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  AgentTurnSpan,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  TelemetryRecordId,
  WorkspaceId,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  insertAgentTurnSpan,
  listAgentTurnSpanRoutes,
  listSessionTurnSpans,
  listWorkspaceTurnSpans,
} from './agent-turn-span';
import { insertTelemetry } from './telemetry';

const workspaceId = 'workspace-1' as WorkspaceId;
const sessionId = 'session-1' as SessionId;
const runId = 'run-1' as ProviderRunId;
const agentId = 'agent-1' as AgentId;
const startedAt = '2026-09-24T10:00:00.000Z' as IsoDateTime;
const endedAt = '2026-09-24T10:04:30.000Z' as IsoDateTime;

const SPAN: AgentTurnSpan = {
  runId,
  agentId,
  sessionId,
  workspaceId,
  workflowRunId: null,
  stepRole: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'high',
  startedAt,
  endedAt,
  endReason: 'succeeded',
};

type SpanRow = {
  readonly run_id: string;
  readonly agent_id: string | null;
  readonly session_id: string | null;
  readonly step_role: string;
  readonly effort: string | null;
  readonly started_at: number;
  readonly ended_at: number;
  readonly end_reason: string;
  readonly cost_usd: number | null;
};

type Params = Record<string, never>;

const databaseWithRun = async ({}: Params) => {
  const database = await makeMigratedTestDatabase();
  const now = Date.parse(startedAt);
  await database.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'Workspace', 'workspace', now, now],
  );
  await database.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, workspaceId, 'Goal', 'idle', now, now],
  );
  await database.execute(
    'INSERT INTO provider_runs (id, session_id, provider, model, status_kind, status_payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [runId, sessionId, 'anthropic', 'claude-sonnet-5', 'succeeded', '{}', now],
  );
  await database.execute(
    'INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, ?, ?, ?)',
    [agentId, sessionId, 0, 'implementer', 'completed'],
  );
  return database;
};

type TestDatabase = Awaited<ReturnType<typeof makeMigratedTestDatabase>>;

type SelectParams = {
  readonly database: TestDatabase;
};

const selectSpans = async ({ database }: SelectParams) =>
  database.select<SpanRow>(
    'SELECT run_id, agent_id, session_id, step_role, effort, started_at, ended_at, end_reason, cost_usd FROM agent_turn_spans',
  );

type RecordCostParams = {
  readonly database: TestDatabase;
  readonly id: string;
  readonly cost: number;
};

const recordCost = async ({ database, id, cost }: RecordCostParams) =>
  insertTelemetry(database, {
    id: id as TelemetryRecordId,
    runId,
    sessionId,
    kind: 'turn',
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    inputTokens: 10,
    outputTokens: 5,
    estimatedCostUsd: cost,
    recordedAt: endedAt,
  });

describe('agent turn span queries', () => {
  it('stores the measured interval with the cost the turn recorded', async () => {
    const database = await databaseWithRun({});
    await recordCost({ database, id: 'telemetry-1', cost: 0.25 });
    await recordCost({ database, id: 'telemetry-2', cost: 0.5 });

    await insertAgentTurnSpan({ db: database, span: SPAN });

    expect(await selectSpans({ database })).toEqual([
      {
        run_id: runId,
        agent_id: agentId,
        session_id: sessionId,
        step_role: 'implementer',
        effort: 'high',
        started_at: Date.parse(startedAt),
        ended_at: Date.parse(endedAt),
        end_reason: 'succeeded',
        cost_usd: 0.75,
      },
    ]);
  });

  it('leaves the cost unknown when the turn recorded no usage', async () => {
    const database = await databaseWithRun({});

    await insertAgentTurnSpan({ db: database, span: { ...SPAN, effort: null } });

    const [row] = await selectSpans({ database });
    expect(row?.cost_usd).toBeNull();
    expect(row?.effort).toBeNull();
  });

  it('keeps the first span a provider run closed with', async () => {
    const database = await databaseWithRun({});

    await insertAgentTurnSpan({ db: database, span: SPAN });
    await insertAgentTurnSpan({ db: database, span: { ...SPAN, endReason: 'failed' } });

    const rows = await selectSpans({ database });
    expect(rows.map((row) => row.end_reason)).toEqual(['succeeded']);
  });

  it('keeps the measured span after its session is deleted', async () => {
    const database = await databaseWithRun({});
    await insertAgentTurnSpan({ db: database, span: SPAN });

    await database.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);

    const [row] = await selectSpans({ database });
    expect(row).toMatchObject({ run_id: runId, agent_id: null, session_id: null });
  });

  it('rejects an interval that ends before it starts', async () => {
    const database = await databaseWithRun({});

    await expect(
      insertAgentTurnSpan({
        db: database,
        span: { ...SPAN, endedAt: startedAt, startedAt: endedAt },
      }),
    ).rejects.toThrow();
  });

  it('reads measured spans with the agent lineage and status', async () => {
    const database = await databaseWithRun({});
    const childId = 'agent-2' as AgentId;
    await database.execute(
      'INSERT INTO agents (id, session_id, ordinal, name, status, parent_agent_id) VALUES (?, ?, ?, ?, ?, ?)',
      [childId, sessionId, 1, 'part', 'completed', agentId],
    );
    await recordCost({ database, id: 'telemetry-1', cost: 0.4 });
    await insertAgentTurnSpan({ db: database, span: SPAN });
    await insertAgentTurnSpan({
      db: database,
      span: {
        ...SPAN,
        runId: 'run-2' as ProviderRunId,
        agentId: childId,
        startedAt: '2026-09-24T10:01:00.000Z' as IsoDateTime,
        endedAt: '2026-09-24T10:03:00.000Z' as IsoDateTime,
      },
    });

    const spans = await listSessionTurnSpans({ db: database, sessionId });

    expect(spans).toEqual([
      {
        agentId,
        parentAgentId: null,
        agentStatus: 'completed',
        workflowRunId: null,
        isOrchestratedRunDone: false,
        stepRole: 'implementer',
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        effort: 'high',
        startedAtMs: Date.parse(startedAt),
        endedAtMs: Date.parse(endedAt),
        endReason: 'succeeded',
        costUsd: 0.4,
      },
      expect.objectContaining({
        agentId: childId,
        parentAgentId: agentId,
        startedAtMs: Date.parse('2026-09-24T10:01:00.000Z'),
        costUsd: null,
      }),
    ]);
  });

  it('reads workspace spans ended inside the window only', async () => {
    const database = await databaseWithRun({});
    await insertAgentTurnSpan({ db: database, span: SPAN });

    const inside = await listWorkspaceTurnSpans({
      db: database,
      workspaceId,
      sinceMs: Date.parse(endedAt),
    });
    const outside = await listWorkspaceTurnSpans({
      db: database,
      workspaceId,
      sinceMs: Date.parse(endedAt) + 1,
    });

    expect(inside.map((span) => span.agentId)).toEqual([agentId]);
    expect(outside).toEqual([]);
  });

  it('lists what each run of the session was started with', async () => {
    const database = await databaseWithRun({});
    await insertAgentTurnSpan({ db: database, span: SPAN });

    expect(await listAgentTurnSpanRoutes({ db: database, sessionId })).toEqual([
      { runId, agentId, provider: 'anthropic', model: 'claude-sonnet-5', effort: 'high' },
    ]);
  });

  it('leaves out spans whose agent was deleted', async () => {
    const database = await databaseWithRun({});
    await insertAgentTurnSpan({ db: database, span: SPAN });

    await database.execute('DELETE FROM agents WHERE id = ?', [agentId]);

    expect(await listAgentTurnSpanRoutes({ db: database, sessionId })).toEqual([]);
  });
});
