import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  ProviderName,
  ProviderRunId,
  SessionId,
  TelemetryRecordId,
  WorkspaceId,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import type { Database } from '../client';
import { summarizeProviderSpendPeriods } from './provider-spend';
import { insertTelemetry } from './telemetry';

const HARBORLINE = 'workspace-harborline' as WorkspaceId;
const NORTHWIND = 'workspace-northwind' as WorkspaceId;
const TODAY = Date.parse('2026-09-25T00:00:00.000Z');
const WEEK = Date.parse('2026-09-18T00:00:00.000Z');
const MONTH = Date.parse('2026-09-01T00:00:00.000Z');

type SessionParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
};

const addSession = async ({ db, workspaceId, name }: SessionParams): Promise<SessionId> => {
  const sessionId = `session-${name}` as SessionId;
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
    [workspaceId, name, name.toLowerCase()],
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, 'Goal', 'idle', 1, 1)",
    [sessionId, workspaceId],
  );
  await db.execute(
    "INSERT INTO provider_runs (id, session_id, provider, model, status_kind, status_payload, created_at) VALUES (?, ?, 'anthropic', 'claude-sonnet-5', 'succeeded', '{}', 1)",
    [`run-${name}`, sessionId],
  );
  return sessionId;
};

type SpendParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly provider: ProviderName;
  readonly at: string;
  readonly costUsd: number;
};

let counter = 0;

const spend = async ({ db, sessionId, provider, at, costUsd }: SpendParams): Promise<void> => {
  counter += 1;
  await insertTelemetry(db, {
    id: `telemetry-${counter}` as TelemetryRecordId,
    runId: `run-${sessionId.slice('session-'.length)}` as ProviderRunId,
    sessionId,
    kind: 'turn',
    provider,
    model: 'claude-sonnet-5',
    inputTokens: 1,
    outputTokens: 1,
    estimatedCostUsd: costUsd,
    recordedAt: at as IsoDateTime,
  });
};

describe('summarizeProviderSpendPeriods', () => {
  it('adds up today, the last 7 days and this month for one provider', async () => {
    const db = await makeMigratedTestDatabase();
    const harborline = await addSession({ db, workspaceId: HARBORLINE, name: 'Harborline' });
    const northwind = await addSession({ db, workspaceId: NORTHWIND, name: 'Northwind' });
    await spend({
      db,
      sessionId: harborline,
      provider: 'anthropic',
      at: '2026-09-25T09:00:00.000Z',
      costUsd: 3.2,
    });
    await spend({
      db,
      sessionId: harborline,
      provider: 'anthropic',
      at: '2026-09-20T09:00:00.000Z',
      costUsd: 15.2,
    });
    await spend({
      db,
      sessionId: harborline,
      provider: 'anthropic',
      at: '2026-09-03T09:00:00.000Z',
      costUsd: 42.62,
    });
    await spend({
      db,
      sessionId: harborline,
      provider: 'anthropic',
      at: '2026-08-30T09:00:00.000Z',
      costUsd: 100,
    });
    await spend({
      db,
      sessionId: harborline,
      provider: 'codex',
      at: '2026-09-25T09:00:00.000Z',
      costUsd: 7,
    });
    await spend({
      db,
      sessionId: northwind,
      provider: 'anthropic',
      at: '2026-09-25T10:00:00.000Z',
      costUsd: 1,
    });

    const periods = await summarizeProviderSpendPeriods({
      db,
      provider: 'anthropic',
      workspaceId: HARBORLINE,
      todayStartMs: TODAY,
      weekStartMs: WEEK,
      monthStartMs: MONTH,
    });

    expect(periods.todayUsd).toBeCloseTo(3.2);
    expect(periods.last7DaysUsd).toBeCloseTo(18.4);
    expect(periods.thisMonthUsd).toBeCloseTo(61.02);
  });

  it('counts every workspace without one and answers zero without rows', async () => {
    const db = await makeMigratedTestDatabase();
    const harborline = await addSession({ db, workspaceId: HARBORLINE, name: 'Harborline' });
    const northwind = await addSession({ db, workspaceId: NORTHWIND, name: 'Northwind' });
    await spend({
      db,
      sessionId: harborline,
      provider: 'anthropic',
      at: '2026-09-25T09:00:00.000Z',
      costUsd: 2,
    });
    await spend({
      db,
      sessionId: northwind,
      provider: 'anthropic',
      at: '2026-09-25T10:00:00.000Z',
      costUsd: 1,
    });

    const params = {
      db,
      workspaceId: null,
      todayStartMs: TODAY,
      weekStartMs: WEEK,
      monthStartMs: MONTH,
    };
    expect(
      (await summarizeProviderSpendPeriods({ ...params, provider: 'anthropic' })).todayUsd,
    ).toBe(3);
    expect(await summarizeProviderSpendPeriods({ ...params, provider: 'cursor' })).toEqual({
      todayUsd: 0,
      last7DaysUsd: 0,
      thisMonthUsd: 0,
    });
  });
});
