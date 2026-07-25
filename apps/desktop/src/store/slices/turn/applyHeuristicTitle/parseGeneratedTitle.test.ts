import { describe, expect, it } from 'vitest';
import { parseGeneratedTitle } from './parseGeneratedTitle';

describe('parseGeneratedTitle', () => {
  it('strips wrapping quotes and trailing punctuation', () => {
    const stdout = JSON.stringify({ result: '"Extract token validation."' });

    expect(parseGeneratedTitle({ providerId: 'anthropic', stdout })).toBe(
      'Extract token validation',
    );
  });

  it('keeps only the first non-empty line and caps at six words', () => {
    const stdout = '\n\nFix the flaky summarizer parser regression now\nsome trailing prose';

    expect(parseGeneratedTitle({ providerId: 'cursor', stdout })).toBe(
      'Fix the flaky summarizer parser regression',
    );
  });

  it('unwraps a cursor stream-json result line', () => {
    const stdout = JSON.stringify({
      type: 'result',
      subtype: 'success',
      result: '`Add slot retry`',
    });

    expect(parseGeneratedTitle({ providerId: 'cursor', stdout })).toBe('Add slot retry');
  });

  it('returns an empty string for an empty reply', () => {
    expect(parseGeneratedTitle({ providerId: 'gemini', stdout: '   ' })).toBe('');
  });
});
