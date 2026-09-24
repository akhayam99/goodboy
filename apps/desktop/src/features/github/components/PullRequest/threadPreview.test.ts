import { describe, expect, it } from 'vitest';
import { threadPreview } from './threadPreview';

describe('threadPreview', () => {
  it('strips the bot marker comment and flattens a bold heading to plain text', () => {
    const body = '### Missing UI language forcing **Medium Severity** <!-- DESCRIPTION START -->';
    expect(threadPreview({ body })).toBe('Missing UI language forcing Medium Severity');
  });

  it('returns only the first non-blank line, not the rest of a longer body', () => {
    const body = ['line one of the bot report', 'line two', 'line three', 'line four'].join('\n');
    expect(threadPreview({ body })).toBe('line one of the bot report');
  });

  it('skips leading blank lines and normalizes the first line with content', () => {
    const body = ['', '  ', '- first item in a list'].join('\n');
    expect(threadPreview({ body })).toBe('first item in a list');
  });

  it('returns an empty string for a blank body', () => {
    expect(threadPreview({ body: '   ' })).toBe('');
  });
});
