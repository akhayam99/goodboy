import { describe, expect, it } from 'vitest';
import {
  getAdoptionOfAgent,
  getAutoTree,
  insertAutoOutbox,
  listAutoArtifacts,
  listAutoDelegations,
  listAutoOutbox,
  type Database,
} from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import {
  AUTO_SEED_NOW,
  AUTO_SEED_SESSION,
  seedAutoSession,
  seedAutoTree,
  seedPlanArtifact,
} from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AgentId, type AutoOutboxId, type AutoTreeId } from '@goodboy/types';
import { adoptAgent, type AdoptAgentParams } from './adoptAgent';
import { createAutoRuntime } from './createAutoRuntime';
import { createAutoScheduler } from './scheduler';
import { makeFakePorts } from './testing/fakePorts';

const SOURCE = brandId<AgentId>({ value: 'agent-source' });
const LATE_CLASH = 'outbox-clash';

type WorldParams = {
  readonly kind?: string;
  readonly extraAgents?: ReadonlyArray<string>;
};

const makeWorld = async ({ kind = 'implementer', extraAgents = [] }: WorldParams = {}) => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db, agentIds: ['agent-source', ...extraAgents] });
  await db.execute("UPDATE agents SET name = 'Implementer', kind = ? WHERE id = 'agent-source'", [
    kind,
  ]);
  return db;
};

type IdsParams = {
  readonly prefix: string;
  readonly overrides?: Readonly<Record<number, string>>;
};

const idsFrom = ({ prefix, overrides = {} }: IdsParams) => {
  let counter = 0;
  return () => {
    counter += 1;
    return overrides[counter] ?? `${prefix}-${counter}`;
  };
};

type AdoptParams = {
  readonly db: Database;
  readonly prefix?: string;
  readonly overrides?: Readonly<Record<number, string>>;
  readonly isTurnLive?: boolean;
  readonly kind?: string;
  readonly instruction?: string;
};

const adopt = ({
  db,
  prefix = 'adopt',
  overrides,
  isTurnLive = false,
  kind = 'implementer',
  instruction = 'Test it, then review it.',
}: AdoptParams) => {
  const params: AdoptAgentParams = {
    db,
    sessionId: AUTO_SEED_SESSION,
    sourceAgentId: SOURCE,
    source: {
      kind,
      roleLabel: 'Implementer',
      isTurnLive,
      goal: 'Add the retry cap to ledger-core',
      lastReply: 'Added the cap and a test in ledger-core.',
      mountLabel: 'ledger-core on ak/retry-cap',
      provider: 'anthropic',
      model: 'sonnet',
      effort: 'medium',
    },
    instruction,
    autoRouting: { provider: 'anthropic', model: 'opus', effort: 'medium' },
    primaryMountId: 'mount-ledger-core',
    capUsd: 5,
    nowMs: AUTO_SEED_NOW,
    newId: idsFrom({ prefix, ...(overrides === undefined ? {} : { overrides }) }),
  };
  return adoptAgent(params);
};

type CountParams = {
  readonly db: Database;
  readonly table: string;
};

const count = async ({ db, table }: CountParams): Promise<number> => {
  const rows = await db.select<{ readonly n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
  return rows[0]?.n ?? 0;
};

const agentRows = (db: Database) =>
  db.select<{ readonly id: string; readonly kind: string | null; readonly parent: string | null }>(
    'SELECT id, kind, parent_agent_id AS parent FROM agents ORDER BY ordinal',
  );

describe('moving a standalone agent to Auto', () => {
  it('creates the Auto agent, its tree and one adopted delegation in a single commit', async () => {
    const db = await makeWorld();
    await seedPlanArtifact({ db, id: 'plan-retry', agentId: 'agent-source' });

    const outcome = await adopt({ db });

    expect(outcome.kind).toBe('adopted');
    if (outcome.kind !== 'adopted') {
      return;
    }
    expect(await agentRows(db)).toEqual([
      { id: 'agent-auto-root', kind: null, parent: null },
      { id: 'agent-source', kind: 'implementer', parent: null },
      { id: outcome.autoAgentId, kind: 'auto', parent: null },
    ]);
    const tree = await getAutoTree({ db, treeId: outcome.treeId });
    expect(tree).toMatchObject({
      rootAgentId: outcome.autoAgentId,
      phase: 'merging',
      generation: 1,
      capUsd: 5,
      primaryMountId: 'mount-ledger-core',
    });
    const delegations = await listAutoDelegations({ db, treeId: outcome.treeId });
    expect(delegations).toHaveLength(1);
    expect(delegations[0]).toMatchObject({
      childAgentId: SOURCE,
      isAdopted: true,
      state: 'settled',
      outcome: 'completed',
      role: 'implementer',
    });
    expect(await listAutoArtifacts({ db, treeId: outcome.treeId })).toMatchObject([
      { artifactId: 'plan-retry', kind: 'plan', ownerAgentId: SOURCE },
    ]);
  });

  it('leaves the kickoff for Auto in the outbox with the goal, the last reply and the words of the user', async () => {
    const db = await makeWorld();
    const outcome = await adopt({ db });
    if (outcome.kind !== 'adopted') {
      throw new Error('expected an adoption');
    }

    const rows = await listAutoOutbox({ db, treeId: outcome.treeId });

    expect(rows).toHaveLength(1);
    const payload = JSON.stringify(rows[0]?.payload);
    expect(rows[0]).toMatchObject({ kind: 'user', state: 'pending' });
    expect(payload).toContain('Add the retry cap to ledger-core');
    expect(payload).toContain('Added the cap and a test in ledger-core.');
    expect(payload).toContain('Test it, then review it.');
  });

  it('does not touch the source agent row', async () => {
    const db = await makeWorld();
    const before = await db.select('SELECT * FROM agents WHERE id = ?', [SOURCE]);

    await adopt({ db });

    expect(await db.select('SELECT * FROM agents WHERE id = ?', [SOURCE])).toEqual(before);
  });

  it('adopts an old Generalist that has no stored kind', async () => {
    const db = await makeWorld({ kind: 'generic' });

    const outcome = await adopt({ db, kind: 'generic' });

    expect(outcome.kind).toBe('adopted');
  });
});

describe('moving the same agent twice', () => {
  it('gives back the first Auto and creates no second tree', async () => {
    const db = await makeWorld();
    const first = await adopt({ db, prefix: 'first' });
    const second = await adopt({ db, prefix: 'second' });

    expect(first.kind).toBe('adopted');
    expect(second).toMatchObject({
      kind: 'exists',
      autoAgentId: first.kind === 'adopted' ? first.autoAgentId : '',
    });
    expect(await count({ db, table: 'auto_trees' })).toBe(1);
    expect(await count({ db, table: 'auto_delegations' })).toBe(1);
    expect(await count({ db, table: "agents WHERE kind = 'auto'" })).toBe(1);
  });

  it('keeps one Auto when two windows click at the same time', async () => {
    const db = await makeWorld();

    const outcomes = await Promise.all([
      adopt({ db, prefix: 'window-a' }),
      adopt({ db, prefix: 'window-b' }),
    ]);

    expect(outcomes.filter((outcome) => outcome.kind === 'adopted')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.kind !== 'adopted')).toHaveLength(1);
    expect(await count({ db, table: 'auto_trees' })).toBe(1);
    expect(await count({ db, table: "agents WHERE kind = 'auto'" })).toBe(1);
  });
});

describe('what Auto refuses to take over', () => {
  it('refuses a step of a Run with the words "Pause or finish the run first."', async () => {
    const db = await makeWorld();
    await db.exec('PRAGMA foreign_keys = OFF');
    await db.execute("UPDATE agents SET workflow_run_id = 'run-harborline' WHERE id = ?", [SOURCE]);
    await db.exec('PRAGMA foreign_keys = ON');

    const outcome = await adopt({ db });

    expect(outcome).toEqual({
      kind: 'refused',
      code: 'in_run',
      message: 'Pause or finish the run first.',
    });
    expect(await count({ db, table: 'auto_trees' })).toBe(0);
  });

  it('refuses while a turn runs, from the store and from the database status', async () => {
    const db = await makeWorld();

    expect(await adopt({ db, isTurnLive: true })).toMatchObject({
      kind: 'refused',
      code: 'turn_running',
    });

    await db.execute("UPDATE agents SET status = 'running' WHERE id = ?", [SOURCE]);
    expect(await adopt({ db })).toMatchObject({ kind: 'refused', code: 'turn_running' });
    expect(await count({ db, table: 'auto_trees' })).toBe(0);
  });

  it('refuses the moment the status turns to running between the check and the commit', async () => {
    const db = await makeWorld();
    const racing: Database = {
      ...db,
      select: db.select.bind(db),
      exec: db.exec.bind(db),
      execute: db.execute.bind(db),
      transaction: async (params) => {
        await db.execute("UPDATE agents SET status = 'running' WHERE id = ?", [SOURCE]);
        return db.transaction(params);
      },
    };

    const outcome = await adopt({ db: racing });

    expect(outcome).toMatchObject({ kind: 'refused', code: 'turn_running' });
    expect(await count({ db, table: 'auto_trees' })).toBe(0);
    expect(await count({ db, table: "agents WHERE kind = 'auto'" })).toBe(0);
  });

  it('works once the turn has ended', async () => {
    const db = await makeWorld();
    expect(await adopt({ db, isTurnLive: true })).toMatchObject({ code: 'turn_running' });

    expect((await adopt({ db, isTurnLive: false })).kind).toBe('adopted');
  });

  it('refuses a kind that has no role', async () => {
    const db = await makeWorld({ kind: 'resolver' });

    expect(await adopt({ db, kind: 'resolver' })).toMatchObject({
      kind: 'refused',
      code: 'not_adoptable',
    });
  });

  it('refuses an agent that is already a child of an Auto tree', async () => {
    const db = await makeWorld();
    const first = await adopt({ db, prefix: 'tree-a' });
    if (first.kind !== 'adopted') {
      throw new Error('expected an adoption');
    }
    await db.execute('DELETE FROM auto_delegations WHERE adopted = 1');
    await db.execute(
      `INSERT INTO auto_delegations (
         id, tree_id, generation, request_id, request_hash, batch_id, slot, child_agent_id,
         first_attempt_id, role, request_json, target_json, routing_json, state, deadline_at, created_at
       ) VALUES ('delegation-plain', ?, 1, 'request-1', 'hash-1', 'batch-1', 0, ?, 'attempt-1',
         'implementer', '{}', '{}', '{}', 'running', ?, ?)`,
      [first.treeId, SOURCE, AUTO_SEED_NOW + 1_000, AUTO_SEED_NOW],
    );

    expect(await adopt({ db, prefix: 'tree-b' })).toMatchObject({
      kind: 'refused',
      code: 'already_in_auto',
    });
  });

  it('refuses an Auto agent as a source', async () => {
    const db = await makeWorld({ kind: 'auto' });

    expect(await adopt({ db, kind: 'auto' })).toMatchObject({
      kind: 'refused',
      code: 'not_adoptable',
    });
  });

  it('refuses a cycle: the source sits under, or above, an Auto agent', async () => {
    const above = await makeWorld({ extraAgents: ['agent-below'] });
    await above.execute(
      "UPDATE agents SET parent_agent_id = 'agent-source' WHERE id = 'agent-below'",
    );
    await above.execute("UPDATE agents SET kind = 'auto' WHERE id = 'agent-below'");
    expect(await adopt({ db: above })).toMatchObject({ kind: 'refused', code: 'cycle' });

    const below = await makeWorld({ extraAgents: ['agent-over'] });
    await below.execute(
      "UPDATE agents SET parent_agent_id = 'agent-over' WHERE id = 'agent-source'",
    );
    await below.execute("UPDATE agents SET kind = 'auto' WHERE id = 'agent-over'");
    expect(await adopt({ db: below })).toMatchObject({ kind: 'refused', code: 'cycle' });
    expect(await count({ db: below, table: 'auto_trees' })).toBe(0);
  });

  it('says the agent is gone when it was deleted', async () => {
    const db = await makeWorld();
    await db.execute('UPDATE agents SET deleted_at = ? WHERE id = ?', [AUTO_SEED_NOW, SOURCE]);

    expect(await adopt({ db })).toMatchObject({ kind: 'refused', code: 'agent_gone' });
  });
});

describe('a hand-over that fails half way', () => {
  it('leaves the source intact and writes nothing when the first insert fails', async () => {
    const db = await makeWorld();
    const before = await db.select('SELECT * FROM agents', []);

    const outcome = await adopt({ db, overrides: { 3: 'agent-source' } });

    expect(outcome.kind).toBe('failed');
    expect(await db.select('SELECT * FROM agents', [])).toEqual(before);
    expect(await count({ db, table: 'auto_trees' })).toBe(0);
    expect(await count({ db, table: 'auto_delegations' })).toBe(0);
    expect(await count({ db, table: 'auto_outbox' })).toBe(0);
  });

  it('rolls the agent, tree and delegation back when the very last insert fails', async () => {
    const db = await makeWorld();
    await seedAutoTree({ db });
    await insertAutoOutbox({
      db,
      outbox: {
        id: brandId<AutoOutboxId>({ value: LATE_CLASH }),
        treeId: brandId<AutoTreeId>({ value: 'tree-1' }),
        generation: 1,
        kind: 'user',
        joinKey: 'user:clash',
        payload: { kind: 'user', text: 'hello', facts: {} },
        nowMs: AUTO_SEED_NOW,
      },
    });
    const before = {
      agents: await count({ db, table: 'agents' }),
      trees: await count({ db, table: 'auto_trees' }),
      delegations: await count({ db, table: 'auto_delegations' }),
    };

    const outcome = await adopt({ db, overrides: { 5: LATE_CLASH } });

    expect(outcome.kind).toBe('failed');
    expect({
      agents: await count({ db, table: 'agents' }),
      trees: await count({ db, table: 'auto_trees' }),
      delegations: await count({ db, table: 'auto_delegations' }),
    }).toEqual(before);
    expect(await getAdoptionOfAgent({ db, agentId: SOURCE })).toBeNull();
  });

  it('lets the person try again after a failure', async () => {
    const db = await makeWorld();
    expect((await adopt({ db, overrides: { 3: 'agent-source' } })).kind).toBe('failed');

    expect((await adopt({ db, prefix: 'retry' })).kind).toBe('adopted');
    expect(await count({ db, table: 'auto_trees' })).toBe(1);
  });
});

describe('a restart right after the hand-over', () => {
  it('delivers the kickoff and the result of the adopted agent to Auto in its first turn', async () => {
    const db = await makeWorld();
    const outcome = await adopt({ db });
    if (outcome.kind !== 'adopted') {
      throw new Error('expected an adoption');
    }
    const ports = makeFakePorts({ idPrefix: 'restart' });
    const runtime = createAutoRuntime({
      ctx: {
        db,
        scheduler: createAutoScheduler({ db, ownerId: 'window-restart', now: () => AUTO_SEED_NOW }),
        ports,
        now: () => AUTO_SEED_NOW,
      },
      isEnabled: true,
      onError: (error) => {
        throw error instanceof Error ? error : new Error('runtime error');
      },
      sleep: async () => undefined,
      watchPolls: 3,
    });

    await runtime.recover(outcome.treeId);
    await runtime.settled();

    expect(ports.autoTurns).toHaveLength(1);
    const turn = ports.autoTurns[0];
    expect(turn?.agentId).toBe(outcome.autoAgentId);
    expect(turn?.text).toContain('RESULTS FROM YOUR AGENTS');
    expect(turn?.text).toContain('Added the cap and a test in ledger-core.');
    expect(turn?.text).toContain('Test it, then review it.');
    expect(await getAutoTree({ db, treeId: outcome.treeId })).toMatchObject({ phase: 'deciding' });
  });
});
