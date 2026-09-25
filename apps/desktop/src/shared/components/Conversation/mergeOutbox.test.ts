import { describe, expect, it } from 'vitest';
import { fixtureMessage, fixtureThread } from './conversationFixtures';
import { mergeOutbox, type OutboxEntry } from './mergeOutbox';

const THREAD = fixtureThread({ head: fixtureMessage({ id: 'h', name: 'Robin', body: 'head' }) });

const entry = (threadId: string | null): OutboxEntry => ({
  id: `e-${threadId ?? 'new'}`,
  threadId,
  body: 'pending',
  createdAt: '2026-09-20T12:00:00Z',
  status: 'sending',
  error: null,
});

describe('mergeOutbox', () => {
  it('appends a pending reply to the end of its thread', () => {
    const [merged] = mergeOutbox({ threads: [THREAD], outbox: [entry(THREAD.id)] });

    expect(merged?.replies.map((reply) => reply.status)).toEqual(['sending']);
    expect(merged?.replies[0]?.author.name).toBe('You');
  });

  it('adds a pending new thread after the existing ones', () => {
    const merged = mergeOutbox({ threads: [THREAD], outbox: [entry(null)] });

    expect(merged).toHaveLength(2);
    expect(merged[1]?.head.body).toBe('pending');
  });
});
