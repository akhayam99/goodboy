import { describe, expect, it } from 'vitest';
import type { AgentId, ResolveAttempt, SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrateThrough } from '../test-helpers/migration-rows';
import { insertResolveAttempt, listResolveAttempts } from '../queries/resolve-attempt';

const SESSION = 'session' as SessionId;

const seed = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 221 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Checkout', 'idle', 1, 1)",
  );
  await db.execute(
    `INSERT INTO resolve_attempts (id, session_id, agent_id, pr_number, thread_ids_json, provider, model, phase, created_at)
     VALUES ('legacy', 'session', 'agent-legacy', 318, '[]', 'anthropic', 'sonnet', 'finished', 1)`,
  );
  const result = await migrateThrough({ db, version: 222 });
  expect(result.applied).toEqual([222]);
  await migrateThrough({ db, version: 225 });
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

describe('m222 resolve attempt launch', () => {
  it('leaves the attempts written before the migration without a launch id', async () => {
    const db = await seed();
    const rows = await listResolveAttempts({ db, sessionId: SESSION });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ launchId: null, retryOfLaunchId: null });
  });

  it('stores the launch id and the launch a retry descends from', async () => {
    const db = await seed();
    await insertResolveAttempt({
      db,
      attempt: attempt({
        id: 'retry',
        agentId: 'agent-retry' as AgentId,
        launchId: 'launch-2',
        retryOfLaunchId: 'launch-1',
      }),
    });
    const rows = await listResolveAttempts({ db, sessionId: SESSION });
    expect(rows.find((row) => row.id === 'retry')).toMatchObject({
      launchId: 'launch-2',
      retryOfLaunchId: 'launch-1',
    });
  });

  it('keeps the launch id when the same attempt is written again without one', async () => {
    const db = await seed();
    await insertResolveAttempt({ db, attempt: attempt({ launchId: 'launch-1' }) });
    await insertResolveAttempt({ db, attempt: attempt({ phase: 'running' }) });
    const rows = await listResolveAttempts({ db, sessionId: SESSION });
    expect(rows.find((row) => row.id === 'attempt')?.launchId).toBe('launch-1');
  });
});
