import { describe, expect, it } from 'vitest';
import { brandId, type ChatId, type ChatMessageId, type IsoDateTime } from '@goodboy/types';
import { draftChatMessage } from './draftChatMessage';

const AT = brandId<IsoDateTime>({ value: '2026-10-20T09:00:00.000Z' });
const CHAT = brandId<ChatId>({ value: 'chat-harborline' });

describe('draftChatMessage', () => {
  it('drafts a user line with no model and a fresh id', () => {
    const first = draftChatMessage({
      chatId: CHAT,
      role: 'user',
      content: 'why?',
      status: 'done',
      at: AT,
    });
    const second = draftChatMessage({
      chatId: CHAT,
      role: 'user',
      content: 'why?',
      status: 'done',
      at: AT,
    });

    expect(first).toMatchObject({
      chatId: CHAT,
      role: 'user',
      content: 'why?',
      status: 'done',
      provider: null,
      model: null,
      effort: null,
      error: null,
      reads: [],
      attachments: [],
      createdAt: AT,
      updatedAt: AT,
    });
    expect(first.id).not.toBe(second.id);
  });

  it('stamps the model on a reply and keeps a given id', () => {
    const id = brandId<ChatMessageId>({ value: 'message-1' });

    const reply = draftChatMessage({
      chatId: CHAT,
      role: 'assistant',
      content: '',
      status: 'streaming',
      at: AT,
      provider: 'anthropic',
      model: 'sonnet-5',
      effort: 'high',
      id,
    });

    expect(reply).toMatchObject({ id, provider: 'anthropic', model: 'sonnet-5', effort: 'high' });
  });
});
