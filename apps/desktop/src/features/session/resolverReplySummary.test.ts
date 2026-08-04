import { describe, expect, it } from 'vitest';
import { resolverReplySummary } from './resolverReplySummary';

describe('resolverReplySummary', () => {
  it('strips the bot marker comment and flattens a bold heading to plain text', () => {
    const text = '### Missing UI language forcing **Medium Severity** <!-- DESCRIPTION START -->';
    expect(resolverReplySummary({ text })).toBe('Missing UI language forcing Medium Severity');
  });

  it('drops a fenced suggestion block and keeps only the first sentence', () => {
    const text = [
      'Use the translated label instead. It keeps the UI consistent.',
      '',
      '```suggestion',
      "+  <Button>{t('submit')}</Button>",
      '```',
    ].join('\n');
    expect(resolverReplySummary({ text })).toBe('Use the translated label instead.');
  });

  it('truncates a long first sentence at the character cap with an ellipsis', () => {
    const longSentence = `${'word '.repeat(30).trim()}.`;
    const result = resolverReplySummary({ text: longSentence });
    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(123);
  });

  it('returns an empty string for blank text', () => {
    expect(resolverReplySummary({ text: '   ' })).toBe('');
  });
});
