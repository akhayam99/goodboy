import { describe, expect, it } from 'vitest';
import { brandId, type ChatId, type IsoDateTime } from '@goodboy/types';
import { draftChatMessage } from './draftChatMessage';
import { settleChatReply } from './settleChatReply';

const AT = brandId<IsoDateTime>({ value: '2026-10-20T09:00:00.000Z' });
const LATER = brandId<IsoDateTime>({ value: '2026-10-20T09:00:05.000Z' });
const CHAT = brandId<ChatId>({ value: 'chat-harborline' });

const streaming = () =>
  draftChatMessage({
    chatId: CHAT,
    role: 'assistant',
    content: 'Retries double because',
    status: 'streaming',
    at: AT,
  });

describe('settleChatReply', () => {
  it('marks a finished turn done and clears the error', () => {
    const reply = settleChatReply({
      reply: streaming(),
      isStopping: false,
      outcome: { status: 'done' },
      at: LATER,
    });

    expect(reply).toMatchObject({ status: 'done', error: null, updatedAt: LATER });
    expect(reply.content).toBe('Retries double because');
  });

  it('marks a provider failure failed and keeps the partial text and the reason', () => {
    const reply = settleChatReply({
      reply: streaming(),
      isStopping: false,
      outcome: { status: 'failed', error: 'connection reset by peer' },
      at: LATER,
    });

    expect(reply).toMatchObject({
      status: 'failed',
      error: 'connection reset by peer',
      content: 'Retries double because',
    });
  });

  it('marks a turn the user stopped stopped, whatever the provider reported', () => {
    const killed = settleChatReply({
      reply: streaming(),
      isStopping: true,
      outcome: { status: 'failed', error: 'killed' },
      at: LATER,
    });
    const finished = settleChatReply({
      reply: streaming(),
      isStopping: true,
      outcome: { status: 'done' },
      at: LATER,
    });

    expect(killed).toMatchObject({ status: 'stopped', error: null });
    expect(finished).toMatchObject({ status: 'stopped', error: null });
  });
});
