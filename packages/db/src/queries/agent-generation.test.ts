import { describe, expect, it } from 'vitest';
import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import type { Database } from '../client';
import { migrate } from '../migrations/runner';
import { makeTestDatabase } from '../test-helpers/test-db';
import {
  bindAgentGeneration,
  countObligationAttempts,
  listGenerationRefusals,
  reserveAgentGeneration,
} from './agent-generation';

const sessionId = 'session' as SessionId;
const otherSessionId = 'other-session' as SessionId;
const workflowRunId = 'run' as WorkflowRunId;

const insertAgent = async ({
  db,
  id,
  parentAgentId,
  session,
}: {
  readonly db: Database;
  readonly id: string;
  readonly parentAgentId: string | null;
  readonly session?: SessionId;
}): Promise<void> => {
  await db.execute(
    'INSERT INTO agents (id, session_id, ordinal, name, status, workflow_run_id, parent_agent_id) VALUES (?, ?, 0, ?, ?, ?, ?)',
    [id, session ?? sessionId, id, 'running', workflowRunId, parentAgentId],
  );
};

const seed = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(db);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  for (const id of [sessionId, otherSessionId]) {
    await db.execute(
      'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1)',
      [id, 'workspace', 'Goal', 'idle'],
    );
  }
  await db.execute(
    "INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES ('workflow', 'workspace', 'Flow', 1, 1)",
  );
  await db.execute(
    "INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, created_at) VALUES ('run', 'session', 'workflow', 0, 0, 1)",
  );
  await insertAgent({ db, id: 'root', parentAgentId: null });
  return db;
};

const reserveUnder = async ({
  db,
  parentAgentId,
  reservationId,
  count = 1,
  obligationId = null,
  purpose = null,
}: {
  readonly db: Database;
  readonly parentAgentId: AgentId | null;
  readonly reservationId: string;
  readonly count?: number;
  readonly obligationId?: string | null;
  readonly purpose?: string | null;
}) =>
  reserveAgentGeneration({
    db,
    reservationId,
    sessionId,
    workflowRunId: null,
    parentAgentId,
    creationPath: 'capability',
    count,
    obligationId,
    purpose,
  });

const generate = async ({
  db,
  parentAgentId,
  childId,
}: {
  readonly db: Database;
  readonly parentAgentId: AgentId;
  readonly childId: string;
}) => {
  const reservation = await reserveUnder({
    db,
    parentAgentId,
    reservationId: `reservation:${childId}`,
  });
  if (reservation.kind === 'granted') {
    await insertAgent({ db, id: childId, parentAgentId });
    await bindAgentGeneration({
      db,
      bindings: [
        {
          reservationId: reservation.reservations[0]!.reservationId,
          agentId: childId as AgentId,
        },
      ],
    });
  }
  return reservation;
};

describe('agent generation ledger', () => {
  it('allows depth three and refuses depth four', async () => {
    const db = await seed();

    const first = await generate({ db, parentAgentId: 'root' as AgentId, childId: 'g1' });
    const second = await generate({ db, parentAgentId: 'g1' as AgentId, childId: 'g2' });
    const third = await generate({ db, parentAgentId: 'g2' as AgentId, childId: 'g3' });
    const fourth = await generate({ db, parentAgentId: 'g3' as AgentId, childId: 'g4' });

    expect(first.kind === 'granted' ? first.reservations[0]?.depth : null).toBe(1);
    expect(second.kind === 'granted' ? second.reservations[0]?.depth : null).toBe(2);
    expect(third.kind === 'granted' ? third.reservations[0]?.depth : null).toBe(3);
    expect(fourth.kind).toBe('refused');
    expect(fourth.kind === 'refused' ? fourth.limit : null).toBe('depth');
  });

  it('allows the twentieth descendant of a root and refuses the twenty first once', async () => {
    const db = await seed();

    for (let index = 0; index < 20; index++) {
      const outcome = await generate({
        db,
        parentAgentId: 'root' as AgentId,
        childId: `child-${index}`,
      });
      expect(outcome.kind).toBe('granted');
    }

    const overflow = await reserveUnder({
      db,
      parentAgentId: 'root' as AgentId,
      reservationId: 'reservation:overflow',
    });
    const repeat = await reserveUnder({
      db,
      parentAgentId: 'root' as AgentId,
      reservationId: 'reservation:overflow-again',
    });

    expect(overflow.kind === 'refused' ? overflow.limit : null).toBe('root-descendants');
    expect(overflow.kind === 'refused' ? overflow.isFirstRefusal : null).toBe(true);
    expect(repeat.kind === 'refused' ? repeat.isFirstRefusal : null).toBe(false);

    const refusals = await listGenerationRefusals({ db, sessionId });
    expect(refusals).toHaveLength(1);
    expect(refusals[0]?.limitName).toBe('root-descendants');
  });

  it('does not refund allowance when an agent is deleted or retried', async () => {
    const db = await seed();
    for (let index = 0; index < 20; index++) {
      await generate({ db, parentAgentId: 'root' as AgentId, childId: `child-${index}` });
    }

    await db.execute("DELETE FROM agents WHERE id LIKE 'child-%'");
    const afterDelete = await reserveUnder({
      db,
      parentAgentId: 'root' as AgentId,
      reservationId: 'reservation:after-delete',
    });

    expect(afterDelete.kind).toBe('refused');

    const retried = await reserveUnder({
      db,
      parentAgentId: 'root' as AgentId,
      reservationId: 'reservation:child-0',
    });
    expect(retried.kind).toBe('refused');
  });

  it('yields exactly one winner for the last slot', async () => {
    const db = await seed();
    for (let index = 0; index < 19; index++) {
      await generate({ db, parentAgentId: 'root' as AgentId, childId: `child-${index}` });
    }

    const [left, right] = await Promise.all([
      reserveUnder({ db, parentAgentId: 'root' as AgentId, reservationId: 'reservation:left' }),
      reserveUnder({ db, parentAgentId: 'root' as AgentId, reservationId: 'reservation:right' }),
    ]);

    const granted = [left, right].filter((outcome) => outcome.kind === 'granted');
    expect(granted).toHaveLength(1);
    const rows = await db.select<{ readonly total: number }>(
      "SELECT COUNT(*) AS total FROM agent_generation_ledger WHERE causal_root_agent_id = 'root' AND depth > 0",
    );
    expect(rows[0]?.total).toBe(20);
  });

  it('rejects a cycle, a missing ancestor and a cross session parent link', async () => {
    const db = await seed();
    await insertAgent({ db, id: 'loop-a', parentAgentId: 'loop-b' });
    await insertAgent({ db, id: 'loop-b', parentAgentId: 'loop-a' });
    await insertAgent({
      db,
      id: 'foreign',
      parentAgentId: null,
      session: otherSessionId,
    });

    const cycle = await reserveUnder({
      db,
      parentAgentId: 'loop-a' as AgentId,
      reservationId: 'reservation:cycle',
    });
    const missing = await reserveUnder({
      db,
      parentAgentId: 'ghost' as AgentId,
      reservationId: 'reservation:missing',
    });
    const foreign = await reserveUnder({
      db,
      parentAgentId: 'foreign' as AgentId,
      reservationId: 'reservation:foreign',
    });

    expect(cycle.kind === 'refused' ? cycle.limit : null).toBe('lineage');
    expect(missing.kind === 'refused' ? missing.reason : '').toContain('not on record');
    expect(foreign.kind === 'refused' ? foreign.reason : '').toContain('another session');
  });

  it('counts the attempts one obligation took from the same ledger that caps them', async () => {
    const db = await seed();
    const attempt = async (reservationId: string) =>
      reserveAgentGeneration({
        db,
        reservationId,
        sessionId,
        workflowRunId,
        parentAgentId: 'root' as AgentId,
        creationPath: 'capability',
        count: 1,
        obligationId: 'obligation-1',
        purpose: 'repair',
      });

    expect(await countObligationAttempts({ db, obligationId: 'obligation-1' })).toBe(0);
    await attempt('reservation:a');
    await attempt('reservation:b');
    await attempt('reservation:c');

    expect(await countObligationAttempts({ db, obligationId: 'obligation-1' })).toBe(2);
    expect(await countObligationAttempts({ db, obligationId: 'obligation-2' })).toBe(0);
  });

  it('caps automatic attempts on one obligation and structural replans on one run', async () => {
    const db = await seed();
    const attempt = async (reservationId: string) =>
      reserveAgentGeneration({
        db,
        reservationId,
        sessionId,
        workflowRunId,
        parentAgentId: 'root' as AgentId,
        creationPath: 'capability',
        count: 1,
        obligationId: 'obligation-1',
        purpose: 'repair',
      });

    expect((await attempt('reservation:a')).kind).toBe('granted');
    expect((await attempt('reservation:b')).kind).toBe('granted');
    const third = await attempt('reservation:c');
    expect(third.kind === 'refused' ? third.limit : null).toBe('repair-attempts');

    const replan = async (reservationId: string) =>
      reserveAgentGeneration({
        db,
        reservationId,
        sessionId,
        workflowRunId,
        parentAgentId: 'root' as AgentId,
        creationPath: 'capability',
        count: 1,
        obligationId: null,
        purpose: 'replan',
      });

    expect((await replan('reservation:replan-1')).kind).toBe('granted');
    const second = await replan('reservation:replan-2');
    expect(second.kind === 'refused' ? second.limit : null).toBe('structural-replans');
  });

  it('spends one ledger for fan-out and cluster materialization alike', async () => {
    const db = await seed();

    const fanOut = await reserveAgentGeneration({
      db,
      reservationId: 'reservation:fan-out',
      sessionId,
      workflowRunId,
      parentAgentId: 'root' as AgentId,
      creationPath: 'fan-out',
      count: 4,
    });
    const cluster = await reserveAgentGeneration({
      db,
      reservationId: 'reservation:cluster',
      sessionId,
      workflowRunId,
      parentAgentId: 'root' as AgentId,
      creationPath: 'cluster',
      count: 3,
    });

    expect(fanOut.kind === 'granted' ? fanOut.reservations.length : 0).toBe(4);
    expect(cluster.kind === 'granted' ? cluster.reservations.length : 0).toBe(3);
    const rows = await db.select<{ readonly total: number }>(
      "SELECT COUNT(*) AS total FROM agent_generation_ledger WHERE causal_root_agent_id = 'root' AND depth > 0",
    );
    expect(rows[0]?.total).toBe(7);
  });
});
