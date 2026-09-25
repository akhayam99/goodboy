import { describe, expect, it } from 'vitest';
import { splitErrorMessage } from './splitErrorMessage';

describe('splitErrorMessage', () => {
  it('keeps a short plain sentence as the summary', () => {
    expect(splitErrorMessage({ message: ' The pull request is not available ' })).toEqual({
      summary: 'The pull request is not available',
      detail: null,
    });
  });

  it.each([
    'summarizer cli exited with code 143',
    'anthropic: io error: No such file or directory (os error 2)',
    'gh: HTTP 502 Bad Gateway (https://api.github.com/graphql)',
    'connect ECONNREFUSED 127.0.0.1:443',
    'failed to read /Users/someone/project/file.ts',
    'line one\nline two',
    'x'.repeat(161),
  ])('moves technical output to the detail: %s', (message) => {
    expect(splitErrorMessage({ message })).toEqual({ summary: null, detail: message });
  });

  it('returns nothing for an empty message', () => {
    expect(splitErrorMessage({ message: '   ' })).toEqual({ summary: null, detail: null });
  });
});
