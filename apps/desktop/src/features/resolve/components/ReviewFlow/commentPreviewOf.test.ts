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
});
