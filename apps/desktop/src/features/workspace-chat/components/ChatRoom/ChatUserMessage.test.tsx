// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { ChatId, ChatMessageId, IsoDateTime } from '@goodboy/types';
import { ChatUserMessage } from './ChatUserMessage';

const AT = '2026-10-03T09:00:00.000Z' as IsoDateTime;

afterEach(cleanup);

describe('ChatUserMessage', () => {
  it('reads what you wrote as markdown, lines and lists kept', () => {
    const { container } = render(
      <ChatUserMessage
        message={{
          id: 'asked' as ChatMessageId,
          chatId: 'chat' as ChatId,
          role: 'user',
          content: 'Why did retries **double**?\n- payments-api\n- `ledger-core`',
          status: 'done',
          reads: [],
          attachments: [],
          error: null,
          provider: null,
          model: null,
          effort: null,
          createdAt: AT,
          updatedAt: AT,
        }}
      />,
    );
    const bubble = container.querySelector('[data-chat-message="user"]');
    expect(bubble?.querySelector('strong')?.textContent).toBe('double');
    expect(
      Array.from(bubble?.querySelectorAll('li') ?? []).map((item) => item.textContent),
    ).toEqual(['payments-api', 'ledger-core']);
  });
});
