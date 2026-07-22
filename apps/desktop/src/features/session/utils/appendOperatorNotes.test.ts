import { describe, expect, it } from 'vitest';
import { appendOperatorNotes } from './appendOperatorNotes';

describe('appendOperatorNotes', () => {
  it('keeps the original prompt byte-identical for a whitespace-only hint', () => {
    const prompt = 'Open a draft pull request.\nThen report the URL.';
    expect(appendOperatorNotes({ prompt, hint: ' \n\t ' })).toBe(prompt);
  });

  it('appends trimmed notes in a trailing delimited section', () => {
    expect(
      appendOperatorNotes({ prompt: 'Open a draft pull request.', hint: '  Focus on API. ' }),
    ).toBe('Open a draft pull request.\n\nOperator notes:\n---\nFocus on API.\n---');
  });
});
