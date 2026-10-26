import { describe, expect, it } from 'vitest';
import { brandId, type ChatId, type IsoDateTime } from '@goodboy/types';
import { addReplyRead } from './addReplyRead';
import { appendReplyText } from './appendReplyText';
import { draftChatMessage } from './draftChatMessage';

const AT = brandId<IsoDateTime>({ value: '2026-10-20T09:00:00.000Z' });
const CHAT = brandId<ChatId>({ value: 'chat-harborline' });

const reply = (status: 'streaming' | 'done' | 'stopped' | 'failed') =>
  draftChatMessage({
    chatId: CHAT,
    role: 'assistant',
    content: 'It lives in ',
    status,
    at: AT,
  });

describe('appendReplyText', () => {
  it('adds a delta to a streaming reply', () => {
    expect(appendReplyText({ message: reply('streaming'), delta: 'payments-api.' }).content).toBe(
      'It lives in payments-api.',
    );
  });

  it.each(['done', 'stopped', 'failed'] as const)(
    'drops a late delta once the reply is %s',
    (status) => {
      const settled = reply(status);

      expect(appendReplyText({ message: settled, delta: 'LATE' })).toBe(settled);
    },
  );
});

describe('addReplyRead', () => {
  it('adds a path once to a streaming reply', () => {
    const once = addReplyRead({ message: reply('streaming'), path: 'ledger-core/src/post.ts' });
    const twice = addReplyRead({ message: once, path: 'ledger-core/src/post.ts' });

    expect(twice.reads).toEqual(['ledger-core/src/post.ts']);
    expect(twice).toBe(once);
  });

  it('drops a late read once the reply is settled', () => {
    const settled = reply('done');

    expect(addReplyRead({ message: settled, path: 'ledger-core/src/post.ts' })).toBe(settled);
  });
});
