import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate, type Database as DbInterface } from '@goodboy/db';
import type {
  IsoDateTime,
  ProviderAdapter,
  ProviderRunId,
  ProviderUsage,
  SessionId,
  TelemetryRecordId,
  WorkspaceId,
} from '@goodboy/types';
import { TelemetryRecorder } from './recorder';

function makeDb(): DbInterface {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return {
    async exec(sql) {
      db.exec(sql);
    },
    async execute(sql, params = []) {
      const stmt = db.prepare(sql);
      const result = stmt.run(...(params as ReadonlyArray<never>));
      return { rowsAffected: result.changes };
    },
    async select<T>(sql: string, params: ReadonlyArray<unknown> = []) {
      const stmt = db.prepare(sql);
      return stmt.all(...(params as ReadonlyArray<never>)) as unknown as ReadonlyArray<T>;
    },
  };
}

const fakeAdapter: ProviderAdapter = {
  id: 'anthropic',
  capabilities: {
    streaming: true,
    toolUse: true,
    fileEdits: true,
    contextWindow: 200_000,
    defaultModel: 'claude-opus-4-7',
    availableModels: ['claude-opus-4-7'],
  },
  async detect() {
    return { kind: 'available', binary: 'claude', version: '0.0.0' };
  },
  spawn() {
    throw new Error('not used in tests');
  },
  cost(usage: ProviderUsage) {
    return usage.inputTokens * 0.000003 + usage.outputTokens * 0.000015;
  },
};

async function seedSession(
  db: DbInterface,
  workspaceId: WorkspaceId,
  sessionId: SessionId,
): Promise<void> {
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'demo', `/tmp/${workspaceId}`, 0, 0],
  );
  await db.execute(
    `INSERT INTO sessions
       (id, workspace_id, goal, state_kind, state_payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, workspaceId, 'demo', 'idle', '{"lastActivityAt":"2026-05-07T00:00:00Z"}', 0, 0],
  );
  await db.execute(
    `INSERT INTO provider_runs
       (id, session_id, provider, model, status_kind, status_payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['run_1', sessionId, 'anthropic', 'claude-opus-4-7', 'succeeded', '{}', 0],
  );
}

let counter = 0;
const newId = (): TelemetryRecordId => `tel_${++counter}` as TelemetryRecordId;
const now = (): IsoDateTime => '2026-05-07T00:00:00.000Z' as IsoDateTime;

describe('TelemetryRecorder', () => {
  it('records a turn and computes cost via the adapter', async () => {
    counter = 0;
    const db = makeDb();
    await migrate(db);
    await seedSession(db, 'ws_1' as WorkspaceId, 'sess_1' as SessionId);

    const recorder = new TelemetryRecorder({ db, adapter: fakeAdapter, newId, now });
    const usage: ProviderUsage = {
      inputTokens: 1000,
      outputTokens: 500,
      cachedInputTokens: 0,
      estimatedCostUsd: 0,
    };
    const record = await recorder.recordTurn({
      runId: 'run_1' as ProviderRunId,
      sessionId: 'sess_1' as SessionId,
      agentId: null,
      model: 'claude-opus-4-7',
      usage,
    });

    expect(record.kind).toBe('turn');
    expect(record.estimatedCostUsd).toBeCloseTo(0.0105);
  });

  it('aggregates per session, workspace and provider', async () => {
    counter = 0;
    const db = makeDb();
    await migrate(db);
    await seedSession(db, 'ws_2' as WorkspaceId, 'sess_2' as SessionId);

    const recorder = new TelemetryRecorder({ db, adapter: fakeAdapter, newId, now });
    const usage = {
      inputTokens: 100,
      outputTokens: 50,
      cachedInputTokens: 0,
      estimatedCostUsd: 0,
    } satisfies ProviderUsage;

    await recorder.recordTurn({
      runId: 'run_1' as ProviderRunId,
      sessionId: 'sess_2' as SessionId,
      agentId: null,
      model: 'claude-opus-4-7',
      usage,
    });
    await recorder.recordSummarizer({
      runId: 'run_1' as ProviderRunId,
      sessionId: 'sess_2' as SessionId,
      agentId: null,
      model: 'claude-haiku-4-5',
      usage,
      costUsd: 0.00002,
    });

    const session = await recorder.sessionSummary('sess_2' as SessionId);
    expect(session.recordCount).toBe(2);
    expect(session.inputTokens).toBe(200);
    expect(session.outputTokens).toBe(100);

    const workspace = await recorder.workspaceSummary('ws_2' as WorkspaceId);
    expect(workspace.recordCount).toBe(2);

    const provider = await recorder.providerSummary('anthropic');
    expect(provider.recordCount).toBe(2);
  });
});
