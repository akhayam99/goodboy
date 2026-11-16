// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { codeSpansOf } from './codeSpansOf';

describe('codeSpansOf', () => {
  it('splits text and code spans in order and loses no character', () => {
    const text = 'Poll `/v2/deliveries/:id` with `--max-attempts=2` now';
    const parts = codeSpansOf({ text });

    expect(parts).toEqual([
      { kind: 'text', value: 'Poll ' },
      { kind: 'code', value: '/v2/deliveries/:id' },
      { kind: 'text', value: ' with ' },
      { kind: 'code', value: '--max-attempts=2' },
      { kind: 'text', value: ' now' },
    ]);
    expect(
      parts.map((part) => (part.kind === 'code' ? `\`${part.value}\`` : part.value)).join(''),
    ).toBe(text);
  });

  it('keeps a lone backtick as text', () => {
    expect(codeSpansOf({ text: 'a ` b' })).toEqual([{ kind: 'text', value: 'a ` b' }]);
  });
});
