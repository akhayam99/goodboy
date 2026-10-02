import { describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import {
  addImpactEvent,
  addImpactLink,
  addImpactMount,
  addImpactSession,
  addImpactTelemetry,
  seedImpactDb,
  type ImpactTelemetrySeed,
} from '../test-helpers/impact-seeds';
import {
  getAgentDurations,
  getCacheEfficiency,
  getContextGrowth,
  getExternalTaskOutcomes,
  getFlowHealth,
  getImpactOverview,
  getPullRequestOutcomes,
  getReviewOutcomes,
  getRightSizeNudgeOutcomes,
  getTurnDistribution,
} from './impact';

const workspaceId = 'w1' as WorkspaceId;
const otherWorkspaceId = 'w2' as WorkspaceId;
const NOW = Date.UTC(2026, 6, 27, 12, 0, 0);
const DAY_MS = 86_400_000;
const RECENT = NOW - 2 * DAY_MS;
const OLD = NOW - 45 * DAY_MS;
const SINCE = NOW - 30 * DAY_MS;

const seedDb = async (): Promise<Database> =>
  seedImpactDb({ workspaceIds: [workspaceId, otherWorkspaceId], at: OLD });

type SessionSeed = {
  readonly id: string;
  readonly createdAt: number;
  readonly updatedAt?: number;
  readonly workspace?: WorkspaceId;
};

const addSession = async ({
  db,
  seed,
}: {
  readonly db: Database;
  readonly seed: SessionSeed;
}): Promise<void> => {
  await addImpactSession({
    db,
    seed: {
      id: seed.id,
      workspaceId: seed.workspace ?? workspaceId,
      createdAt: seed.createdAt,
      ...(seed.updatedAt === undefined ? {} : { updatedAt: seed.updatedAt }),
    },
  });
};

type AgentSeed = {
  readonly id: string;
  readonly sessionId: string;
  readonly startedAt: number;
  readonly completedAt?: number;
  readonly kind?: string;
  readonly status?: string;
  readonly runId?: string;
  readonly parentId?: string;
};

const addAgent = async ({
  db,
  seed,
}: {
  readonly db: Database;
  readonly seed: AgentSeed;
}): Promise<void> => {
  await db.execute(
    `INSERT INTO agents
       (id, session_id, ordinal, name, status, provider_run_id, started_at, last_finished_at, kind, parent_agent_id)
     VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
    [
      seed.id,
      seed.sessionId,
      seed.id,
      seed.status ?? 'completed',
      seed.runId ?? null,
      seed.startedAt,
      seed.completedAt === undefined ? null : seed.completedAt,
      seed.kind ?? 'implementer',
      seed.parentId ?? null,
    ],
  );
};

const addTelemetry = async ({
  db,
  seed,
}: {
  readonly db: Database;
  readonly seed: ImpactTelemetrySeed;
}): Promise<void> => addImpactTelemetry({ db, seed });

const params = ({
  db,
  sinceMs = null,
}: {
  readonly db: Database;
  readonly sinceMs?: number | null;
}) => ({
  db,
  workspaceId,
  sinceMs,
});

describe('impact overview', () => {
  it('reports orchestration share, trend, median wall-clock, and drill-down sessions', async () => {
    const db = await seedDb();
    await addSession({
      db,
      seed: { id: 'recent', createdAt: RECENT, updatedAt: RECENT + 4 * 3_600_000 },
    });
    await addSession({
      db,
      seed: { id: 'plain', createdAt: RECENT, updatedAt: RECENT + 2 * 3_600_000 },
    });
    await addSession({ db, seed: { id: 'old', createdAt: OLD, updatedAt: OLD + 3_600_000 } });
    await addAgent({ db, seed: { id: 'parent', sessionId: 'recent', startedAt: RECENT } });
    await addAgent({
      db,
      seed: { id: 'child', sessionId: 'recent', startedAt: RECENT, parentId: 'parent' },
    });
    await addTelemetry({
      db,
      seed: { id: 't-recent', runId: 'r-recent', sessionId: 'recent', at: RECENT, cost: 2.5 },
    });
    await addTelemetry({
      db,
      seed: { id: 't-plain', runId: 'r-plain', sessionId: 'plain', at: RECENT, cost: 1.5 },
    });
    await addTelemetry({
      db,
      seed: { id: 't-old', runId: 'r-old', sessionId: 'old', at: OLD, cost: 3 },
    });

    const result = await getImpactOverview(params({ db, sinceMs: SINCE }));

    expect(result.sessionCount).toBe(2);
    expect(result.orchestratedSessions).toBe(1);
    expect(result.previousSessionCount).toBe(1);
    expect(result.medianSessionHours).toBe(2);
    expect(result.sessions[0]?.sessionId).toBe('recent');
    expect(result.spendUsd).toBeCloseTo(4, 4);
    expect(result.spendSessions[0]).toMatchObject({ sessionId: 'recent', value: 2.5 });
  });

  it('compares a short window with the stretch of the same length before it', async () => {
    const db = await seedDb();
    const weekSince = NOW - 7 * DAY_MS;
    await addSession({ db, seed: { id: 'this-week', createdAt: RECENT } });
    await addSession({ db, seed: { id: 'last-week', createdAt: NOW - 10 * DAY_MS } });
    await addSession({ db, seed: { id: 'last-month', createdAt: NOW - 20 * DAY_MS } });

    const result = await getImpactOverview({
      ...params({ db, sinceMs: weekSince }),
      windowMs: 7 * DAY_MS,
    });

    expect(result.sessionCount).toBe(1);
    expect(result.previousSessionCount).toBe(1);
  });

  it('reports spend as absent rather than zero when no telemetry was recorded', async () => {
    const db = await seedDb();
    await addSession({ db, seed: { id: 'untelemetered', createdAt: RECENT } });

    const result = await getImpactOverview(params({ db, sinceMs: SINCE }));

    expect(result.spendUsd).toBeNull();
    expect(result.spendSessions).toEqual([]);
  });

  it('reports spend as absent when every telemetry row priced the work at zero', async () => {
    const db = await seedDb();
    await addSession({ db, seed: { id: 'unpriced', createdAt: RECENT } });
    await addTelemetry({
      db,
      seed: {
        id: 't-unpriced',
        runId: 'r-unpriced',
        sessionId: 'unpriced',
        at: RECENT,
        provider: 'opencode',
        cost: 0,
      },
    });

    const result = await getImpactOverview(params({ db, sinceMs: SINCE }));

    expect(result.spendUsd).toBeNull();
    expect(result.spendSessions).toEqual([]);
  });
});

describe('pull request outcomes', () => {
  it('counts the latest state of each linked pull request in the workspace', async () => {
    const db = await seedDb();
    await addSession({ db, seed: { id: 's1', createdAt: RECENT } });
    await addSession({ db, seed: { id: 's2', createdAt: RECENT, workspace: otherWorkspaceId } });
    await addImpactMount({ db, seed: { id: 'wt1', sessionId: 's1', branch: 'a', at: RECENT } });
    await addImpactMount({ db, seed: { id: 'wt2', sessionId: 's2', branch: 'b', at: RECENT } });
    await addImpactLink({
      db,
      seed: { id: 'l1', mountId: 'wt1', number: 8, state: 'merged', at: RECENT, title: 'ship' },
    });
    await addImpactLink({
      db,
      seed: { id: 'l2', mountId: 'wt1', number: 9, state: 'open', at: RECENT },
    });
    await addImpactLink({
      db,
      seed: { id: 'l3', mountId: 'wt2', number: 10, state: 'open', at: RECENT },
    });
    await addTelemetry({
      db,
      seed: { id: 't-s1', runId: 'r-s1', sessionId: 's1', at: RECENT, cost: 2.5 },
    });

    const result = await getPullRequestOutcomes(params({ db, sinceMs: SINCE }));

    expect(result).toMatchObject({ open: 1, merged: 1, closed: 0 });
    expect(result.entries.find((entry) => entry.number === 8)).toMatchObject({
      sessionId: 's1',
      title: 'ship',
      spendUsd: 2.5,
      isDeleted: false,
    });
  });

  it('counts a pull request once when its link and its merge event both name it', async () => {
    const db = await seedDb();
    await addSession({ db, seed: { id: 's1', createdAt: RECENT } });
    await addImpactMount({ db, seed: { id: 'wt1', sessionId: 's1', branch: 'a', at: RECENT } });
    await addImpactLink({
      db,
      seed: { id: 'l1', mountId: 'wt1', number: 8, state: 'merged', at: RECENT },
    });
    await addImpactEvent({
      db,
      seed: {
        id: 'e-legacy',
        sessionId: 's1',
        kind: 'pr_merged',
        payload: { number: 8, url: 'https://github.com/acme/ledger-core/pull/8' },
        at: RECENT,
      },
    });
    await addImpactEvent({
      db,
      seed: {
        id: 'e-bare',
        sessionId: 's1',
        kind: 'pr_merged',
        payload: { number: 8 },
        at: RECENT,
      },
    });

    const result = await getPullRequestOutcomes(params({ db, sinceMs: SINCE }));

    expect(result.merged).toBe(1);
    expect(result.entries).toHaveLength(1);
  });

  it('keeps two repositories that share a pull request number apart', async () => {
    const db = await seedDb();
    await addSession({ db, seed: { id: 'api', createdAt: RECENT } });
    await addImpactMount({
      db,
      seed: { id: 'wt-api', sessionId: 'api', branch: 'x', repoSlug: 'acme/api', at: RECENT },
    });
    await addImpactMount({
      db,
      seed: { id: 'wt-web', sessionId: 'api', branch: 'x', repoSlug: 'acme/web', at: RECENT },
    });
    await addImpactLink({
      db,
      seed: {
        id: 'l-api',
        mountId: 'wt-api',
        number: 70,
        state: 'merged',
        repoSlug: 'acme/api',
        at: RECENT,
      },
    });
    await addImpactLink({
      db,
      seed: {
        id: 'l-web',
        mountId: 'wt-web',
        number: 70,
        state: 'merged',
        repoSlug: 'acme/web',
        at: RECENT,
      },
    });

    const result = await getPullRequestOutcomes(params({ db, sinceMs: SINCE }));

    expect(result.merged).toBe(2);
  });

  it('does not double-count spend when two mounts of one session link the same pull request', async () => {
    const db = await seedDb();
    await addSession({ db, seed: { id: 'multi', createdAt: RECENT } });
    await addImpactMount({
      db,
      seed: { id: 'wt-a', sessionId: 'multi', branch: 'shared', at: RECENT },
    });
    await addImpactMount({
      db,
      seed: { id: 'wt-b', sessionId: 'multi', branch: 'shared', at: RECENT },
    });
    await addImpactLink({
      db,
      seed: { id: 'l-a', mountId: 'wt-a', number: 21, state: 'merged', at: RECENT },
    });
    await addImpactLink({
      db,
      seed: { id: 'l-b', mountId: 'wt-b', number: 21, state: 'merged', at: RECENT },
    });
    await addTelemetry({
      db,
      seed: { id: 't-multi', runId: 'r-multi', sessionId: 'multi', at: RECENT, cost: 5 },
    });

    const result = await getPullRequestOutcomes(params({ db, sinceMs: SINCE }));

    expect(result.merged).toBe(1);
    expect(result.entries[0]).toMatchObject({ number: 21, spendUsd: 5 });
  });

  it('reports a pull request with no priced telemetry as having no spend', async () => {
    const db = await seedDb();
    await addSession({ db, seed: { id: 'freebie', createdAt: RECENT } });
    await addImpactMount({ db, seed: { id: 'wt', sessionId: 'freebie', branch: 'f', at: RECENT } });
    await addImpactLink({
      db,
      seed: { id: 'l', mountId: 'wt', number: 51, state: 'open', at: RECENT },
    });
    await addTelemetry({
      db,
      seed: {
        id: 't-freebie',
        runId: 'r-freebie',
        sessionId: 'freebie',
        at: RECENT,
        provider: 'opencode',
        cost: 0,
      },
    });

    const result = await getPullRequestOutcomes(params({ db, sinceMs: SINCE }));

    expect(result.entries[0]).toMatchObject({ number: 51, spendUsd: null });
  });

  it('places a merged pull request in the window of its merge, not of its last check', async () => {
    const db = await seedDb();
    await addSession({ db, seed: { id: 's1', createdAt: OLD } });
    await addImpactMount({ db, seed: { id: 'wt', sessionId: 's1', branch: 'b', at: OLD } });
    await addImpactLink({
      db,
      seed: { id: 'l', mountId: 'wt', number: 5, state: 'merged', at: RECENT, mergedAt: OLD },
    });

    const recent = await getPullRequestOutcomes(params({ db, sinceMs: SINCE }));
    const all = await getPullRequestOutcomes(params({ db, sinceMs: null }));

    expect(recent.merged).toBe(0);
    expect(all.merged).toBe(1);
  });

  it('compares merged pull requests with the window before', async () => {
    const db = await seedDb();
    await addSession({ db, seed: { id: 's1', createdAt: OLD } });
    await addImpactEvent({
      db,
      seed: {
        id: 'e-old',
        sessionId: 's1',
        kind: 'pr_merged',
        payload: { host: 'github.com', repository: 'acme/ledger-core', number: 3 },
        at: NOW - 40 * DAY_MS,
      },
    });
    await addImpactEvent({
      db,
      seed: {
        id: 'e-closed',
        sessionId: 's1',
        kind: 'pr_closed',
        payload: { host: 'github.com', repository: 'acme/ledger-core', number: 4 },
        at: RECENT,
      },
    });

    const result = await getPullRequestOutcomes(params({ db, sinceMs: SINCE }));

    expect(result).toMatchObject({ merged: 0, closed: 1, previousMerged: 1 });
  });
});

describe('review outcomes', () => {
  it('measures review throughput, outcomes, duration distribution, and hot files', async () => {
    const db = await seedDb();
    await addSession({ db, seed: { id: 's1', createdAt: RECENT } });
    await db.execute(
      `INSERT INTO diff_comments
         (id, session_id, file_path, body, status, created_at, resolved_at)
       VALUES ('d1', 's1', 'src/hot.ts', 'a', 'resolved', ?, ?),
              ('d2', 's1', 'src/hot.ts', 'b', 'resolved', ?, ?)`,
      [RECENT, RECENT + 3_600_000, RECENT, RECENT + 3 * 3_600_000],
    );
    await db.execute(
      `INSERT INTO diff_comments
         (id, session_id, file_path, body, status, created_at, consumed_at)
       VALUES ('d3', 's1', 'src/cold.ts', 'c', 'consumed', ?, ?)`,
      [RECENT, RECENT + 9 * 3_600_000],
    );
    await db.execute(
      `INSERT INTO pr_review_drafts
         (id, session_id, provider, repo, pr_number, path, line, body, status, created_at)
       VALUES ('draft', 's1', 'github', 'repo', 1, 'a.ts', 1, 'body', 'published', ?)`,
      [RECENT],
    );
    await db.execute(
      `INSERT INTO resolve_threads
         (id, session_id, pr_number, thread_id, origin_kind, state, disposition, created_at, updated_at)
       VALUES ('r1', 's1', 1, 'thread', 'review_comment', 'fixed', 'fix', ?, ?)`,
      [RECENT, RECENT],
    );

    const result = await getReviewOutcomes(params({ db, sinceMs: SINCE }));

    expect(result.commentsResolved).toBe(2);
    expect(result.sentToAgent).toBe(1);
    expect(result.medianResolveHours).toBe(1);
    expect(result.publishedDrafts).toBe(1);
    expect(result.pushedResolutions).toBe(1);
    expect(result.resolutionOutcomes).toEqual([{ outcome: 'resolved', count: 1 }]);
    expect(result.hotFiles[0]).toEqual({ filePath: 'src/hot.ts', comments: 2 });
  });
});

describe('external task outcomes', () => {
  it('separates sessions launched from issues from later links', async () => {
    const db = await seedDb();
    await addSession({ db, seed: { id: 's1', createdAt: RECENT } });
    await addSession({ db, seed: { id: 's2', createdAt: RECENT } });
    await db.execute(
      `INSERT INTO session_external_tasks
         (session_id, provider, external_id, identifier, url, title, created_at)
       VALUES ('s1', 'linear', 'one', 'ENG-1', 'https://one', 'one', ?),
              ('s2', 'linear', 'two', 'ENG-2', 'https://two', 'two', ?)`,
      [RECENT + 30_000, RECENT + 600_000],
    );

    const result = await getExternalTaskOutcomes(params({ db, sinceMs: SINCE }));

    expect(result.linked).toBe(2);
    expect(result.launched).toBe(1);
    expect(result.sessions).toHaveLength(2);
  });
});

describe('agent durations', () => {
  it('calculates median and p90 duration by agent kind', async () => {
    const db = await seedDb();
    await addSession({ db, seed: { id: 's1', createdAt: RECENT } });
    await addAgent({
      db,
      seed: {
        id: 'a1',
        sessionId: 's1',
        startedAt: RECENT,
        completedAt: RECENT + 3_600_000,
        kind: 'scout',
      },
    });
    await addAgent({
      db,
      seed: {
        id: 'a2',
        sessionId: 's1',
        startedAt: RECENT,
        completedAt: RECENT + 4 * 3_600_000,
        kind: 'scout',
      },
    });

    const result = await getAgentDurations(params({ db, sinceMs: SINCE }));

    expect(result.totalAgents).toBe(2);
    expect(result.byKind[0]).toMatchObject({ kind: 'scout', agents: 2 });
    expect(result.byKind[0]?.medianHours).toBeCloseTo(1, 4);
    expect(result.byKind[0]?.p90Hours).toBeCloseTo(4, 4);
  });
});

describe('flow health', () => {
  it('measures session and human wait time plus active blockers', async () => {
    const db = await seedDb();
    await addSession({
      db,
      seed: { id: 's1', createdAt: RECENT, updatedAt: RECENT + 2 * 3_600_000 },
    });
    await addAgent({
      db,
      seed: { id: 'failed', sessionId: 's1', startedAt: RECENT, status: 'failed' },
    });
    await db.execute(
      `INSERT INTO open_questions (id, session_id, text, status, created_at, answered_at)
       VALUES ('q1', 's1', 'answered', 'answered', ?, ?)`,
      [RECENT, RECENT + 3_600_000],
    );
    await db.execute(
      `INSERT INTO open_questions (id, session_id, text, status, created_at)
       VALUES ('q2', 's1', 'open', 'open', ?)`,
      [RECENT],
    );
    await db.execute(
      `INSERT INTO budget_alerts
         (id, kind, session_id, current_usd, cap_usd, created_at)
       VALUES ('b1', 'session-threshold', 's1', 8, 10, ?)`,
      [RECENT],
    );

    const result = await getFlowHealth(params({ db, sinceMs: SINCE }));

    expect(result.medianSessionHours).toBe(2);
    expect(result.medianQuestionHours).toBe(1);
    expect(result.questionBlockedSessions).toBe(1);
    expect(result.failedAgents).toBe(1);
    expect(result.budgetAlerts).toBe(1);
  });
});

describe('cache efficiency', () => {
  it('aggregates cache hits per provider and excludes other workspaces', async () => {
    const db = await seedDb();
    await addSession({ db, seed: { id: 's1', createdAt: RECENT } });
    await addSession({
      db,
      seed: { id: 's2', createdAt: RECENT, workspace: otherWorkspaceId },
    });
    await addTelemetry({
      db,
      seed: { id: 't1', runId: 'r1', sessionId: 's1', at: RECENT, input: 100, cached: 40 },
    });
    await addTelemetry({
      db,
      seed: { id: 't2', runId: 'r2', sessionId: 's2', at: RECENT, input: 100, cached: 100 },
    });

    const result = await getCacheEfficiency(params({ db, sinceMs: SINCE }));

    expect(result).toEqual([
      {
        provider: 'anthropic',
        inputTokens: 100,
        cachedInputTokens: 40,
        cacheCreationInputTokens: 0,
        hitRatio: 0.4,
      },
    ]);
  });
});

describe('context growth', () => {
  it('returns context token points in chronological order', async () => {
    const db = await seedDb();
    await addSession({ db, seed: { id: 's1', createdAt: RECENT } });
    await addTelemetry({
      db,
      seed: { id: 't2', runId: 'r1', sessionId: 's1', at: RECENT + 1, context: 200 },
    });
    await addTelemetry({
      db,
      seed: { id: 't1', runId: 'r1', sessionId: 's1', at: RECENT, context: 100 },
    });

    const result = await getContextGrowth(params({ db, sinceMs: SINCE }));

    expect(result.map((point) => point.contextTokens)).toEqual([100, 200]);
  });
});

describe('turn distribution', () => {
  it('buckets agents by recorded turns', async () => {
    const db = await seedDb();
    await addSession({ db, seed: { id: 's1', createdAt: RECENT } });
    await addAgent({
      db,
      seed: { id: 'a1', sessionId: 's1', startedAt: RECENT, runId: 'r1' },
    });
    await addTelemetry({ db, seed: { id: 't1', runId: 'r1', sessionId: 's1', at: RECENT } });
    await addTelemetry({
      db,
      seed: { id: 't2', runId: 'r1', sessionId: 's1', at: RECENT + 1 },
    });

    const result = await getTurnDistribution(params({ db, sinceMs: SINCE }));

    expect(result).toEqual([{ turnCount: 2, agentCount: 1 }]);
  });
});

describe('right-size nudges', () => {
  it('counts outcomes for sessions in the workspace', async () => {
    const db = await seedDb();
    await addSession({ db, seed: { id: 's1', createdAt: RECENT } });
    await db.execute(
      `INSERT INTO nudge_events (id, session_id, created_at, kind, context_json, outcome, outcome_ts)
       VALUES ('n1', 's1', ?, 'model-rightsize', ?, 'accepted', ?)`,
      [RECENT, JSON.stringify({ sessionId: 's1' }), RECENT],
    );

    const result = await getRightSizeNudgeOutcomes(params({ db, sinceMs: SINCE }));

    expect(result).toEqual([{ outcome: 'accepted', count: 1 }]);
  });
});
