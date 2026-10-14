import { describe, expect, it } from 'vitest';
import {
  getAdoptionOfAgent,
  getAutoTree,
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
  seedPlanArtifact,
} from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AgentId } from '@goodboy/types';
import { adoptAgent, type AdoptOutcome } from './adoptAgent';
import { createAutoRuntime } from './createAutoRuntime';
import { detachAdopted } from './detachAdopted';
import { createAutoScheduler } from './scheduler';
import { makeFakePorts } from './testing/fakePorts';

const SOURCE = brandId<AgentId>({ value: 'agent-source' });

type MovedParams = {
  readonly prefix?: string;
};

const makeMoved = async ({ prefix = 'adopt' }: MovedParams = {}) => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db, agentIds: ['agent-source'] });
  await db.execute("UPDATE agents SET name = 'Implementer', kind = 'implementer' WHERE id = ?", [
    SOURCE,
  ]);
  await seedPlanArtifact({ db, id: 'plan-retry', agentId: 'agent-source' });
  const outcome = await move({ db, prefix });
  if (outcome.kind !== 'adopted') {
    throw new Error('expected an adoption');
  }
  return { db, ...outcome };
};

type MoveParams = {
  readonly db: Database;
  readonly prefix: string;
};

const move = ({ db, prefix }: MoveParams): Promise<AdoptOutcome> => {
  let counter = 0;
  return adoptAgent({
    db,
    sessionId: AUTO_SEED_SESSION,
    sourceAgentId: SOURCE,
    source: {
      kind: 'implementer',
      roleLabel: 'Implementer',
      isTurnLive: false,
      goal: 'Add the retry cap to ledger-core',
      lastReply: 'Added the cap and a test in ledger-core.',
      mountLabel: null,
      provider: 'anthropic',
      model: 'sonnet',
      effort: 'medium',
    },
    instruction: '',
    autoRouting: { provider: 'anthropic', model: 'opus', effort: 'medium' },
    primaryMountId: 'mount-ledger-core',
    capUsd: 5,
    nowMs: AUTO_SEED_NOW,
    newId: () => {
      counter += 1;
      return `${prefix}-${counter}`;
    },
  });
};

describe('detaching an agent from Auto', () => {
  it('removes the adopted link, its artifacts and the pending words about it, and keeps the agent', async () => {
    const { db, treeId } = await makeMoved();

    const outcome = await detachAdopted({ db, agentId: SOURCE, nowMs: AUTO_SEED_NOW + 1_000 });

    expect(outcome).toEqual({ kind: 'detached', treeId });
    expect(await getAdoptionOfAgent({ db, agentId: SOURCE })).toBeNull();
    expect(await listAutoDelegations({ db, treeId })).toEqual([]);
    expect(await listAutoArtifacts({ db, treeId })).toEqual([]);
    expect(await listAutoOutbox({ db, treeId })).toEqual([]);
    const source = await db.select<{ readonly id: string; readonly kind: string }>(
      'SELECT id, kind FROM live_agents WHERE id = ?',
      [SOURCE],
    );
    expect(source).toEqual([{ id: 'agent-source', kind: 'implementer' }]);
  });

  it('bumps the revision of the tree so a transition planned before it cannot land', async () => {
    const { db, treeId } = await makeMoved();
    const before = await getAutoTree({ db, treeId });

    await detachAdopted({ db, agentId: SOURCE, nowMs: AUTO_SEED_NOW + 1_000 });

    expect((await getAutoTree({ db, treeId }))?.phaseRev).toBe((before?.phaseRev ?? 0) + 1);
  });

  it('keeps what Auto already read: a delivered results row stays in the history', async () => {
    const { db, treeId } = await makeMoved();
    const ports = makeFakePorts({ idPrefix: 'run' });
    const runtime = createAutoRuntime({
      ctx: {
        db,
        scheduler: createAutoScheduler({ db, ownerId: 'window-a', now: () => AUTO_SEED_NOW }),
        ports,
        now: () => AUTO_SEED_NOW,
      },
      isEnabled: true,
      onError: () => undefined,
      sleep: async () => undefined,
      watchPolls: 3,
    });
    await runtime.recover(treeId);
    await runtime.settled();
    const delivered = await listAutoOutbox({ db, treeId });
    expect(delivered.length).toBeGreaterThan(0);

    await detachAdopted({ db, agentId: SOURCE, nowMs: AUTO_SEED_NOW + 1_000 });

    expect(await listAutoOutbox({ db, treeId })).toHaveLength(delivered.length);
  });

  it('can move again after a detach, and makes a new Auto for it', async () => {
    const { db, treeId } = await makeMoved();
    await detachAdopted({ db, agentId: SOURCE, nowMs: AUTO_SEED_NOW + 1_000 });

    const again = await move({ db, prefix: 'again' });

    expect(again.kind).toBe('adopted');
    expect(again.kind === 'adopted' ? again.treeId : treeId).not.toBe(treeId);
    expect(await getAdoptionOfAgent({ db, agentId: SOURCE })).not.toBeNull();
  });

  it('says it again and changes nothing when the agent is already detached', async () => {
    const { db } = await makeMoved();
    await detachAdopted({ db, agentId: SOURCE, nowMs: AUTO_SEED_NOW + 1_000 });

    const second = await detachAdopted({ db, agentId: SOURCE, nowMs: AUTO_SEED_NOW + 2_000 });

    expect(second).toMatchObject({ kind: 'refused', code: 'not_adopted' });
  });

  it('waits for the turn of the agent to end', async () => {
    const { db, treeId } = await makeMoved();
    await db.execute("UPDATE agents SET status = 'running' WHERE id = ?", [SOURCE]);

    const refused = await detachAdopted({ db, agentId: SOURCE, nowMs: AUTO_SEED_NOW + 1_000 });

    expect(refused).toMatchObject({ kind: 'refused', code: 'turn_running' });
    expect(await listAutoDelegations({ db, treeId })).toHaveLength(1);

    await db.execute("UPDATE agents SET status = 'completed' WHERE id = ?", [SOURCE]);
    expect((await detachAdopted({ db, agentId: SOURCE, nowMs: AUTO_SEED_NOW + 2_000 })).kind).toBe(
      'detached',
    );
  });

  it('refuses an agent that was never moved', async () => {
    const db = await makeMigratedTestDatabase();
    await seedAutoSession({ db, agentIds: ['agent-source'] });

    expect(await detachAdopted({ db, agentId: SOURCE, nowMs: AUTO_SEED_NOW })).toMatchObject({
      kind: 'refused',
      code: 'not_adopted',
    });
  });

  it('reports a database failure and leaves the link in place', async () => {
    const { db, treeId } = await makeMoved();
    const failing: Database = {
      exec: db.exec.bind(db),
      execute: db.execute.bind(db),
      select: db.select.bind(db),
      transaction: () => Promise.reject(new Error('disk is full')),
    };

    const outcome = await detachAdopted({ db: failing, agentId: SOURCE, nowMs: AUTO_SEED_NOW });

    expect(outcome).toMatchObject({ kind: 'failed' });
    expect(await listAutoDelegations({ db, treeId })).toHaveLength(1);
  });
});
