// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { markdownPlainLinesOf, markdownPreview } from './markdownPreview';

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

  it('keeps code span content and survives an unterminated comment', () => {
    expect(markdownPreview({ text: 'Use `Array<string>` here <!-- open' })).toBe(
      'Use Array<string> here',
    );
  });

  it('drops tilde fences and images with parentheses in the url', () => {
    const text = '~~~ts\nconst a = 1;\n~~~\n![x](https://example.test/a(b).svg) done';
    expect(markdownPreview({ text })).toBe('done');
  });

  it('keeps the content of a fence that never closes, without its delimiter', () => {
    expect(markdownPreview({ text: '```ts\nconst retryLimit = 3;' })).toBe('const retryLimit = 3;');
    expect(markdownPreview({ text: '```ts\nconst a = 1;', shouldKeepOpenFence: false })).toBe('');
  });

  it('hides a closed comment of any length and keeps text around it', () => {
    const hidden = Array.from({ length: 80 }, (_, row) => `hidden ${row}`).join('\n');
    expect(markdownPreview({ text: `before <!--\n${hidden}\n--> after` })).toBe('before after');
  });

  it('removes long tags and images whole', () => {
    const img = `<img src="https://example.test/${'a'.repeat(5000)}.png"> kept`;
    expect(markdownPreview({ text: img })).toBe('kept');
  });

  it('keeps list markers and drops emphasis when asked to keep markers', () => {
    expect(
      markdownPlainLinesOf({
        text: '- Use `Array<string>` and **bold**.',
        shouldKeepMarkers: true,
      }),
    ).toEqual(['- Use Array<string> and bold.']);
  });

  it('keeps a closed fence only when asked to, comments stay hidden', () => {
    const text = '```ts\nedit notify-relay/src/retry.ts\n```\n<!-- hidden -->';
    expect(markdownPlainLinesOf({ text })).toEqual([]);
    expect(markdownPlainLinesOf({ text, shouldKeepClosedFences: true })).toEqual([
      'edit notify-relay/src/retry.ts',
    ]);
  });
});
