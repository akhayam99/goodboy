import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  ProviderRunId,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
  WorkspaceId,
} from '@goodboy/types';
import { migrate } from '../migrations/runner';
import { makeTestDatabase } from '../test-helpers/test-db';
import { insertTelemetry, listTelemetryForSession } from './telemetry';

const workspaceId = 'workspace-1' as WorkspaceId;
const sessionId = 'session-1' as SessionId;
const runId = 'run-1' as ProviderRunId;
const recordedAt = '2026-07-30T12:00:00.000Z' as IsoDateTime;

type Params = Record<string, never>;

const databaseWithRun = async ({}: Params) => {
  const database = makeTestDatabase();
  await migrate(database);
  const now = Date.parse(recordedAt);
  await database.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'Workspace', '/tmp/workspace', now, now],
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
  it('round-trips cache read and cache creation tokens', async () => {
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
      estimatedCostUsd: 0.01,
      recordedAt,
    };

    await insertTelemetry(database, record);

    expect(await listTelemetryForSession(database, sessionId)).toEqual([record]);
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
  });
});
