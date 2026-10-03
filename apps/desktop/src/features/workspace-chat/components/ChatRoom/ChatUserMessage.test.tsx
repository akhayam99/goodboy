// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ChatUserMessage } from './ChatUserMessage';

afterEach(cleanup);

describe('ChatUserMessage', () => {
  it('reads what you wrote as markdown, lines and lists kept', () => {
    const { container } = render(
      <ChatUserMessage content={'Why did retries **double**?\n- payments-api\n- `ledger-core`'} />,
    );
    const bubble = container.querySelector('[data-chat-message="user"]');
    expect(bubble?.querySelector('strong')?.textContent).toBe('double');
    expect(
      Array.from(bubble?.querySelectorAll('li') ?? []).map((item) => item.textContent),
    ).toEqual(['payments-api', 'ledger-core']);
  });
});
