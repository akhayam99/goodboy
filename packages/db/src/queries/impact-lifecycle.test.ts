import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, MountId, SessionId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { runDatabaseHygiene } from '../maintenance/runDatabaseHygiene';
import {
  addImpactLink,
  addImpactMount,
  addImpactSession,
  addImpactTelemetry,
  seedImpactDb,
} from '../test-helpers/impact-seeds';
import {
  getAgentDurations,
  getFlowHealth,
  getImpactOverview,
  getPullRequestOutcomes,
  getReviewOutcomes,
} from './impact';
import { deleteSession, purgeSessionForDelete } from './session';
import { deleteSessionMount } from './session-worktree';
import { disconnectWorkspace } from './workspace';

const WORKSPACE = 'ws-harborline' as WorkspaceId;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const NOW = Date.now();
const LIVE = 's-live' as SessionId;
const GONE = 's-gone' as SessionId;

type WorldParams = {
  readonly db: Database;
};

const seedWorld = async (): Promise<Database> => {
  const db = await seedImpactDb({ workspaceIds: [WORKSPACE], at: NOW - 60 * DAY_MS });
  await addImpactSession({
    db,
    seed: {
      id: LIVE,
      workspaceId: WORKSPACE,
      goal: 'Warn merchants before a payout hold',
      createdAt: NOW - 2 * DAY_MS,
      lastActivityAt: NOW - 2 * DAY_MS + HOUR_MS,
    },
  });
  await addImpactSession({
    db,
    seed: {
      id: GONE,
      workspaceId: WORKSPACE,
      goal: 'Reconcile the ledger export',
      createdAt: NOW - 20 * DAY_MS,
      lastActivityAt: NOW - 20 * DAY_MS + 3 * HOUR_MS,
    },
  });
  await addImpactTelemetry({
    db,
    seed: { id: 't-live', runId: 'r-live', sessionId: LIVE, at: NOW - 2 * DAY_MS, cost: 1.5 },
  });
  await addImpactTelemetry({
    db,
    seed: { id: 't-gone', runId: 'r-gone', sessionId: GONE, at: NOW - 20 * DAY_MS, cost: 6 },
  });
  await addImpactMount({
    db,
    seed: { id: 'm-gone', sessionId: GONE, branch: 'mq/ledger-export', at: NOW - 20 * DAY_MS },
  });
  await addImpactLink({
    db,
    seed: {
      id: 'l-gone',
      mountId: 'm-gone',
      number: 412,
      state: 'merged',
      title: 'Reconcile the ledger export',
      at: NOW - 19 * DAY_MS,
    },
  });
  return db;
};

const allTime = ({ db }: WorldParams) => ({ db, workspaceId: WORKSPACE, sinceMs: null });

const lastWeek = ({ db }: WorldParams) => ({
  db,
  workspaceId: WORKSPACE,
  sinceMs: NOW - 7 * DAY_MS,
  windowMs: 7 * DAY_MS,
});

describe('impact after a session is deleted', () => {
  it('counts the deleted session, its spend and its activity time', async () => {
    const db = await seedWorld();
    await purgeSessionForDelete({ db, id: GONE });

    const overview = await getImpactOverview(allTime({ db }));

    expect(overview.sessionCount).toBe(2);
    expect(overview.deletedSessionCount).toBe(1);
    expect(overview.spendUsd).toBeCloseTo(7.5, 4);
    expect(overview.sessions.find((row) => row.sessionId === GONE)).toMatchObject({
      value: 3,
      isDeleted: true,
    });
  });

  it('leaves a session deleted today in the window of its last activity', async () => {
    const db = await seedWorld();
    await purgeSessionForDelete({ db, id: GONE });

    const week = await getImpactOverview(lastWeek({ db }));

    expect(week.sessionCount).toBe(1);
    expect(week.deletedSessionCount).toBe(0);
    expect(week.spendUsd).toBeCloseTo(1.5, 4);
  });

  it('keeps reviews, answered questions and agent durations of a deleted session', async () => {
    const db = await seedWorld();
    const at = NOW - 20 * DAY_MS;
    await db.execute(
      `INSERT INTO diff_comments (id, session_id, file_path, body, status, created_at, resolved_at)
       VALUES ('c-1', ?, 'src/ledger.ts', 'round once', 'resolved', ?, ?)`,
      [GONE, at, at + HOUR_MS],
    );
    await db.execute(
      `INSERT INTO open_questions (id, session_id, text, status, created_at, answered_at)
       VALUES ('q-1', ?, 'Which cutoff?', 'answered', ?, ?)`,
      [GONE, at, at + 2 * HOUR_MS],
    );
    await db.execute(
      `INSERT INTO agents (id, session_id, ordinal, name, status, started_at, last_finished_at, kind)
       VALUES ('a-1', ?, 0, 'Builder', 'completed', ?, ?, 'implementer')`,
      [GONE, at, at + 4 * HOUR_MS],
    );
    await purgeSessionForDelete({ db, id: GONE });

    const reviews = await getReviewOutcomes(allTime({ db }));
    const flow = await getFlowHealth(allTime({ db }));
    const agents = await getAgentDurations(allTime({ db }));

    expect(reviews.commentsResolved).toBe(1);
    expect(reviews.sessions[0]).toMatchObject({ sessionId: GONE, isDeleted: true });
    expect(flow.answeredQuestions).toBe(1);
    expect(agents.totalAgents).toBe(1);
  });
});

describe('what impact keeps when something goes away', () => {
  it('keeps everything when a session is deleted from Goodboy and the boot cleanup runs', async () => {
    const db = await seedWorld();
    await purgeSessionForDelete({ db, id: GONE });
    await runDatabaseHygiene({ db, now: NOW });

    const prs = await getPullRequestOutcomes(allTime({ db }));
    const overview = await getImpactOverview(allTime({ db }));

    expect(prs.merged).toBe(1);
    expect(prs.entries[0]).toMatchObject({ number: 412, sessionId: GONE, isDeleted: true });
    expect(prs.entries[0]?.spendUsd).toBeCloseTo(6, 4);
    expect(overview.sessionCount).toBe(2);
  });

  it('keeps everything when the worktree disappears from disk outside the app', async () => {
    const db = await seedWorld();
    await db.execute("UPDATE session_worktrees SET disk_state = 'missing' WHERE id = 'm-gone'");

    const prs = await getPullRequestOutcomes(allTime({ db }));
    const overview = await getImpactOverview(allTime({ db }));

    expect(prs.merged).toBe(1);
    expect(overview.sessionCount).toBe(2);
    expect(overview.spendUsd).toBeCloseTo(7.5, 4);
  });

  it('keeps the merged pull request of a detached project through its merge event', async () => {
    const db = await seedWorld();
    await runDatabaseHygiene({ db, now: NOW });
    await deleteSessionMount({ db, sessionId: GONE, mountId: 'm-gone' as MountId });

    const links = await db.select<{ count: number }>(
      'SELECT COUNT(*) AS count FROM mount_pr_links',
    );
    const prs = await getPullRequestOutcomes(allTime({ db }));
    const recent = await getPullRequestOutcomes(lastWeek({ db }));

    expect(links[0]?.count).toBe(0);
    expect(prs.merged).toBe(1);
    expect(prs.entries[0]).toMatchObject({ number: 412, title: 'Reconcile the ledger export' });
    expect(recent.merged).toBe(0);
  });

  it('writes the merge event once, however many boots run the cleanup', async () => {
    const db = await seedWorld();
    const first = await runDatabaseHygiene({ db, now: NOW });
    const second = await runDatabaseHygiene({ db, now: NOW });

    const events = await db.select<{ count: number }>(
      "SELECT COUNT(*) AS count FROM session_events WHERE kind = 'pr_merged'",
    );

    expect(first.mergedPullRequestEventsWritten).toBe(1);
    expect(second.mergedPullRequestEventsWritten).toBe(0);
    expect(events[0]?.count).toBe(1);
  });

  it('keeps everything under a workspace that was removed', async () => {
    const db = await seedWorld();
    await disconnectWorkspace({
      db,
      id: WORKSPACE,
      at: new Date(NOW).toISOString() as IsoDateTime,
    });

    const overview = await getImpactOverview(allTime({ db }));
    const prs = await getPullRequestOutcomes(allTime({ db }));

    expect(overview.sessionCount).toBe(2);
    expect(prs.merged).toBe(1);
  });

  it('changes nothing when the boot cleanup sweeps the pull request cache', async () => {
    const db = await seedWorld();
    await db.execute(
      `INSERT INTO github_pr_cache (branch, repo_slug, pr_json, fetched_at)
       VALUES ('mq/ledger-export', 'acme/ledger-core', ?, ?)`,
      [JSON.stringify({ number: 412, state: 'merged' }), NOW],
    );
    await purgeSessionForDelete({ db, id: GONE });
    const before = await getPullRequestOutcomes(allTime({ db }));

    const hygiene = await runDatabaseHygiene({ db, now: NOW });
    const after = await getPullRequestOutcomes(allTime({ db }));

    expect(hygiene.githubPrCacheRowsDeleted).toBe(1);
    expect(after).toEqual(before);
  });

  it('keeps nothing of a draft that was deleted for real', async () => {
    const db = await seedWorld();
    await deleteSession(db, LIVE);

    const overview = await getImpactOverview(allTime({ db }));

    expect(overview.sessionCount).toBe(1);
    expect(overview.deletedSessionCount).toBe(0);
  });
});

describe('impact queries', () => {
  it('never hide deleted sessions again', () => {
    const sources = ['./impact.ts', './impact-pull-requests.ts'].map((path) =>
      readFileSync(new URL(path, import.meta.url), 'utf8'),
    );

    expect(sources.filter((source) => /s\.deleted_at IS NULL/.test(source))).toEqual([]);
  });
});
