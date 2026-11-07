// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { commentPreviewOf } from './commentPreviewOf';

describe('commentPreviewOf', () => {
  it('takes the heading text as the line', () => {
    expect(commentPreviewOf({ text: '## Retry loop never backs off\n\nDetails below.' })).toBe(
      'Retry loop never backs off',
    );
  });

  it('drops html comments, including an unterminated one', () => {
    expect(
      commentPreviewOf({ text: '<!-- fingerprinting:abc -->\nUse the ledger-core client' }),
    ).toBe('Use the ledger-core client');
    expect(commentPreviewOf({ text: 'Keep this <!-- never closed\nhidden' })).toBe('Keep this');
  });

  it('skips severity badges and image lines', () => {
    expect(
      commentPreviewOf({
        text: '![medium](https://example.test/medium.svg)\n_Potential issue_ | _Major_\n\nCache key ignores the tenant.',
      }),
    ).toBe('Cache key ignores the tenant.');
  });

  it('skips bot boilerplate lines', () => {
    expect(
      commentPreviewOf({ text: 'Powered by Harborline\nNull check missing on payments-api' }),
    ).toBe('Null check missing on payments-api');
  });

  it('keeps plain text as it is', () => {
    expect(commentPreviewOf({ text: 'Why not reuse the **notify-relay** helper?' })).toBe(
      'Why not reuse the notify-relay helper?',
    );
  });

  it('returns an empty line for an empty or markup-only body', () => {
    expect(commentPreviewOf({ text: '' })).toBe('');
    expect(commentPreviewOf({ text: '<!-- only a marker -->\n---' })).toBe('');
  });

  it('keeps code span content literally, comment syntax and angle brackets included', () => {
    expect(commentPreviewOf({ text: 'Use `Array<string>` for the result.' })).toBe(
      'Use Array<string> for the result.',
    );
    expect(commentPreviewOf({ text: 'Write `<!--` to open a comment.' })).toBe(
      'Write <!-- to open a comment.',
    );
  });

  it('does not let an unterminated comment swallow the rest', () => {
    expect(commentPreviewOf({ text: '<!-- never closed\nThe retry loop has no cap.' })).toBe(
      'The retry loop has no cap.',
    );
  });

  it('skips a multi-line comment that does close', () => {
    expect(commentPreviewOf({ text: '<!--\nmarker\n-->\nCache key ignores the tenant.' })).toBe(
      'Cache key ignores the tenant.',
    );
  });

  it('never shows a fence delimiter or language as the preview', () => {
    expect(commentPreviewOf({ text: '```typescript\nconst a = 1;\n```\nPlease rename it.' })).toBe(
      'Please rename it.',
    );
    expect(commentPreviewOf({ text: '~~~ts\nconst a = 1;\n~~~\nPlease rename it.' })).toBe(
      'Please rename it.',
    );
  });

  it('removes images with balanced parentheses or very long urls', () => {
    expect(
      commentPreviewOf({ text: '![badge](https://example.test/badge(v2).svg)\nReal comment.' }),
    ).toBe('Real comment.');
    const long = `![alt text](https://example.test/${'a'.repeat(900)}.svg)\nReal comment.`;
    expect(commentPreviewOf({ text: long })).toBe('Real comment.');
    const img = `<img src="https://example.test/${'b'.repeat(600)}.png" alt="x">\nReal comment.`;
    expect(commentPreviewOf({ text: img })).toBe('Real comment.');
  });

  it('keeps ordinary instructions that start like boilerplate', () => {
    expect(commentPreviewOf({ text: 'Reply with an error when the token expires.' })).toBe(
      'Reply with an error when the token expires.',
    );
    expect(commentPreviewOf({ text: 'This is an automatic retry loop; cap it.' })).toBe(
      'This is an automatic retry loop; cap it.',
    );
  });

  it('finishes on hostile input', () => {
    const hostile = `${'<a '.repeat(5000)}\n${'`'.repeat(5000)}\n${'[x]('.repeat(3000)}\n${'<!--'.repeat(3000)}\nend`;
    expect(commentPreviewOf({ text: hostile })).toHaveLength(2000);
  });

  it('drops a long img tag and a long balanced image', () => {
    const img = `<img src="https://example.test/${'a'.repeat(2500)}.png">\nReal comment.`;
    expect(commentPreviewOf({ text: img })).toBe('Real comment.');
    const md = `![badge](https://example.test/${'b'.repeat(2500)}(v2).svg)\nReal comment.`;
    expect(commentPreviewOf({ text: md })).toBe('Real comment.');
  });

  it('hides a closed comment of any length', () => {
    const hidden = Array.from({ length: 80 }, (_, row) => `hidden ${row}`).join('\n');
    expect(commentPreviewOf({ text: `<!--\n${hidden}\n-->\nReal comment.` })).toBe('Real comment.');
  });

  it('drops a fence that never closes', () => {
    expect(commentPreviewOf({ text: '```ts\nconst a = 1;' })).toBe('');
  });
});
