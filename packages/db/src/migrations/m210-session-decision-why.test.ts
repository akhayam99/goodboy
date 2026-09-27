import { describe, expect, it } from 'vitest';
import type { IsoDateTime, SessionDecision, SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { listSessionDecisions, saveSessionDecisions } from '../queries/session-decision';
import { migrations } from './index';
import { migrate } from './runner';

const SESSION = 'session' as SessionId;
const AT = '2026-09-27T10:00:00.000Z' as IsoDateTime;

const decision = (overrides: Partial<SessionDecision>): SessionDecision => ({
  id: 'd2',
  sessionId: SESSION,
  number: 2,
  text: 'Retry payments-api webhooks with backoff',
  why: 'The provider drops events during deploys',
  status: 'active',
  replacedBy: null,
  author: 'summarizer',
  agentId: null,
  turnOrdinal: null,
  reason: null,
  closedBy: null,
  closedByAgentId: null,
  previousText: null,
  rewordedAt: null,
  createdAt: AT,
  updatedAt: AT,
  ...overrides,
});

describe('m210 session decision why', () => {
  it('keeps old decisions without a why and stores new ones with it', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 209 });
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Checkout', 'idle', 1, 1)",
    );
    await db.execute(
      "INSERT INTO session_decisions (id, session_id, number, text, status, author, created_at, updated_at) VALUES ('d1', 'session', 1, 'Key idempotency on the event id', 'active', 'agent', 1, 1)",
    );

    await migrate(db, migrations);
    await saveSessionDecisions({ db, decisions: [decision({})] });

    const rows = await listSessionDecisions({ db, sessionId: SESSION });
    expect(rows.map((row) => [row.number, row.why])).toEqual([
      [1, null],
      [2, 'The provider drops events during deploys'],
    ]);
  });

  it('updates the why when a decision is saved again', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 209 });
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Checkout', 'idle', 1, 1)",
    );
    await migrate(db, migrations);
    await saveSessionDecisions({ db, decisions: [decision({})] });

    await saveSessionDecisions({ db, decisions: [decision({ why: 'Northwind asked for it' })] });

    const [row] = await listSessionDecisions({ db, sessionId: SESSION });
    expect(row?.why).toBe('Northwind asked for it');
  });
});
