// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { agentLastMessage } from './agentLastMessage';

describe('agentLastMessage', () => {
  it('returns what the agent wrote without the control markers', () => {
    const text = [
      'I changed the guard in `retryPolicy.ts`. Can I commit?',
      '<<comment-reply id="PRRT_1">>done<</comment-reply>>',
    ].join('\n');

    expect(agentLastMessage({ assistantText: text })).toBe(
      'I changed the guard in `retryPolicy.ts`. Can I commit?',
    );
  });

  it('is empty when the agent wrote nothing but markers', () => {
    expect(
      agentLastMessage({
        assistantText: '<<needs-input id="PRRT_1" options="a|b">>Which one?<</needs-input>>',
      }),
    ).toBe('');
    expect(agentLastMessage({ assistantText: '  \n ' })).toBe('');
  });

  it('keeps the tail of a long message from a paragraph boundary', () => {
    const early = `${'early '.repeat(500).trim()}`;
    const late = 'Which of the two timeouts should the client see?';
    const text = `${early}\n\n${late}`;

    const message = agentLastMessage({ assistantText: text });
    expect(message.length).toBeLessThanOrEqual(2000);
    expect(message.endsWith(late)).toBe(true);
  });
});
