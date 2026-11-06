import { describe, expect, it, vi } from 'vitest';
import { insertNudgeEvent, insertOpenQuestion, type Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import { brandId, type IsoDateTime, type OpenQuestionId, type SessionId } from '@goodboy/types';
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
    expect(Object.keys(facts.sessionOpenQuestions)).toHaveLength(SESSION_COUNT);
    expect(facts.sessionOpenQuestions[sessionIdOf(7)]?.map((question) => question.text)).toEqual([
      'Should the retries back off?',
    ]);
    expect(facts.sessionOpenQuestions[sessionIdOf(8)]).toEqual([]);
    expect([...(facts.sessionDismissedNextSteps[sessionIdOf(42)] ?? [])]).toEqual([
      'merge-pr:payments-api:318',
    ]);
    expect(facts.sessionDismissedNextSteps[sessionIdOf(43)]?.size).toBe(0);
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

    expect(Object.keys(facts.autoTreeViews)).toEqual([sessionIdOf(3)]);
    expect(facts.autoTreeViews[sessionIdOf(3)]).toEqual([]);
    expect(selects).toHaveBeenCalledTimes(3);
  });
});
