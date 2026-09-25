import { describe, expect, it } from 'vitest';
import type { AgentId, IsoDateTime } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  listAgentQueuedMessages,
  replaceAgentQueuedMessages,
  type AgentQueuedMessageRecord,
} from './agent-queued-message';

const AGENT = 'agent' as AgentId;
const OTHER = 'other' as AgentId;

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent', 'session', 0, 'Scout', 'running'), ('other', 'session', 1, 'Review', 'running')",
  );
  return db;
};

const message = (
  id: string,
  overrides: Partial<AgentQueuedMessageRecord> = {},
): AgentQueuedMessageRecord => ({
  id,
  agentId: AGENT,
  content: `message ${id}`,
  attachments: [],
  override: null,
  createdAt: '2026-09-25T10:00:00.000Z' as IsoDateTime,
  ...overrides,
});

describe('agent queued messages', () => {
  it('keeps the order it was given and reads it back', async () => {
    const db = await seed();

    await replaceAgentQueuedMessages(db, {
      agentId: AGENT,
      messages: [
        message('b'),
        message('a', { override: { providerId: 'codex', model: 'gpt-5.6-sol' } }),
      ],
    });

    const read = await listAgentQueuedMessages(db, [AGENT]);
    expect(read.map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(read[1]?.override).toEqual({ providerId: 'codex', model: 'gpt-5.6-sol' });
  });

  it('replaces only the given agent queue', async () => {
    const db = await seed();
    await replaceAgentQueuedMessages(db, { agentId: AGENT, messages: [message('a')] });
    await replaceAgentQueuedMessages(db, {
      agentId: OTHER,
      messages: [message('x', { agentId: OTHER })],
    });

    await replaceAgentQueuedMessages(db, { agentId: AGENT, messages: [] });

    expect((await listAgentQueuedMessages(db, [AGENT, OTHER])).map((entry) => entry.id)).toEqual([
      'x',
    ]);
  });

  it('reads nothing for no agents', async () => {
    const db = await seed();

    expect(await listAgentQueuedMessages(db, [])).toEqual([]);
  });
});
