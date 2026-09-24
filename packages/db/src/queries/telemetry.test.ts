import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  ProviderRunId,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
  WorkspaceId,
  WorkflowRunId,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  insertTelemetry,
  listTelemetryForSession,
  summarizeUnattributedTelemetry,
  summarizeWorkflowRunTelemetry,
} from './telemetry';

const workspaceId = 'workspace-1' as WorkspaceId;
const sessionId = 'session-1' as SessionId;
const runId = 'run-1' as ProviderRunId;
const recordedAt = '2026-07-30T12:00:00.000Z' as IsoDateTime;

type Params = Record<string, never>;

const databaseWithRun = async ({}: Params) => {
  const database = await makeMigratedTestDatabase();
  const now = Date.parse(recordedAt);
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
    [runId, sessionId, 'anthropic', 'claude-sonnet-4-6', 'succeeded', '{}', now],
  );
  return database;
};

describe('telemetry queries', () => {
  it('round-trips cache and context tokens', async () => {
    const database = await databaseWithRun({});
    const record: TelemetryRecord = {
      id: 'telemetry-1' as TelemetryRecordId,
      runId,
      sessionId,
      kind: 'turn',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      inputTokens: 10,
      outputTokens: 5,
      cachedInputTokens: 20,
      cacheCreationInputTokens: 30,
      contextTokens: 65,
      estimatedCostUsd: 0.01,
      recordedAt,
    };

    await insertTelemetry(database, record);

    expect(await listTelemetryForSession(database, sessionId)).toEqual([
      { ...record, attributionStatus: 'unattributed' },
    ]);
  });

  it('persists zero defaults for records without cache fields', async () => {
    const database = await databaseWithRun({});
    const record: TelemetryRecord = {
      id: 'telemetry-2' as TelemetryRecordId,
      runId,
      sessionId,
      kind: 'turn',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      inputTokens: 10,
      outputTokens: 5,
      estimatedCostUsd: 0.01,
      recordedAt,
    };

    await insertTelemetry(database, record);
    const stored = (await listTelemetryForSession(database, sessionId))[0];

    expect(stored?.cachedInputTokens).toBe(0);
    expect(stored?.cacheCreationInputTokens).toBe(0);
    expect(stored?.contextTokens).toBeUndefined();
  });

  it('counts the same invocation usage event once', async () => {
    const database = await databaseWithRun({});
    const workflowRunId = 'workflow-run-1' as WorkflowRunId;
    const record: TelemetryRecord = {
      id: 'telemetry-first' as TelemetryRecordId,
      runId,
      sessionId,
      kind: 'summarizer',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      inputTokens: 10,
      outputTokens: 5,
      estimatedCostUsd: 0.25,
      recordedAt,
      invocationId: 'invocation-1',
      workflowRunId,
      purpose: 'summarizer',
      usageEventId: 'usage',
      attributionStatus: 'attributed',
    };
    const isFirstInserted = await insertTelemetry(database, record);
    const isDuplicateInserted = await insertTelemetry(database, {
      ...record,
      id: 'telemetry-duplicate' as TelemetryRecordId,
    });

    const summary = await summarizeWorkflowRunTelemetry(database, workflowRunId);

    expect(isFirstInserted).toBe(true);
    expect(isDuplicateInserted).toBe(false);
    expect(summary.estimatedCostUsd).toBe(0.25);
    expect(summary.recordCount).toBe(1);
  });

  it('keeps historical ownership gaps in the unattributed bucket', async () => {
    const database = await databaseWithRun({});
    await insertTelemetry(database, {
      id: 'telemetry-unknown' as TelemetryRecordId,
      runId,
      sessionId,
      kind: 'turn',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      inputTokens: 10,
      outputTokens: 5,
      estimatedCostUsd: 0.5,
      recordedAt,
    });

    const summary = await summarizeUnattributedTelemetry(database);

    expect(summary.estimatedCostUsd).toBe(0.5);
    expect(summary.recordCount).toBe(1);
  });
});
