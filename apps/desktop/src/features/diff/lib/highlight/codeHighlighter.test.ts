import { describe, expect, it } from 'vitest';
import { APP_CODE_HIGHLIGHTER } from './codeHighlighter';

describe('APP_CODE_HIGHLIGHTER', () => {
  it('highlights a markdown fence by its name through the shared highlighter', async () => {
    const code = 'def settle(batch):\n    return None';
    const lines = await APP_CODE_HIGHLIGHTER.highlight(code, 'py');
    expect(lines?.[0]?.find((token) => token.text === 'def')?.kind).toBe('keyword');
    expect(APP_CODE_HIGHLIGHTER.peek(code, 'python')).toBe(lines);
  });

  it('leaves unknown fences plain', async () => {
    expect(await APP_CODE_HIGHLIGHTER.highlight('+++', 'brainfuck')).toBeNull();
    expect(APP_CODE_HIGHLIGHTER.peek('+++', 'brainfuck')).toBeNull();
  });
});
