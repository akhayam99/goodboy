import { describe, expect, it } from 'vitest';
import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { foreignKeyViolations, migrateThrough } from '../test-helpers/migration-rows';
import { getAgentById } from '../queries/agent';
import { insertAgent } from '../queries/agent-write';

type IdParams = {
  readonly value: string;
};

const idOf = <Id extends string>({ value }: IdParams): Id => JSON.parse(JSON.stringify(value));

const SESSION = idOf<SessionId>({ value: 'session-ledger' });
const LEGACY = idOf<AgentId>({ value: 'agent-legacy' });
const MOUNT = idOf<MountId>({ value: 'mount-payments' });

const seed = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 230 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session-ledger', 'workspace', 'Reconcile the ledger export', 'idle', 1, 2)",
  );
  await db.execute(
    "INSERT INTO session_worktrees (id, session_id, branch, created_at) VALUES ('mount-payments', 'session-ledger', 'mara/ledger-export', 1)",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent-legacy', 'session-ledger', 0, 'CI fix', 'completed')",
  );
  const result = await migrateThrough({ db, version: 233 });
  expect(result.applied).toEqual([233]);
  return db;
};

describe('m233 agent mount', () => {
  it('adds a nullable column and leaves every existing agent unbound', async () => {
    const db = await seed();
    const columns = await db.select<{ name: string; notnull: number }>('PRAGMA table_info(agents)');
    expect(columns.find((column) => column.name === 'mount_id')).toMatchObject({ notnull: 0 });
    const legacy = await getAgentById(db, LEGACY);
    expect(legacy?.mountId).toBeUndefined();
    expect(legacy?.name).toBe('CI fix');
  });

  it('stores the mount an agent was spawned on and reads it back', async () => {
    const db = await seed();
    const agent = await insertAgent(db, {
      sessionId: SESSION,
      ordinal: 1,
      name: 'CI fix',
      status: 'pending',
      kind: 'ci-fixer',
      mountId: MOUNT,
    });
    expect(agent.mountId).toBe(MOUNT);
    const reloaded = await getAgentById(db, agent.id);
    expect(reloaded?.mountId).toBe(MOUNT);
  });

  it('remove the worktree, the agent keeps the R6 chain', async () => {
    const db = await seed();
    const agent = await insertAgent(db, {
      sessionId: SESSION,
      ordinal: 1,
      name: 'CI fix',
      status: 'completed',
      kind: 'ci-fixer',
      sourceKind: 'failed_check',
      sourceCommentUrl: 'https://github.com/harborline/payments-api/actions/runs/31/job/42',
      mountId: MOUNT,
    });

    await db.execute('DELETE FROM session_worktrees WHERE id = ?', [MOUNT]);

    const reloaded = await getAgentById(db, agent.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.mountId).toBeUndefined();
    expect(reloaded?.sourceCommentUrl).toBe(
      'https://github.com/harborline/payments-api/actions/runs/31/job/42',
    );
    expect(await foreignKeyViolations(db)).toEqual([]);
  });

  it('indexes the bound agents only', async () => {
    const db = await seed();
    const indexes = await db.select<{ sql: string | null }>(
      "SELECT sql FROM sqlite_master WHERE name = 'idx_agents_mount_id'",
    );
    expect(indexes[0]?.sql).toContain('WHERE mount_id IS NOT NULL');
  });
});
