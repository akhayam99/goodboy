import { describe, expect, it } from 'vitest';
import type { PlanId, SessionId, TaskId } from '@kay-am/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import {
  deletePlan,
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
    `INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    ['w1', 'ws', '/tmp/ws', now, now],
  );
  await db.execute(
    `INSERT INTO tasks (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ['t1', 'w1', 'goal', 'idle', now, now],
  );
  await db.execute(
    `INSERT INTO sessions (id, task_id, ordinal, name, status, parallel_index) VALUES (?, ?, ?, ?, ?, ?)`,
    ['a1', 't1', 0, 'planner agent', 'pending', 0],
  );
  await db.execute(
    `INSERT INTO sessions (id, task_id, ordinal, name, status, parallel_index) VALUES (?, ?, ?, ?, ?, ?)`,
    ['a2', 't1', 1, 'second planner', 'pending', 0],
  );
  return db;
}

const taskId = 't1' as TaskId;
const agentA1 = 'a1' as SessionId;
const agentA2 = 'a2' as SessionId;

describe('session_plans queries', () => {
  it('upsertPlan inserts a new plan and listPlansForSession returns it', async () => {
    const db = await seedFixture();
    await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: taskId,
      agentId: agentA1,
      title: 'first plan',
      bodyMd: 'body',
    });
    const plans = await listPlansForSession(db, taskId);
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
      sessionId: taskId,
      agentId: agentA1,
      title: 'v1',
      bodyMd: 'b1',
    });
    await upsertPlan(db, {
      id: 'p2' as PlanId,
      sessionId: taskId,
      agentId: agentA1,
      title: 'v2',
      bodyMd: 'b2',
    });
    const plans = await listPlansForSession(db, taskId);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.title).toBe('v2');
    expect(plans[0]!.bodyMd).toBe('b2');
  });

  it('upsert from a different agent overwrites the single active plan slot', async () => {
    const db = await seedFixture();
    await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: taskId,
      agentId: agentA1,
      title: 'a1 plan',
      bodyMd: 'body1',
    });
    await upsertPlan(db, {
      id: 'p2' as PlanId,
      sessionId: taskId,
      agentId: agentA2,
      title: 'a2 plan',
      bodyMd: 'body2',
    });
    const plans = await listPlansForSession(db, taskId);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.title).toBe('a2 plan');
    expect(plans[0]!.status).toBe('active');
  });

  it('after consume a new plan starts a fresh row; list is creation-order (oldest first)', async () => {
    const db = await seedFixture();
    const older = await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: taskId,
      agentId: agentA1,
      title: 'older',
      bodyMd: '',
    });
    await updatePlanStatus(db, older.id, 'consumed');
    await new Promise((r) => setTimeout(r, 5));
    await upsertPlan(db, {
      id: 'p2' as PlanId,
      sessionId: taskId,
      agentId: agentA2,
      title: 'newer',
      bodyMd: '',
    });
    const plans = await listPlansForSession(db, taskId);
    expect(plans).toHaveLength(2);
    expect(plans[0]!.title).toBe('older');
    expect(plans[plans.length - 1]!.title).toBe('newer');
  });

  it('updatePlanStatus changes the status', async () => {
    const db = await seedFixture();
    const plan = await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: taskId,
      agentId: agentA1,
      title: 'x',
      bodyMd: 'b',
    });
    await updatePlanStatus(db, plan.id, 'consumed');
    const refreshed = await listPlansForSession(db, taskId);
    expect(refreshed[0]!.status).toBe('consumed');
  });

  it('updatePlanBody changes title and body', async () => {
    const db = await seedFixture();
    const plan = await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: taskId,
      agentId: agentA1,
      title: 'old',
      bodyMd: 'b',
    });
    await updatePlanBody(db, plan.id, 'new title', 'new body');
    const refreshed = await listPlansForSession(db, taskId);
    expect(refreshed[0]!.title).toBe('new title');
    expect(refreshed[0]!.bodyMd).toBe('new body');
  });

  it('deletePlan removes the row', async () => {
    const db = await seedFixture();
    const plan = await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: taskId,
      agentId: agentA1,
      title: 't',
      bodyMd: 'b',
    });
    await deletePlan(db, plan.id);
    const refreshed = await listPlansForSession(db, taskId);
    expect(refreshed).toHaveLength(0);
  });

  it('cascades on task delete', async () => {
    const db = await seedFixture();
    await upsertPlan(db, {
      id: 'p1' as PlanId,
      sessionId: taskId,
      agentId: agentA1,
      title: 't',
      bodyMd: 'b',
    });
    await db.execute(`DELETE FROM tasks WHERE id = ?`, ['t1']);
    const refreshed = await listPlansForSession(db, taskId);
    expect(refreshed).toHaveLength(0);
  });
});
