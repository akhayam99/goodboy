import { describe, expect, it } from 'vitest';
import type { AgentId, ResolveAttempt, SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrateThrough } from '../test-helpers/migration-rows';
import {
  insertResolveAttempt,
  listResolveAttempts,
  setResolveAttemptFailureCause,
  setResolveAttemptPhase,
} from '../queries/resolve-attempt';

const SESSION = 'session' as SessionId;

const seed = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 224 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Checkout', 'idle', 1, 1)",
  );
  await db.execute(
    `INSERT INTO resolve_attempts (id, session_id, agent_id, pr_number, thread_ids_json, provider, model, phase, error, created_at)
     VALUES ('legacy', 'session', 'agent-legacy', 318, '[]', 'anthropic', 'sonnet', 'failed', 'interrupted', 1)`,
  );
  const result = await migrateThrough({ db, version: 225 });
  expect(result.applied).toEqual([225]);
  return db;
};

const attempt = (overrides: Partial<ResolveAttempt>): ResolveAttempt => ({
  id: 'attempt',
  sessionId: SESSION,
  agentId: 'agent' as AgentId,
  prNumber: 318,
  threadIds: [],
  provider: 'anthropic',
  model: 'sonnet',
  effort: null,
  instructions: null,
  phase: 'running',
  mountTarget: null,
  startedAt: 2,
  endedAt: null,
  error: null,
  createdAt: 2,
  batchId: null,
  copyPath: null,
  launchChoice: null,
  ...overrides,
});

describe('m225 resolve attempt failure cause', () => {
  it('leaves the attempts written before the migration without a cause', async () => {
    const db = await seed();
    const rows = await listResolveAttempts({ db, sessionId: SESSION });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ phase: 'failed', error: 'interrupted', failureCause: null });
  });

  it('records the cause a run failed with next to the error text', async () => {
    const db = await seed();
    await insertResolveAttempt({ db, attempt: attempt({}) });
    await setResolveAttemptPhase({
      db,
      id: 'attempt',
      phase: 'failed',
      error: 'rate limit',
      failureCause: 'provider_error',
    });
    const rows = await listResolveAttempts({ db, sessionId: SESSION });
    expect(rows.find((row) => row.id === 'attempt')).toMatchObject({
      phase: 'failed',
      error: 'rate limit',
      failureCause: 'provider_error',
    });
  });

  it('clears the cause when the attempt goes on to another phase', async () => {
    const db = await seed();
    await insertResolveAttempt({ db, attempt: attempt({}) });
    await setResolveAttemptPhase({ db, id: 'attempt', phase: 'failed', failureCause: 'stopped' });
    await setResolveAttemptPhase({ db, id: 'attempt', phase: 'finished' });
    const rows = await listResolveAttempts({ db, sessionId: SESSION });
    expect(rows.find((row) => row.id === 'attempt')?.failureCause).toBeNull();
  });

  it('records a cause on a finished attempt, such as a collision found at accept', async () => {
    const db = await seed();
    await insertResolveAttempt({ db, attempt: attempt({}) });
    await setResolveAttemptPhase({ db, id: 'attempt', phase: 'finished' });
    await setResolveAttemptFailureCause({
      db,
      id: 'attempt',
      failureCause: 'accept_conflict',
    });
    const rows = await listResolveAttempts({ db, sessionId: SESSION });
    expect(rows.find((row) => row.id === 'attempt')).toMatchObject({
      phase: 'finished',
      failureCause: 'accept_conflict',
    });
  });

  it('reads a cause this build does not know as no cause', async () => {
    const db = await seed();
    await db.execute("UPDATE resolve_attempts SET failure_cause = 'from_the_future'");
    const rows = await listResolveAttempts({ db, sessionId: SESSION });
    expect(rows[0]?.failureCause).toBeNull();
  });
});
