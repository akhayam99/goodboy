import { describe, expect, it } from 'vitest';
import type { AgentId, IsoDateTime } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  listAgentQueuedMessages,
  replaceAgentQueuedMessages,
  saveAgentQueuedMessages,
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

  it('keeps a hold and the written texts beside the override, and reads them back apart', async () => {
    const db = await seed();

    await replaceAgentQueuedMessages(db, {
      agentId: AGENT,
      messages: [
        message('held', {
          override: { providerId: 'codex', model: 'gpt-5.6-sol' },
          holdReason: 'The agent did not start. Your message is safe here.',
          writtenTexts: 1,
        }),
        message('plain'),
      ],
    });

    const [held, plain] = await listAgentQueuedMessages(db, [AGENT]);
    expect(held?.override).toEqual({ providerId: 'codex', model: 'gpt-5.6-sol' });
    expect(held?.holdReason).toBe('The agent did not start. Your message is safe here.');
    expect(held?.writtenTexts).toBe(1);
    expect(plain?.override).toBeNull();
    expect(plain?.holdReason).toBeNull();
    expect(plain?.writtenTexts).toBe(0);
  });

  it('reads a hold without an override as no override', async () => {
    const db = await seed();

    await replaceAgentQueuedMessages(db, {
      agentId: AGENT,
      messages: [message('held', { holdReason: 'Over the limit', writtenTexts: 0 })],
    });

    const [held] = await listAgentQueuedMessages(db, [AGENT]);
    expect(held?.override).toBeNull();
    expect(held?.holdReason).toBe('Over the limit');
  });

  it('saves by message id, so two windows writing one agent keep both messages', async () => {
    const db = await seed();

    await saveAgentQueuedMessages({
      db,
      agentId: AGENT,
      messages: [message('a')],
      removedIds: [],
    });
    await saveAgentQueuedMessages({
      db,
      agentId: AGENT,
      messages: [message('b')],
      removedIds: [],
    });

    expect((await listAgentQueuedMessages(db, [AGENT])).map((entry) => entry.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('deletes only the ids the window removed and updates a message in place', async () => {
    const db = await seed();
    await saveAgentQueuedMessages({
      db,
      agentId: AGENT,
      messages: [message('a'), message('b')],
      removedIds: [],
    });

    await saveAgentQueuedMessages({
      db,
      agentId: AGENT,
      messages: [message('b', { content: 'edited' })],
      removedIds: ['a'],
    });

    const read = await listAgentQueuedMessages(db, [AGENT]);
    expect(read.map((entry) => [entry.id, entry.content])).toEqual([['b', 'edited']]);
  });

  it('never moves a message of another agent that shares the id', async () => {
    const db = await seed();
    await saveAgentQueuedMessages({
      db,
      agentId: OTHER,
      messages: [message('x', { agentId: OTHER })],
      removedIds: [],
    });

    await saveAgentQueuedMessages({
      db,
      agentId: AGENT,
      messages: [message('x', { content: 'stolen' })],
      removedIds: ['x'],
    });

    const read = await listAgentQueuedMessages(db, [AGENT, OTHER]);
    expect(read.map((entry) => [entry.agentId, entry.content])).toEqual([[OTHER, 'message x']]);
  });

  it('keeps the comment thread a message carries and reads it back', async () => {
    const db = await seed();

    await saveAgentQueuedMessages({
      db,
      agentId: AGENT,
      messages: [message('sent', { sourceThreadId: 'thread-79' }), message('plain')],
      removedIds: [],
    });

    const [sent, plain] = await listAgentQueuedMessages(db, [AGENT]);
    expect(sent?.sourceThreadId).toBe('thread-79');
    expect(sent?.override).toBeNull();
    expect(plain?.sourceThreadId).toBeNull();
  });

  it('reads nothing for no agents', async () => {
    const db = await seed();

    expect(await listAgentQueuedMessages(db, [])).toEqual([]);
  });
});
