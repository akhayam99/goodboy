import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate, type Database as DbInterface } from '@goodboy/db';
import type {
  AgentId,
  OpenQuestionStatus,
  SessionId,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { autoPopulateContext } from './auto-populate';
import { ContextEngine } from './engine';

interface OpenQuestionRowSnapshot {
  readonly text: string;
  readonly status: OpenQuestionStatus;
  readonly suggested_answers: string;
  readonly user_answer: string | null;
}

interface OpenQuestionProvenanceRow {
  readonly workflow_id: string | null;
  readonly created_by_step_ordinal: number | null;
  readonly owned_by_step_ordinal: number | null;
  readonly created_by_agent_id: string | null;
}

function makeDb(): DbInterface {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return {
    async exec(sql) {
      db.exec(sql);
    },
    async execute(sql, params = []) {
      const stmt = db.prepare(sql);
      const result = stmt.run(...(params as ReadonlyArray<never>));
      return { rowsAffected: result.changes };
    },
    async select<T>(sql: string, params: ReadonlyArray<unknown> = []) {
      const stmt = db.prepare(sql);
      return stmt.all(...(params as ReadonlyArray<never>)) as unknown as ReadonlyArray<T>;
    },
  };
}

async function seedSession(db: DbInterface, sessionId: SessionId): Promise<void> {
  const workspaceId = 'ws_ap' as WorkspaceId;
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'demo', '/tmp/demo', 0, 0],
  );
  await db.execute(
    `INSERT INTO sessions
       (id, workspace_id, goal, state_kind, state_payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, workspaceId, 'demo', 'idle', '{"lastActivityAt":"2026-05-07T00:00:00Z"}', 0, 0],
  );
}

async function seedAgent(db: DbInterface, agentId: AgentId, sessionId: SessionId): Promise<void> {
  await db.execute(
    `INSERT INTO agents (id, session_id, ordinal, name, status)
     VALUES (?, ?, ?, ?, ?)`,
    [agentId, sessionId, 0, 'scout', 'completed'],
  );
}

describe('autoPopulateContext', () => {
  it('persists files_touched + decisions + open_questions in one pass', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'task_ap_1' as SessionId;
    await seedSession(db, sessionId);

    const result = await autoPopulateContext({
      db,
      sessionId,
      filesEdited: ['src/auth.ts', 'src/db.ts'],
      assistantText: `
        scoped out the auth domain.
        <<ctx-decision>>switching to OAuth2 PKCE<</ctx-decision>>
        <<ctx-question>>do we still support legacy session cookies?<</ctx-question>>
      `,
    });

    expect(result.updatedSlots).toEqual(['files_touched', 'decisions', 'open_questions']);

    const engine = new ContextEngine({ db });
    const slots = await engine.load(sessionId);
    expect(slots.find((s) => s.key === 'files_touched')?.value).toBe('src/auth.ts\nsrc/db.ts');
    expect(slots.find((s) => s.key === 'decisions')?.value).toBe('switching to OAuth2 PKCE');
    expect(slots.find((s) => s.key === 'open_questions')?.value).toBe(
      'do we still support legacy session cookies?',
    );
  });

  it('merges into existing slots without duplicating', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'task_ap_2' as SessionId;
    await seedSession(db, sessionId);
    const engine = new ContextEngine({ db });
    await engine.upsert(sessionId, 'files_touched', 'src/auth.ts');

    await autoPopulateContext({
      db,
      sessionId,
      filesEdited: ['src/auth.ts', 'src/oauth.ts'],
      assistantText: '',
    });

    const slots = await engine.load(sessionId);
    expect(slots.find((s) => s.key === 'files_touched')?.value).toBe('src/auth.ts\nsrc/oauth.ts');
  });

  it('reports empty updatedSlots when nothing changes', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'task_ap_3' as SessionId;
    await seedSession(db, sessionId);

    const result = await autoPopulateContext({
      db,
      sessionId,
      filesEdited: [],
      assistantText: 'just plain prose, no markers',
    });

    expect(result.updatedSlots).toEqual([]);
  });

  it('persists open questions to the open_questions table with suggestions', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'task_ap_q1' as SessionId;
    await seedSession(db, sessionId);

    const result = await autoPopulateContext({
      db,
      sessionId,
      filesEdited: [],
      assistantText: '<<ctx-question suggestions="a | b">>foo<</ctx-question>>',
    });

    expect(result.openQuestionsChanged).toBe(true);

    const rows = await db.select<OpenQuestionRowSnapshot>(
      'SELECT text, status, suggested_answers, user_answer FROM open_questions WHERE session_id = ?',
      [sessionId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe('foo');
    expect(rows[0]?.status).toBe('open');
    expect(JSON.parse(rows[0]?.suggested_answers ?? '[]')).toEqual(['a', 'b']);
  });

  it('dedups identical open questions across turns', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'task_ap_q2' as SessionId;
    await seedSession(db, sessionId);

    await autoPopulateContext({
      db,
      sessionId,
      filesEdited: [],
      assistantText: '<<ctx-question>>foo<</ctx-question>>',
    });
    const second = await autoPopulateContext({
      db,
      sessionId,
      filesEdited: [],
      assistantText: '<<ctx-question>>foo<</ctx-question>>',
    });

    expect(second.openQuestionsChanged).toBe(false);

    const rows = await db.select<OpenQuestionRowSnapshot>(
      `SELECT text, status, suggested_answers, user_answer FROM open_questions
       WHERE session_id = ? AND status = 'open'`,
      [sessionId],
    );
    expect(rows).toHaveLength(1);
  });

  it('marks open questions answered when a resolved marker is emitted', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'task_ap_q3' as SessionId;
    await seedSession(db, sessionId);

    await autoPopulateContext({
      db,
      sessionId,
      filesEdited: [],
      assistantText: '<<ctx-question>>foo<</ctx-question>>',
    });
    const resolved = await autoPopulateContext({
      db,
      sessionId,
      filesEdited: [],
      assistantText: '<<ctx-resolved>>foo<</ctx-resolved>>',
    });

    expect(resolved.openQuestionsChanged).toBe(true);

    const rows = await db.select<OpenQuestionRowSnapshot>(
      'SELECT text, status, suggested_answers, user_answer FROM open_questions WHERE session_id = ?',
      [sessionId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('answered');
    expect(rows[0]?.user_answer).toBe('[resolved by agent]');
  });

  it('stamps open question with agentContext (workflow + step + creator)', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'task_ap_prov_1' as SessionId;
    await seedSession(db, sessionId);
    const agentId = 'agent_scout_1' as AgentId;
    const workflowId = 'wf_demo' as WorkflowId;
    await seedAgent(db, agentId, sessionId);

    await autoPopulateContext({
      db,
      sessionId,
      filesEdited: [],
      assistantText: '<<ctx-question>>do we need refresh tokens?<</ctx-question>>',
      agentContext: { agentId, workflowId, stepOrdinal: 1 },
    });

    const rows = await db.select<OpenQuestionProvenanceRow>(
      `SELECT workflow_id, created_by_step_ordinal, owned_by_step_ordinal, created_by_agent_id
         FROM open_questions WHERE session_id = ?`,
      [sessionId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.workflow_id).toBe(workflowId);
    expect(rows[0]?.created_by_step_ordinal).toBe(1);
    expect(rows[0]?.owned_by_step_ordinal).toBe(1);
    expect(rows[0]?.created_by_agent_id).toBe(agentId);
  });

  it('leaves provenance null when no agentContext is supplied', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'task_ap_prov_2' as SessionId;
    await seedSession(db, sessionId);

    await autoPopulateContext({
      db,
      sessionId,
      filesEdited: [],
      assistantText: '<<ctx-question>>orphan question<</ctx-question>>',
    });

    const rows = await db.select<OpenQuestionProvenanceRow>(
      `SELECT workflow_id, created_by_step_ordinal, owned_by_step_ordinal, created_by_agent_id
         FROM open_questions WHERE session_id = ?`,
      [sessionId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.workflow_id).toBeNull();
    expect(rows[0]?.created_by_step_ordinal).toBeNull();
    expect(rows[0]?.owned_by_step_ordinal).toBeNull();
    expect(rows[0]?.created_by_agent_id).toBeNull();
  });

  it('skips slots whose additions are all duplicates', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'task_ap_4' as SessionId;
    await seedSession(db, sessionId);
    const engine = new ContextEngine({ db });
    await engine.upsert(sessionId, 'decisions', 'use sqlite');

    const result = await autoPopulateContext({
      db,
      sessionId,
      filesEdited: [],
      assistantText: '<<ctx-decision>>use sqlite<</ctx-decision>>',
    });

    expect(result.updatedSlots).toEqual([]);
  });

  it('does not resurrect a question the user already answered', async () => {
    const db = makeDb();
    await migrate(db);
    const sessionId = 'task_ap_5' as SessionId;
    await seedSession(db, sessionId);
    const assistantText = '<<ctx-question>>do we need refresh tokens?<</ctx-question>>';

    await autoPopulateContext({ db, sessionId, filesEdited: [], assistantText });
    await db.execute(`UPDATE open_questions SET status = 'answered' WHERE session_id = ?`, [
      sessionId,
    ]);

    const result = await autoPopulateContext({ db, sessionId, filesEdited: [], assistantText });

    expect(result.openQuestionsChanged).toBe(false);
    const openRows = await db.select<{ c: number }>(
      `SELECT COUNT(*) AS c FROM open_questions WHERE session_id = ? AND status = 'open'`,
      [sessionId],
    );
    expect(openRows[0]?.c).toBe(0);
  });
});
