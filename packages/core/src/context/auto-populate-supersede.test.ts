import { describe, expect, it } from 'vitest';
import { type Database as DbInterface } from '@goodboy/db';
import { migrate } from '@goodboy/db/migrations';
import { makeTestDatabase } from '@goodboy/db/test-helpers';
import {
  brandId,
  type AgentId,
  type OpenQuestionStatus,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { autoPopulateContext } from './auto-populate';
import { ContextEngine } from './engine';

type QuestionRow = {
  readonly text: string;
  readonly status: OpenQuestionStatus;
  readonly user_answer: string | null;
  readonly answer_delivered_at: number | null;
};

const sessionId = brandId<SessionId>({ value: 'session-harborline' });
const agentId = brandId<AgentId>({ value: 'agent-implementer' });

const seed = async (): Promise<DbInterface> => {
  const db = makeTestDatabase();
  await migrate(db);
  const workspaceId = brandId<WorkspaceId>({ value: 'workspace-harborline' });
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'Harborline', workspaceId, 0, 0],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, last_activity_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, workspaceId, 'ledger-core export', 'idle', 0, 0, 0],
  );
  await db.execute(
    'INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, ?, ?, ?)',
    [agentId, sessionId, 0, 'Implementer', 'running'],
  );
  return db;
};

type AskParams = {
  readonly db: DbInterface;
  readonly turnOrdinal: number;
  readonly assistantText: string;
};

const ask = ({ db, turnOrdinal, assistantText }: AskParams) =>
  autoPopulateContext({
    db,
    sessionId,
    filesEdited: [],
    assistantText,
    agentContext: { agentId, turnOrdinal },
  });

const rowsOf = ({ db }: { readonly db: DbInterface }) =>
  db.select<QuestionRow>(
    'SELECT text, status, user_answer, answer_delivered_at FROM open_questions WHERE session_id = ? ORDER BY created_at, rowid',
    [sessionId],
  );

const BLOCKING_FIRST =
  '<<ctx-question blocking="true" suggestions="Skip them|Include them" recommended="Skip them" select="one">>Should the export skip deliveries older than seven days?<</ctx-question>>';
const BLOCKING_AGAIN =
  '<<ctx-question blocking="true" suggestions="Skip them|Include them" recommended="Skip them" select="one">>Skip deliveries older than seven days in the export?<</ctx-question>>';
const BLOCKING_AGAIN_ONCE_MORE =
  '<<ctx-question blocking="true" suggestions="Skip them|Include them" recommended="Skip them" select="one">>Do you want old deliveries left out of the export?<</ctx-question>>';

describe('an agent that asks its blocking question again in a later turn', () => {
  it('leaves one open question and settles the earlier ones as resolved', async () => {
    const db = await seed();
    await ask({ db, turnOrdinal: 1, assistantText: BLOCKING_FIRST });
    await ask({ db, turnOrdinal: 2, assistantText: BLOCKING_AGAIN });

    const result = await ask({ db, turnOrdinal: 3, assistantText: BLOCKING_AGAIN_ONCE_MORE });

    const rows = await rowsOf({ db });
    expect(rows.filter((row) => row.status === 'open').map((row) => row.text)).toEqual([
      'Do you want old deliveries left out of the export?',
    ]);
    const settled = rows.filter((row) => row.status === 'answered');
    expect(settled).toHaveLength(2);
    expect(settled.every((row) => row.user_answer === '[resolved by agent]')).toBe(true);
    expect(settled.every((row) => row.answer_delivered_at !== null)).toBe(true);
    expect(result.supersededQuestionIds).toHaveLength(1);
    expect(result.openQuestionsChanged).toBe(true);
  });

  it('keeps only the latest wording in the open_questions slot', async () => {
    const db = await seed();
    await ask({ db, turnOrdinal: 1, assistantText: BLOCKING_FIRST });
    await ask({ db, turnOrdinal: 2, assistantText: BLOCKING_AGAIN_ONCE_MORE });

    const slots = await new ContextEngine({ db }).load(sessionId);
    expect(slots.find((slot) => slot.key === 'open_questions')?.value).toBe(
      'Do you want old deliveries left out of the export?',
    );
  });

  it('keeps both questions when the agent asks two different ones in the same turn', async () => {
    const db = await seed();
    await ask({ db, turnOrdinal: 1, assistantText: BLOCKING_FIRST });

    const result = await ask({
      db,
      turnOrdinal: 2,
      assistantText: `${BLOCKING_AGAIN}<<ctx-question blocking="true">>Which Northwind account owns the retries?<</ctx-question>>`,
    });

    const open = (await rowsOf({ db })).filter((row) => row.status === 'open');
    expect(open.map((row) => row.text)).toEqual([
      'Skip deliveries older than seven days in the export?',
      'Which Northwind account owns the retries?',
    ]);
    expect(result.supersededQuestionIds).toHaveLength(1);
  });

  it('leaves a question that does not block alone', async () => {
    const db = await seed();
    await ask({
      db,
      turnOrdinal: 1,
      assistantText: '<<ctx-question>>Should the notes mention notify-relay?<</ctx-question>>',
    });

    const result = await ask({ db, turnOrdinal: 2, assistantText: BLOCKING_FIRST });

    const open = (await rowsOf({ db })).filter((row) => row.status === 'open');
    expect(open).toHaveLength(2);
    expect(result.supersededQuestionIds).toEqual([]);
  });
});
