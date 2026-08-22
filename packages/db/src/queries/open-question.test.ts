import { describe, expect, it } from 'vitest';
import type { OpenQuestionId, SessionId, WorkspaceId } from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import {
  insertOpenQuestion,
  listOpenQuestionsForSession,
  markOpenQuestionAnswered,
} from './open-question';

const workspaceId = 'w1' as WorkspaceId;
const sessionId = 's1' as SessionId;

async function seed() {
  const db = makeTestDatabase();
  await migrate(db);
  const now = Date.now();
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [workspaceId, 'ws', '/tmp/ws', now, now],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, workspaceId, 'goal', 'idle', now, now],
  );
  return db;
}

describe('open_questions queries', () => {
  it('turnOrdinal round-trips through insert + list', async () => {
    const db = await seed();
    await insertOpenQuestion(db, {
      id: 'oq1' as OpenQuestionId,
      sessionId,
      text: 'which db?',
      suggestedAnswers: ['sqlite'],
      turnOrdinal: 3,
    });

    const open = await listOpenQuestionsForSession(db, sessionId, 'open');
    expect(open).toHaveLength(1);
    expect(open[0]!.turnOrdinal).toBe(3);
  });

  it('omitted turnOrdinal stores null and reads undefined', async () => {
    const db = await seed();
    await insertOpenQuestion(db, {
      id: 'oq2' as OpenQuestionId,
      sessionId,
      text: 'no ordinal',
      suggestedAnswers: [],
    });

    const open = await listOpenQuestionsForSession(db, sessionId, 'open');
    expect(open[0]!.turnOrdinal).toBeUndefined();
  });

  it('recommendedAnswer round-trips and omitted reads undefined', async () => {
    const db = await seed();
    await insertOpenQuestion(db, {
      id: 'oq_rec' as OpenQuestionId,
      sessionId,
      text: 'with rec',
      suggestedAnswers: ['a', 'b'],
      recommendedAnswer: 'a',
    });
    await insertOpenQuestion(db, {
      id: 'oq_norec' as OpenQuestionId,
      sessionId,
      text: 'no rec',
      suggestedAnswers: [],
    });

    const open = await listOpenQuestionsForSession(db, sessionId, 'open');
    const byId = new Map(open.map((q) => [q.id, q]));
    expect(byId.get('oq_rec' as OpenQuestionId)?.recommendedAnswer).toBe('a');
    expect(byId.get('oq_norec' as OpenQuestionId)?.recommendedAnswer).toBeUndefined();
  });

  it('selectMode round-trips and omitted reads undefined', async () => {
    const db = await seed();
    await insertOpenQuestion(db, {
      id: 'oq_one' as OpenQuestionId,
      sessionId,
      text: 'pick one',
      suggestedAnswers: ['a', 'b'],
      selectMode: 'one',
    });
    await insertOpenQuestion(db, {
      id: 'oq_many' as OpenQuestionId,
      sessionId,
      text: 'pick some',
      suggestedAnswers: ['a', 'b', 'c'],
      selectMode: 'many',
    });
    await insertOpenQuestion(db, {
      id: 'oq_mode_omitted' as OpenQuestionId,
      sessionId,
      text: 'unspecified',
      suggestedAnswers: [],
    });

    const open = await listOpenQuestionsForSession(db, sessionId, 'open');
    const byId = new Map(open.map((q) => [q.id, q]));
    expect(byId.get('oq_one' as OpenQuestionId)?.selectMode).toBe('one');
    expect(byId.get('oq_many' as OpenQuestionId)?.selectMode).toBe('many');
    expect(byId.get('oq_mode_omitted' as OpenQuestionId)?.selectMode).toBeUndefined();
  });

  it('answered list returns rows with turnOrdinal preserved', async () => {
    const db = await seed();
    await insertOpenQuestion(db, {
      id: 'oq3' as OpenQuestionId,
      sessionId,
      text: 'answer me',
      suggestedAnswers: [],
      turnOrdinal: 5,
    });
    await markOpenQuestionAnswered(db, 'oq3' as OpenQuestionId, 'yes');

    const answered = await listOpenQuestionsForSession(db, sessionId, 'answered');
    expect(answered).toHaveLength(1);
    expect(answered[0]!.turnOrdinal).toBe(5);
    expect(answered[0]!.userAnswer).toBe('yes');
  });
});
