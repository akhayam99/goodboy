// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseGeneratedTitle } from './parseGeneratedTitle';

const ASK = 'Make the ledger export finish in under five seconds';

describe('parseGeneratedTitle', () => {
  it('strips wrapping quotes and trailing punctuation', () => {
    const stdout = JSON.stringify({ result: '"Extract token validation."' });

    expect(parseGeneratedTitle({ providerId: 'anthropic', stdout, ask: ASK })).toBe(
      'Extract token validation',
    );
  });

  it('keeps only the first non-empty line and caps at six words', () => {
    const stdout = '\n\nFix the flaky summarizer parser regression now\nsome trailing prose';

    expect(parseGeneratedTitle({ providerId: 'cursor', stdout, ask: ASK })).toBe(
      'Fix the flaky summarizer parser regression',
    );
  });

  it('unwraps a cursor stream-json result line', () => {
    const stdout = JSON.stringify({
      type: 'result',
      subtype: 'success',
      result: '`Add slot retry`',
    });

    expect(parseGeneratedTitle({ providerId: 'cursor', stdout, ask: ASK })).toBe('Add slot retry');
  });

  it('returns an empty string for an empty reply', () => {
    expect(parseGeneratedTitle({ providerId: 'gemini', stdout: '   ', ask: ASK })).toBe('');
  });

  it('drops a Title label before the words', () => {
    const stdout = 'Title: Speed up the ledger export';

    expect(parseGeneratedTitle({ providerId: 'cursor', stdout, ask: ASK })).toBe(
      'Speed up the ledger export',
    );
  });

  it('falls back to the first line of the ask when the reply is a leaked sentence', () => {
    const stdout = 'Title: the user asked for a ledger export that is faster than before';

    expect(parseGeneratedTitle({ providerId: 'cursor', stdout, ask: ASK })).toBe(ASK);
  });

  it('cuts a long ask at a word with an ellipsis, never mid-word', () => {
    const ask = `${'Investigate the payments-api reconciliation mismatch '.repeat(3)}\nsecond line`;
    const stdout = 'I will look into the reconciliation mismatch now';

    const title = parseGeneratedTitle({ providerId: 'cursor', stdout, ask });

    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.slice(0, -1)).toMatch(/mismatch$|payments-api$|reconciliation$|Investigate$|the$/);
  });
});
