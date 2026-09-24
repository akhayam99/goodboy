import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId, SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertProviderRun, updateProviderRunStatus } from './provider-run';

const runId = 'run-1' as ProviderRunId;
const sessionId = 'session-1' as SessionId;
const now = new Date('2026-09-08T10:00:00.000Z').toISOString() as IsoDateTime;

describe('provider run queries', () => {
  it('still moves a run whose stored payload is malformed to its new status', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('w1', 'Acme', 'acme', 1, 1)",
    );
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session-1', 'w1', 'goal', 'idle', 1, 1)",
    );
    await insertProviderRun(db, {
      id: runId,
      sessionId,
      provider: 'anthropic',
      model: 'sonnet-5',
      status: { kind: 'pending' },
      createdAt: now,
    });
    await db.execute("UPDATE provider_runs SET status_payload = '{broken' WHERE id = 'run-1'");

    await updateProviderRunStatus(db, runId, { kind: 'succeeded', finishedAt: now });

    const rows = await db.select<{ status_kind: string; status_payload: string }>(
      'SELECT status_kind, status_payload FROM provider_runs',
    );
    expect(rows).toEqual([
      { status_kind: 'succeeded', status_payload: JSON.stringify({ finishedAt: Date.parse(now) }) },
    ]);
  });
});
