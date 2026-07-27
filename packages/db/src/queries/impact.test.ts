import { describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import {
  getContextHealth,
  getDelegationFlow,
  getModelMix,
  getOrchestrationOverview,
  getPlanAdoption,
  getRightSizeNudgeOutcomes,
  getTurnDistribution,
} from './impact';

const workspaceId = 'w1' as WorkspaceId;
const otherWorkspaceId = 'w2' as WorkspaceId;

const NOW = Date.UTC(2026, 6, 27, 12, 0, 0);
const DAY = 86_400_000;
const RECENT = NOW - 2 * DAY;
const OLD = NOW - 200 * DAY;
const SINCE = NOW - 30 * DAY;

const iso = (ms: number): string => new Date(ms).toISOString();

type SessionSeed = {
  readonly id: string;
  readonly at: number;
  readonly workspace?: WorkspaceId;
  readonly deleted?: boolean;
};

const seedDb = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(db);
  for (const id of [workspaceId, otherWorkspaceId]) {
    await db.execute(
      `INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [id, id, `/tmp/${id}`, OLD, NOW],
    );
  }
  return db;
};

const addSession = async (db: Database, seed: SessionSeed): Promise<void> => {
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, 'idle', ?, ?, ?)`,
    [
      seed.id,
      seed.workspace ?? workspaceId,
      `goal ${seed.id}`,
      seed.at,
      seed.at,
      seed.deleted === true ? seed.at : null,
    ],
  );
};

type AgentSeed = {
  readonly id: string;
  readonly sessionId: string;
  readonly at: number;
  readonly kind?: string;
  readonly parentId?: string;
  readonly runId?: string;
  readonly sourceThreadId?: string;
};

const addAgent = async (db: Database, seed: AgentSeed): Promise<void> => {
  await db.execute(
    `INSERT INTO agents (id, session_id, ordinal, name, status, provider_run_id, started_at, kind, parent_agent_id, source_thread_id)
     VALUES (?, ?, 0, ?, 'done', ?, ?, ?, ?, ?)`,
    [
      seed.id,
      seed.sessionId,
      seed.id,
      seed.runId ?? null,
      iso(seed.at),
      seed.kind ?? 'implementer',
      seed.parentId ?? null,
      seed.sourceThreadId ?? null,
    ],
  );
};

type TurnSeed = {
  readonly runId: string;
  readonly sessionId: string;
  readonly count: number;
  readonly at: number;
  readonly kind?: 'turn' | 'summarizer';
  readonly model?: string;
  readonly costUsd?: number;
};

const addRunWithTurns = async (db: Database, seed: TurnSeed): Promise<void> => {
  const existing = await db.select<{ id: string }>('SELECT id FROM provider_runs WHERE id = ?', [
    seed.runId,
  ]);
  if (existing.length === 0) {
    await db.execute(
      `INSERT INTO provider_runs (id, session_id, provider, model, status_kind, created_at)
       VALUES (?, ?, 'anthropic', ?, 'succeeded', ?)`,
      [seed.runId, seed.sessionId, seed.model ?? 'opus-5', seed.at],
    );
  }
  for (let index = 0; index < seed.count; index += 1) {
    await db.execute(
      `INSERT INTO telemetry_records (id, run_id, session_id, kind, provider, model, input_tokens, output_tokens, estimated_cost_usd, recorded_at)
       VALUES (?, ?, ?, ?, 'anthropic', ?, 100, 50, ?, ?)`,
      [
        `${seed.runId}-${seed.kind ?? 'turn'}-${index}`,
        seed.runId,
        seed.sessionId,
        seed.kind ?? 'turn',
        seed.model ?? 'opus-5',
        seed.costUsd ?? 0.5,
        seed.at,
      ],
    );
  }
};

const addConsumedPlan = async (
  db: Database,
  params: {
    readonly planId: string;
    readonly sessionId: string;
    readonly authorAgentId: string;
    readonly consumerAgentId: string;
    readonly at: number;
  },
): Promise<void> => {
  await db.execute(
    `INSERT INTO session_plans (id, session_id, agent_id, title, body_md, status, created_at, updated_at)
     VALUES (?, ?, ?, 'plan', 'body', 'consumed', ?, ?)`,
    [params.planId, params.sessionId, params.authorAgentId, params.at, params.at],
  );
  await db.execute(
    `INSERT INTO plan_consumptions (id, plan_id, agent_id, consumed_at) VALUES (?, ?, ?, ?)`,
    [`${params.planId}-c`, params.planId, params.consumerAgentId, params.at],
  );
};

describe('impact orchestration overview', () => {
  it('counts a session once even when several orchestration signals fire', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: RECENT });
    await addSession(db, { id: 's2', at: RECENT });
    await addAgent(db, { id: 'a1', sessionId: 's1', at: RECENT });
    await addAgent(db, { id: 'a2', sessionId: 's1', at: RECENT, parentId: 'a1' });
    await addAgent(db, { id: 'a3', sessionId: 's1', at: RECENT, kind: 'resolver' });
    await addConsumedPlan(db, {
      planId: 'p1',
      sessionId: 's1',
      authorAgentId: 'a1',
      consumerAgentId: 'a2',
      at: RECENT,
    });

    const overview = await getOrchestrationOverview(db, { workspaceId, sinceMs: null });

    expect(overview.sessionCount).toBe(2);
    expect(overview.orchestratedSessions).toBe(1);
    expect(overview.plannedSessions).toBe(1);
    expect(overview.splitSessions).toBe(1);
    expect(overview.resolverSessions).toBe(1);
  });

  it('excludes other workspaces and soft-deleted sessions', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: RECENT });
    await addSession(db, { id: 's2', at: RECENT, deleted: true });
    await addSession(db, { id: 's3', at: RECENT, workspace: otherWorkspaceId });

    const overview = await getOrchestrationOverview(db, { workspaceId, sinceMs: null });

    expect(overview.sessionCount).toBe(1);
  });

  it('reports an empty 30 day window while all time still has activity', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: OLD });
    await addAgent(db, { id: 'a1', sessionId: 's1', at: OLD });
    await addAgent(db, { id: 'a2', sessionId: 's1', at: OLD, parentId: 'a1' });

    const windowed = await getOrchestrationOverview(db, { workspaceId, sinceMs: SINCE });
    const allTime = await getOrchestrationOverview(db, { workspaceId, sinceMs: null });

    expect(windowed.sessionCount).toBe(0);
    expect(windowed.orchestratedSessions).toBe(0);
    expect(allTime.sessionCount).toBe(1);
    expect(allTime.orchestratedSessions).toBe(1);
  });
});

describe('impact plan adoption', () => {
  it('separates handoffs from self-consumed plans', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: RECENT });
    await addSession(db, { id: 's2', at: RECENT });
    await addAgent(db, { id: 'a1', sessionId: 's1', at: RECENT });
    await addAgent(db, { id: 'a2', sessionId: 's1', at: RECENT });
    await addAgent(db, { id: 'b1', sessionId: 's2', at: RECENT });
    await addConsumedPlan(db, {
      planId: 'p1',
      sessionId: 's1',
      authorAgentId: 'a1',
      consumerAgentId: 'a2',
      at: RECENT,
    });
    await addConsumedPlan(db, {
      planId: 'p2',
      sessionId: 's2',
      authorAgentId: 'b1',
      consumerAgentId: 'b1',
      at: RECENT,
    });

    const adoption = await getPlanAdoption(db, { workspaceId, sinceMs: null });

    expect(adoption.sessionCount).toBe(2);
    expect(adoption.plannedSessions).toBe(2);
    expect(adoption.consumedPlans).toBe(2);
    expect(adoption.handoffPlans).toBe(1);
    expect(adoption.handoffSessions).toBe(1);
  });

  it('degrades to a small raw fraction under five sessions', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: RECENT });
    await addSession(db, { id: 's2', at: RECENT });
    await addSession(db, { id: 's3', at: RECENT });
    await addAgent(db, { id: 'a1', sessionId: 's1', at: RECENT });
    await addConsumedPlan(db, {
      planId: 'p1',
      sessionId: 's1',
      authorAgentId: 'a1',
      consumerAgentId: 'a1',
      at: RECENT,
    });

    const adoption = await getPlanAdoption(db, { workspaceId, sinceMs: null });

    expect(adoption.plannedSessions).toBe(1);
    expect(adoption.sessionCount).toBe(3);
  });

  it('filters consumptions by consumed_at and not by session creation', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: OLD });
    await db.execute('UPDATE sessions SET updated_at = ? WHERE id = ?', [RECENT, 's1']);
    await addAgent(db, { id: 'a1', sessionId: 's1', at: RECENT });
    await addConsumedPlan(db, {
      planId: 'p1',
      sessionId: 's1',
      authorAgentId: 'a1',
      consumerAgentId: 'a1',
      at: RECENT,
    });
    await addConsumedPlan(db, {
      planId: 'p0',
      sessionId: 's1',
      authorAgentId: 'a1',
      consumerAgentId: 'a1',
      at: OLD,
    });

    const windowed = await getPlanAdoption(db, { workspaceId, sinceMs: SINCE });

    expect(windowed.sessionCount).toBe(1);
    expect(windowed.consumedPlans).toBe(1);
  });
});

describe('impact context health', () => {
  it('splits slot authorship and measures question outcomes', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: RECENT });
    await addSession(db, { id: 's2', at: RECENT });
    await db.execute(
      `INSERT INTO context_slots (session_id, key, value, enabled) VALUES ('s1', 'repo', 'v', 1)`,
    );
    await db.execute(
      `INSERT INTO context_slots (session_id, key, value, enabled) VALUES ('s2', 'repo', 'v', 0)`,
    );
    await db.execute(
      `INSERT INTO context_slot_history (id, session_id, key, value, author, created_at)
       VALUES ('h1', 's1', 'repo', 'v', 'user', ?), ('h2', 's1', 'repo', 'v2', 'summarizer', ?)`,
      [RECENT, RECENT],
    );
    await db.execute(
      `INSERT INTO open_questions (id, session_id, text, status, created_at, answered_at)
       VALUES ('q1', 's1', 'which db', 'answered', ?, ?)`,
      [RECENT, RECENT + 2 * 3_600_000],
    );
    await db.execute(
      `INSERT INTO open_questions (id, session_id, text, status, created_at, dismissed_at)
       VALUES ('q2', 's1', 'which api', 'dismissed', ?, ?)`,
      [RECENT, RECENT],
    );

    const health = await getContextHealth(db, { workspaceId, sinceMs: null });

    expect(health.slotSessions).toBe(1);
    expect(health.userEdits).toBe(1);
    expect(health.summarizerEdits).toBe(1);
    expect(health.questionsAnswered).toBe(1);
    expect(health.questionsDismissed).toBe(1);
    expect(health.avgHoursToAnswer).toBeCloseTo(2, 5);
  });

  it('leaves the answer time null when nothing was ever answered', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: RECENT });

    const health = await getContextHealth(db, { workspaceId, sinceMs: null });

    expect(health.questionsTotal).toBe(0);
    expect(health.avgHoursToAnswer).toBeNull();
  });
});

describe('impact turn distribution', () => {
  it('buckets agents by their turn count', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: RECENT });
    await addAgent(db, { id: 'a1', sessionId: 's1', at: RECENT, runId: 'r1' });
    await addAgent(db, { id: 'a2', sessionId: 's1', at: RECENT, runId: 'r2' });
    await addAgent(db, { id: 'a3', sessionId: 's1', at: RECENT, runId: 'r3' });
    await addRunWithTurns(db, { runId: 'r1', sessionId: 's1', count: 2, at: RECENT });
    await addRunWithTurns(db, { runId: 'r2', sessionId: 's1', count: 2, at: RECENT });
    await addRunWithTurns(db, { runId: 'r3', sessionId: 's1', count: 9, at: RECENT });

    const buckets = await getTurnDistribution(db, { workspaceId, sinceMs: null });

    expect(buckets).toEqual([
      { turnCount: 2, agentCount: 2 },
      { turnCount: 9, agentCount: 1 },
    ]);
  });

  it('returns nothing for a window with no recorded turns', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: OLD });
    await addAgent(db, { id: 'a1', sessionId: 's1', at: OLD, runId: 'r1' });
    await addRunWithTurns(db, { runId: 'r1', sessionId: 's1', count: 4, at: OLD });

    expect(await getTurnDistribution(db, { workspaceId, sinceMs: SINCE })).toEqual([]);
    expect(await getTurnDistribution(db, { workspaceId, sinceMs: null })).toHaveLength(1);
  });
});

describe('impact model mix', () => {
  it('groups spend by kind, provider and model', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: RECENT });
    await addRunWithTurns(db, {
      runId: 'r1',
      sessionId: 's1',
      count: 2,
      at: RECENT,
      costUsd: 1,
    });
    await addRunWithTurns(db, {
      runId: 'r1',
      sessionId: 's1',
      count: 1,
      at: RECENT,
      kind: 'summarizer',
      costUsd: 0.25,
    });

    const mix = await getModelMix(db, { workspaceId, sinceMs: null });
    const turn = mix.find((entry) => entry.kind === 'turn');
    const summarizer = mix.find((entry) => entry.kind === 'summarizer');

    expect(turn?.costUsd).toBeCloseTo(2, 5);
    expect(summarizer?.costUsd).toBeCloseTo(0.25, 5);
    expect(turn?.model).toBe('opus-5');
  });
});

describe('impact right-size nudges', () => {
  it('scopes nudge outcomes to the workspace through the context payload', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: RECENT });
    await addSession(db, { id: 's9', at: RECENT, workspace: otherWorkspaceId });
    await db.execute(
      `INSERT INTO nudge_events (id, ts, kind, context_json, outcome, outcome_ts)
       VALUES ('n1', ?, 'model-rightsize', ?, 'accepted', ?)`,
      [iso(RECENT), JSON.stringify({ sessionId: 's1' }), iso(RECENT)],
    );
    await db.execute(
      `INSERT INTO nudge_events (id, ts, kind, context_json, outcome, outcome_ts)
       VALUES ('n2', ?, 'model-rightsize', ?, 'overridden', ?)`,
      [iso(RECENT), JSON.stringify({ sessionId: 's1' }), iso(RECENT)],
    );
    await db.execute(
      `INSERT INTO nudge_events (id, ts, kind, context_json, outcome, outcome_ts)
       VALUES ('n3', ?, 'model-rightsize', ?, 'accepted', ?)`,
      [iso(RECENT), JSON.stringify({ sessionId: 's9' }), iso(RECENT)],
    );
    await db.execute(
      `INSERT INTO nudge_events (id, ts, kind, context_json, outcome, outcome_ts)
       VALUES ('n4', ?, 'scope-mismatch', ?, 'accepted', ?)`,
      [iso(RECENT), JSON.stringify({ sessionId: 's1' }), iso(RECENT)],
    );

    const outcomes = await getRightSizeNudgeOutcomes(db, { workspaceId, sinceMs: null });

    expect(outcomes).toEqual([
      { outcome: 'accepted', count: 1 },
      { outcome: 'overridden', count: 1 },
    ]);
  });

  it('returns no rows when the feature never fired', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: RECENT });

    expect(await getRightSizeNudgeOutcomes(db, { workspaceId, sinceMs: null })).toEqual([]);
  });
});

describe('impact delegation flow', () => {
  it('separates scout fan-out from clusters and counts discarded runs', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: RECENT });
    await addAgent(db, { id: 'scout', sessionId: 's1', at: RECENT, kind: 'scout' });
    await addAgent(db, { id: 'sub', sessionId: 's1', at: RECENT, parentId: 'scout' });
    await addAgent(db, { id: 'lead', sessionId: 's1', at: RECENT, kind: 'implementer' });
    await addAgent(db, { id: 'child', sessionId: 's1', at: RECENT, parentId: 'lead' });
    await db.execute(
      `INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at)
       VALUES ('wf', ?, 'flow', '', ?, ?)`,
      [workspaceId, RECENT, RECENT],
    );
    await db.execute(
      `INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, created_at)
       VALUES ('run1', 's1', 'wf', 0, ?)`,
      [iso(RECENT)],
    );
    await db.execute(
      `INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, created_at, discarded_at)
       VALUES ('run2', 's1', 'wf', 1, ?, ?)`,
      [iso(RECENT), iso(RECENT)],
    );

    const flow = await getDelegationFlow(db, { workspaceId, sinceMs: null });

    expect(flow.scoutChildren).toBe(1);
    expect(flow.clusterChildren).toBe(1);
    expect(flow.workflowRuns).toBe(2);
    expect(flow.discardedRuns).toBe(1);
  });

  it('counts long single-agent threads so the split coaching band can fire', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: RECENT });
    await addAgent(db, { id: 'a1', sessionId: 's1', at: RECENT, runId: 'r1' });
    await addAgent(db, { id: 'a2', sessionId: 's1', at: RECENT, runId: 'r2' });
    await addRunWithTurns(db, { runId: 'r1', sessionId: 's1', count: 13, at: RECENT });
    await addRunWithTurns(db, { runId: 'r2', sessionId: 's1', count: 12, at: RECENT });

    const flow = await getDelegationFlow(db, { workspaceId, sinceMs: null });

    expect(flow.longAgents).toBe(1);
    expect(flow.scoutChildren + flow.clusterChildren).toBe(0);
  });

  it('splits external links into started-from-issue and later links', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: RECENT });
    await addSession(db, { id: 's2', at: RECENT });
    await db.execute(
      `INSERT INTO session_external_tasks (session_id, provider, external_id, identifier, url, title, created_at)
       VALUES ('s1', 'linear', 'e1', 'ENG-1', 'https://x', 'issue', ?)`,
      [RECENT + 5_000],
    );
    await db.execute(
      `INSERT INTO session_external_tasks (session_id, provider, external_id, identifier, url, title, created_at)
       VALUES ('s2', 'linear', 'e2', 'ENG-2', 'https://y', 'issue', ?)`,
      [RECENT + 10 * 60_000],
    );

    const flow = await getDelegationFlow(db, { workspaceId, sinceMs: null });

    expect(flow.linkedSessions).toBe(2);
    expect(flow.startedFromSessions).toBe(1);
    expect(flow.external).toEqual([
      { provider: 'linear', linkedSessions: 2, startedFromSessions: 1 },
    ]);
  });

  it('reports connected integrations with no linked session in the window', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: RECENT });
    await db.execute(
      `INSERT INTO workspace_integrations (id, workspace_id, provider, credential_key, created_at, updated_at)
       VALUES ('i1', ?, 'linear', 'k', ?, ?)`,
      [workspaceId, RECENT, RECENT],
    );

    const flow = await getDelegationFlow(db, { workspaceId, sinceMs: SINCE });

    expect(flow.integrationCount).toBe(1);
    expect(flow.linkedSessions).toBe(0);
  });

  it('counts handled diff comments and ignores deleted ones', async () => {
    const db = await seedDb();
    await addSession(db, { id: 's1', at: RECENT });
    await db.execute(
      `INSERT INTO diff_comments (id, session_id, file_path, body, status, created_at)
       VALUES ('d1', 's1', 'a.ts', 'x', 'open', ?), ('d2', 's1', 'a.ts', 'y', 'resolved', ?),
              ('d3', 's1', 'a.ts', 'z', 'consumed', ?), ('d4', 's1', 'a.ts', 'w', 'deleted', ?)`,
      [RECENT, RECENT, RECENT, RECENT],
    );

    const flow = await getDelegationFlow(db, { workspaceId, sinceMs: null });

    expect(flow.diffCommentsTotal).toBe(3);
    expect(flow.diffCommentsHandled).toBe(2);
  });
});
