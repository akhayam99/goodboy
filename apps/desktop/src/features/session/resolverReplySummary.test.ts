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

  it('preserves a long first sentence for rendering through a disclosure', () => {
    const longSentence = `${'word '.repeat(30).trim()}.`;
    const result = resolverReplySummary({ text: longSentence });
    expect(result).toBe(longSentence);
  });

  it('returns an empty string for blank text', () => {
    expect(resolverReplySummary({ text: '   ' })).toBe('');
  });
});
