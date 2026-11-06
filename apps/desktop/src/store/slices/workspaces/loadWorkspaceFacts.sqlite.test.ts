import { describe, expect, it, vi } from 'vitest';
import { insertNudgeEvent, insertOpenQuestion, type AutoPhase, type Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type OpenQuestionId,
  type SessionId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { loadWorkspaceFacts } from './loadWorkspaceFacts';

const SESSION_COUNT = 200;
const AT = new Date(Date.UTC(2026, 10, 5, 9, 0)).toISOString();

const sessionIdOf = (index: number): SessionId =>
  brandId<SessionId>({ value: `session-harborline-${index}` });

const SESSION_IDS = Array.from({ length: SESSION_COUNT }, (_, index) => sessionIdOf(index));

const seeded = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('workspace-harborline', 'Harborline', 'harborline', 1, 1)`,
  );
  for (const sessionId of SESSION_IDS) {
    await db.execute(
      `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
       VALUES (?, 'workspace-harborline', 'Retry-safe credits in payments-api', 'idle', 1, 1)`,
      [sessionId],
    );
  }
  await insertOpenQuestion(db, {
    id: brandId<OpenQuestionId>({ value: 'question-backoff' }),
    sessionId: sessionIdOf(7),
    text: 'Should the retries back off?',
    suggestedAnswers: [],
  });
  await insertNudgeEvent(db, {
    id: 'nudge-not-now',
    sessionId: sessionIdOf(42),
    ts: brandId<IsoDateTime>({ value: AT }),
    kind: 'next:merge-pr',
    contextJson: JSON.stringify({ fingerprint: 'merge-pr:payments-api:318' }),
    outcome: 'dismissed',
    outcomeTs: brandId<IsoDateTime>({ value: AT }),
  });
  return db;
};

type AutoRuns = Readonly<Record<string, ReadonlyArray<Agent>>>;

type SessionsParams = {
  readonly sessionIds: ReadonlyArray<SessionId>;
};

const rootIdOf = (sessionId: SessionId): AgentId =>
  brandId<AgentId>({ value: `agent-auto-${sessionId}` });

const treeIdOf = (sessionId: SessionId): string => `tree-${sessionId}`;

const autoRunsOf = ({ sessionIds }: SessionsParams): AutoRuns =>
  Object.fromEntries(
    sessionIds.map((sessionId) => [
      sessionId,
      [anAgent({ id: rootIdOf(sessionId), sessionId, kind: 'auto', status: 'completed' })],
    ]),
  );

type SeedTreeParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly phase: AutoPhase;
};

const seedTree = async ({ db, sessionId, phase }: SeedTreeParams): Promise<void> => {
  await db.execute(
    `INSERT INTO agents (id, session_id, ordinal, name, status, kind)
     VALUES (?, ?, 0, 'auto', 'completed', 'auto')`,
    [rootIdOf(sessionId), sessionId],
  );
  await db.execute(
    `INSERT INTO auto_trees (id, root_agent_id, session_id, phase, created_at, updated_at,
       hard_deadline_at)
     VALUES (?, ?, ?, ?, 1, 1, 1)`,
    [treeIdOf(sessionId), rootIdOf(sessionId), sessionId, phase],
  );
};

describe('loadWorkspaceFacts', () => {
  it('reads every session of a 200 session workspace in one query per kind of fact', async () => {
    const db = await seeded();
    const selects = vi.spyOn(db, 'select');

    const facts = await loadWorkspaceFacts({
      db,
      sessionIds: SESSION_IDS,
      sessionPhaseRuns: {},
      kindOverride: {},
    });

    expect(selects).toHaveBeenCalledTimes(2);
    expect(Object.keys(facts.sessionOpenQuestions ?? {})).toHaveLength(SESSION_COUNT);
    expect(facts.sessionOpenQuestions?.[sessionIdOf(7)]?.map((question) => question.text)).toEqual([
      'Should the retries back off?',
    ]);
    expect(facts.sessionOpenQuestions?.[sessionIdOf(8)]).toEqual([]);
    expect([...(facts.sessionDismissedNextSteps?.[sessionIdOf(42)] ?? [])]).toEqual([
      'merge-pr:payments-api:318',
    ]);
    expect(facts.sessionDismissedNextSteps?.[sessionIdOf(43)]?.size).toBe(0);
    expect(facts.autoTreeViews).toEqual({});
  });

  it('reads the Auto trees only of the sessions that hold an Auto agent', async () => {
    const db = await seeded();
    const selects = vi.spyOn(db, 'select');
    const auto = anAgent({ sessionId: sessionIdOf(3), kind: 'auto' });

    const facts = await loadWorkspaceFacts({
      db,
      sessionIds: SESSION_IDS,
      sessionPhaseRuns: { [sessionIdOf(3)]: [auto] },
      kindOverride: {},
    });

    expect(facts.autoTreeViews).toEqual({});
    expect(facts.error).toBeNull();
    expect(selects).toHaveBeenCalledTimes(3);
  });

  it('reads full views only of the trees that move, and nothing more for 150 at rest', async () => {
    const db = await seeded();
    const moving = [0, 1].map((index) => sessionIdOf(index));
    const resting = Array.from({ length: 150 }, (_, index) => sessionIdOf(index + 10));
    for (const sessionId of moving) {
      await seedTree({ db, sessionId, phase: 'delegating' });
    }
    const movingOnly = autoRunsOf({ sessionIds: moving });
    const countSelects = async (runs: AutoRuns): Promise<number> => {
      const selects = vi.spyOn(db, 'select');
      await loadWorkspaceFacts({
        db,
        sessionIds: SESSION_IDS,
        sessionPhaseRuns: runs,
        kindOverride: {},
      });
      const count = selects.mock.calls.length;
      selects.mockRestore();
      return count;
    };
    const withoutResting = await countSelects(movingOnly);
    for (const [index, sessionId] of resting.entries()) {
      await seedTree({ db, sessionId, phase: index % 2 === 0 ? 'answering' : 'finished' });
    }
    const selects = vi.spyOn(db, 'select');

    const facts = await loadWorkspaceFacts({
      db,
      sessionIds: SESSION_IDS,
      sessionPhaseRuns: autoRunsOf({ sessionIds: [...moving, ...resting] }),
      kindOverride: {},
    });

    expect(selects).toHaveBeenCalledTimes(withoutResting);
    expect(Object.keys(facts.autoTreeViews ?? {}).sort()).toEqual([...moving].sort());
    expect(facts.autoTreeViews?.[sessionIdOf(0)]?.map((view) => view.tree.phase)).toEqual([
      'delegating',
    ]);
    expect(facts.error).toBeNull();
  });

  it('keeps the questions, the Not now and the other trees when one tree cannot be read', async () => {
    const db = await seeded();
    const broken = sessionIdOf(0);
    const healthy = sessionIdOf(1);
    await seedTree({ db, sessionId: broken, phase: 'delegating' });
    await seedTree({ db, sessionId: healthy, phase: 'blocked' });
    const select = db.select.bind(db);
    vi.spyOn(db, 'select').mockImplementation(async (sql, params) => {
      if (sql.includes('auto_delegations') && params?.includes(treeIdOf(broken)) === true) {
        throw new Error('malformed delegation row');
      }
      return select(sql, params);
    });

    const facts = await loadWorkspaceFacts({
      db,
      sessionIds: SESSION_IDS,
      sessionPhaseRuns: autoRunsOf({ sessionIds: [broken, healthy] }),
      kindOverride: {},
    });

    expect(facts.error).toBe('malformed delegation row');
    expect(facts.sessionOpenQuestions?.[sessionIdOf(7)]).toHaveLength(1);
    expect([...(facts.sessionDismissedNextSteps?.[sessionIdOf(42)] ?? [])]).toEqual([
      'merge-pr:payments-api:318',
    ]);
    expect(Object.keys(facts.autoTreeViews ?? {})).toEqual([healthy]);
  });

  it('keeps the Auto trees when the questions cannot be read', async () => {
    const db = await seeded();
    await seedTree({ db, sessionId: sessionIdOf(0), phase: 'blocked' });
    const select = db.select.bind(db);
    vi.spyOn(db, 'select').mockImplementation(async (sql, params) => {
      if (sql.includes('FROM open_questions')) {
        throw new Error('database is locked');
      }
      return select(sql, params);
    });

    const facts = await loadWorkspaceFacts({
      db,
      sessionIds: SESSION_IDS,
      sessionPhaseRuns: autoRunsOf({ sessionIds: [sessionIdOf(0)] }),
      kindOverride: {},
    });

    expect(facts.error).toBe('database is locked');
    expect(facts.sessionOpenQuestions).toBeNull();
    expect(facts.sessionDismissedNextSteps?.[sessionIdOf(42)]?.size).toBe(1);
    expect(Object.keys(facts.autoTreeViews ?? {})).toEqual([sessionIdOf(0)]);
  });
});
