import { describe, expect, it } from 'vitest';
import type { ChatId } from '@goodboy/types';
import { chatIdOf } from '../../__tests__/helpers/brandedIds';
import { nextChatAfter } from './nextChatAfter';

const PAYMENTS = chatIdOf({ value: 'chat-payments' });
const NOTIFY = chatIdOf({ value: 'chat-notify' });
const LEDGER = chatIdOf({ value: 'chat-ledger' });
const ORDER: ReadonlyArray<ChatId> = [PAYMENTS, NOTIFY, LEDGER];

describe('nextChatAfter', () => {
  it('moves to the chat below the removed one', () => {
    expect(nextChatAfter({ order: ORDER, selectedId: NOTIFY, removedIds: [NOTIFY] })).toBe(LEDGER);
  });

  it('moves to the chat above when the removed one was last', () => {
    expect(nextChatAfter({ order: ORDER, selectedId: LEDGER, removedIds: [LEDGER] })).toBe(NOTIFY);
  });

  it('skips every removed chat on the way down', () => {
    expect(
      nextChatAfter({ order: ORDER, selectedId: PAYMENTS, removedIds: [PAYMENTS, NOTIFY] }),
    ).toBe(LEDGER);
  });

  it('lands on nothing when no chat is left', () => {
    expect(nextChatAfter({ order: ORDER, selectedId: NOTIFY, removedIds: ORDER })).toBeNull();
  });

  it('takes the first kept chat when the removed one was not in the list', () => {
    expect(
      nextChatAfter({
        order: ORDER,
        selectedId: chatIdOf({ value: 'chat-old' }),
        removedIds: [PAYMENTS],
      }),
    ).toBe(NOTIFY);
  });
});
