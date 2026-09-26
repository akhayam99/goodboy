import { describe, expect, it } from 'vitest';
import type { AgentId, IsoDateTime, SessionDecision, SessionId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { listSessionDecisions, saveSessionDecisions } from '../queries/session-decision';
import { purgeSessionForDelete } from '../queries/session';
import { migrations } from './index';
import { migrate } from './runner';

const SESSION = 'session' as SessionId;
const AT = '2026-09-26T10:00:00.000Z' as IsoDateTime;

const seedBefore = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 196 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Checkout', 'idle', 1, 1)",
  );
  return db;
};

const decision = (overrides: Partial<SessionDecision>): SessionDecision => ({
  id: 'd1',
  sessionId: SESSION,
  number: 1,
  text: 'Key idempotency on the provider event id',
  status: 'active',
  replacedBy: null,
  author: 'agent',
  agentId: 'agent-1' as AgentId,
  turnOrdinal: 3,
  reason: null,
  closedBy: null,
  closedByAgentId: null,
  previousText: null,
  rewordedAt: null,
  createdAt: AT,
  updatedAt: AT,
  ...overrides,
});

describe('m197 session decisions', () => {
  it('starts every session with an empty ledger', async () => {
    const db = await seedBefore();

    await migrate(db, migrations);

    expect(await listSessionDecisions({ db, sessionId: SESSION })).toEqual([]);
  });

  it('keeps a decision and its later replacement', async () => {
    const db = await seedBefore();
    await migrate(db, migrations);

    await saveSessionDecisions({ db, decisions: [decision({})] });
    await saveSessionDecisions({
      db,
      decisions: [
        decision({ status: 'replaced', replacedBy: 2, reason: 'The payload changes' }),
        decision({ id: 'd2', number: 2, text: 'Key on the event id and provider' }),
      ],
    });

    const rows = await listSessionDecisions({ db, sessionId: SESSION });
    expect(rows.map((row) => [row.number, row.status, row.replacedBy, row.reason])).toEqual([
      [1, 'replaced', 2, 'The payload changes'],
      [2, 'active', null, null],
    ]);
    expect(rows[0]?.agentId).toBe('agent-1');
    expect(rows[0]?.createdAt).toBe(AT);
  });

  it('refuses two decisions with the same number in one session', async () => {
    const db = await seedBefore();
    await migrate(db, migrations);
    await saveSessionDecisions({ db, decisions: [decision({})] });

    await expect(
      db.execute(
        "INSERT INTO session_decisions (id, session_id, number, text, status, author, created_at, updated_at) VALUES ('d9', 'session', 1, 'x', 'active', 'user', 1, 1)",
      ),
    ).rejects.toThrow();
  });

  it('drops the ledger when the session is purged', async () => {
    const db = await seedBefore();
    await migrate(db, migrations);
    await saveSessionDecisions({ db, decisions: [decision({})] });

    await purgeSessionForDelete({ db, id: SESSION });

    expect(await listSessionDecisions({ db, sessionId: SESSION })).toEqual([]);
  });
});
