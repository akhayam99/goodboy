import { describe, expect, it } from 'vitest';
import { markdownPreview } from './markdownPreview';

describe('markdownPreview', () => {
  it('drops a fenced suggestion block entirely, including its content', () => {
    const text = [
      'Use the translated label instead.',
      '',
      '```suggestion',
      '-  <Button>Submit</Button>',
      "+  <Button>{t('submit')}</Button>",
      '```',
    ].join('\n');
    expect(markdownPreview({ text })).toBe('Use the translated label instead.');
  });

  it('strips a bot marker comment and flattens a bold heading to plain text', () => {
    const text = '### Missing UI language forcing **Medium Severity** <!-- DESCRIPTION START -->';
    expect(markdownPreview({ text })).toBe('Missing UI language forcing Medium Severity');
  });

  it('normalizes lists, quotes and collapses whitespace across lines', () => {
    const text = ['> context line', '- first item', '- second item', '', '  trailing   text'].join(
      '\n',
    );
    expect(markdownPreview({ text })).toBe('context line first item second item trailing text');
  });

  it('returns an empty string for missing text', () => {
    expect(markdownPreview({ text: null })).toBe('');
  });
});
