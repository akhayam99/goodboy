import { describe, expect, it } from 'vitest';
import type { AgentId, PlanId, SessionId } from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import {
  deletePlan,
  listConsumptionsForPlan,
  listPlansForSession,
  updatePlanBody,
  updatePlanStatus,
  upsertPlan,
} from './plan';

async function seedFixture() {
  const db = makeTestDatabase();
  await migrate(db);
  const now = Date.now();
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    ['w1', 'ws', '/tmp/ws', now, now],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ['t1', 'w1', 'goal', 'idle', now, now],
  );
  await db.execute(
    `INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, ?, ?, ?)`,
    ['a1', 't1', 0, 'planner agent', 'pending'],
  );
  await db.execute(
    `INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, ?, ?, ?)`,
    ['a2', 't1', 1, 'second planner', 'pending'],
  );
  await db.execute(
    `INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, ?, ?, ?)`,
    ['a3', 't1', 2, 'third implementer', 'pending'],
  );
  return db;
}

type ConsumptionSeed = {
  readonly id: string;
  readonly planId: string;
  readonly agentId: string;
  readonly consumedAt: number;
};

async function seedConsumption(db: Awaited<ReturnType<typeof seedFixture>>, seed: ConsumptionSeed) {
  await db.execute(
    `INSERT INTO plan_consumptions (id, plan_id, agent_id, consumed_at) VALUES (?, ?, ?, ?)`,
    [seed.id, seed.planId, seed.agentId, seed.consumedAt],
  );
}

const sessionId = 't1' as SessionId;
const agentA1 = 'a1' as AgentId;
const agentA2 = 'a2' as AgentId;

describe('plan artifact queries', () => {
  it('upsertPlan inserts a new plan and listPlansForSession returns it', async () => {
    const db = await seedFixture();
    await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 'first plan',
      bodyMd: 'body',
    });
    const plans = await listPlansForSession(db, sessionId);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.title).toBe('first plan');
    expect(plans[0]!.bodyMd).toBe('body');
    expect(plans[0]!.status).toBe('active');
    expect(plans[0]!.agentId).toBe(agentA1);
  });

  it('upsertPlan on conflict replaces body and status (same session+agent)', async () => {
    const db = await seedFixture();
    await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 'v1',
      bodyMd: 'b1',
    });
    await upsertPlan(db, {
      id: 'p2' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 'v2',
      bodyMd: 'b2',
    });
    const plans = await listPlansForSession(db, sessionId);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.title).toBe('v2');
    expect(plans[0]!.bodyMd).toBe('b2');
  });

  it('upsert from a different agent overwrites the single active plan slot', async () => {
    const db = await seedFixture();
    await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 'a1 plan',
      bodyMd: 'body1',
    });
    await upsertPlan(db, {
      id: 'p2' as PlanId,
      sessionId: sessionId,
      agentId: agentA2,
      title: 'a2 plan',
      bodyMd: 'body2',
    });
    const plans = await listPlansForSession(db, sessionId);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.title).toBe('a2 plan');
    expect(plans[0]!.status).toBe('active');
  });

  it('after consume a new plan starts a fresh row; list is creation-order (oldest first)', async () => {
    const db = await seedFixture();
    const older = await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 'older',
      bodyMd: '',
    });
    await updatePlanStatus(db, older.id, 'consumed');
    await new Promise((r) => setTimeout(r, 5));
    await upsertPlan(db, {
      id: 'p2' as PlanId,
      sessionId: sessionId,
      agentId: agentA2,
      title: 'newer',
      bodyMd: '',
    });
    const plans = await listPlansForSession(db, sessionId);
    expect(plans).toHaveLength(2);
    expect(plans[0]!.title).toBe('older');
    expect(plans[plans.length - 1]!.title).toBe('newer');
  });

  it('round-trips execution clusters through clusters_json', async () => {
    const db = await seedFixture();
    await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 'clustered plan',
      bodyMd: 'body',
      clusters: [
        { title: 'move files to domain', instructions: 'relocate the files' },
        { title: 'update imports', instructions: 'fix import paths' },
      ],
    });
    const plans = await listPlansForSession(db, sessionId);
    expect(plans[0]!.clusters).toEqual([
      { title: 'move files to domain', instructions: 'relocate the files' },
      { title: 'update imports', instructions: 'fix import paths' },
    ]);
  });

  it('still loads clusters that carry a field this build does not know', async () => {
    const db = await seedFixture();
    await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 'clustered plan',
      bodyMd: 'body',
      clusters: [{ title: 'move files to domain', instructions: 'relocate the files' }],
    });
    await db.execute(`UPDATE session_artifacts SET metadata_json = ? WHERE id = ?`, [
      JSON.stringify({
        clusters: [
          { title: 'move files to domain', instructions: 'relocate the files', ownerHint: 'ak' },
        ],
      }),
      'p1',
    ]);
    const plans = await listPlansForSession(db, sessionId);

    expect(plans[0]!.clusters).toHaveLength(1);
    expect(plans[0]!.clusters![0]!.title).toBe('move files to domain');
  });

  it('omits clusters when none were provided', async () => {
    const db = await seedFixture();
    await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 'plain plan',
      bodyMd: 'body',
    });
    const plans = await listPlansForSession(db, sessionId);
    expect(plans[0]!.clusters).toBeUndefined();
  });

  it('updatePlanStatus changes the status', async () => {
    const db = await seedFixture();
    const plan = await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 'x',
      bodyMd: 'b',
    });
    await updatePlanStatus(db, plan.id, 'consumed');
    const refreshed = await listPlansForSession(db, sessionId);
    expect(refreshed[0]!.status).toBe('consumed');
  });

  it('updatePlanBody changes title and body', async () => {
    const db = await seedFixture();
    const plan = await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 'old',
      bodyMd: 'b',
    });
    await updatePlanBody(db, plan.id, 'new title', 'new body');
    const refreshed = await listPlansForSession(db, sessionId);
    expect(refreshed[0]!.title).toBe('new title');
    expect(refreshed[0]!.bodyMd).toBe('new body');
  });

  it('deletePlan removes the row', async () => {
    const db = await seedFixture();
    const plan = await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 't',
      bodyMd: 'b',
    });
    await deletePlan(db, plan.id);
    const refreshed = await listPlansForSession(db, sessionId);
    expect(refreshed).toHaveLength(0);
  });

  it('reports no last consumer for a plan nobody ran', async () => {
    const db = await seedFixture();
    await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 'never run',
      bodyMd: 'b',
    });
    const plans = await listPlansForSession(db, sessionId);
    expect(plans[0]!.consumptionCount).toBe(0);
    expect(plans[0]!.lastConsumer).toBeNull();
  });

  it('names the single consumer of a plan that ran once', async () => {
    const db = await seedFixture();
    await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 'ran once',
      bodyMd: 'b',
    });
    await seedConsumption(db, { id: 'c1', planId: 'p1', agentId: 'a2', consumedAt: 1_000 });
    const plans = await listPlansForSession(db, sessionId);
    expect(plans[0]!.consumptionCount).toBe(1);
    expect(plans[0]!.lastConsumer).toEqual({ agentId: 'a2', name: 'second planner' });
  });

  it('returns the most recent consumer when a plan ran several times', async () => {
    const db = await seedFixture();
    await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 'ran thrice',
      bodyMd: 'b',
    });
    await seedConsumption(db, { id: 'c-mid', planId: 'p1', agentId: 'a1', consumedAt: 2_000 });
    await seedConsumption(db, { id: 'c-last', planId: 'p1', agentId: 'a3', consumedAt: 3_000 });
    await seedConsumption(db, { id: 'c-first', planId: 'p1', agentId: 'a2', consumedAt: 1_000 });

    const plans = await listPlansForSession(db, sessionId);

    expect(plans[0]!.consumptionCount).toBe(3);
    expect(plans[0]!.lastConsumer).toEqual({ agentId: 'a3', name: 'third implementer' });
  });

  it('keeps each plan on its own last consumer', async () => {
    const db = await seedFixture();
    const first = await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 'older',
      bodyMd: '',
    });
    await updatePlanStatus(db, first.id, 'consumed');
    await new Promise((r) => setTimeout(r, 5));
    await upsertPlan(db, {
      id: 'p2' as PlanId,
      sessionId: sessionId,
      agentId: agentA2,
      title: 'newer',
      bodyMd: '',
    });
    await seedConsumption(db, { id: 'c1', planId: 'p1', agentId: 'a2', consumedAt: 5_000 });
    await seedConsumption(db, { id: 'c2', planId: 'p2', agentId: 'a3', consumedAt: 1_000 });

    const plans = await listPlansForSession(db, sessionId);

    expect(plans[0]!.lastConsumer).toEqual({ agentId: 'a2', name: 'second planner' });
    expect(plans[1]!.lastConsumer).toEqual({ agentId: 'a3', name: 'third implementer' });
  });

  it('agrees with the consumption history when two consumptions share the same consumed_at', async () => {
    const db = await seedFixture();
    await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 'ran twice at once',
      bodyMd: 'b',
    });
    await seedConsumption(db, { id: 'c1', planId: 'p1', agentId: 'a2', consumedAt: 1_000 });
    await seedConsumption(db, { id: 'c2', planId: 'p1', agentId: 'a3', consumedAt: 1_000 });

    const plans = await listPlansForSession(db, sessionId);
    const history = await listConsumptionsForPlan(db, 'p1' as PlanId);

    expect(plans[0]!.lastConsumer?.agentId).toBe(history[0]!.agentId);
  });

  it('cascades on task delete', async () => {
    const db = await seedFixture();
    await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: sessionId,
      agentId: agentA1,
      title: 't',
      bodyMd: 'b',
    });
    await db.execute(`DELETE FROM sessions WHERE id = ?`, ['t1']);
    const refreshed = await listPlansForSession(db, sessionId);
    expect(refreshed).toHaveLength(0);
  });
});
