import { describe, expect, it } from 'vitest';
import { normalizeHostUrl } from './normalizeHostUrl';

describe('normalizeHostUrl', () => {
  it('adds the scheme and strips path and trailing slashes', () => {
    expect(normalizeHostUrl({ input: 'acme.atlassian.net/', fallback: '' })).toBe(
      'https://acme.atlassian.net',
    );
    expect(normalizeHostUrl({ input: '  https://acme.atlassian.net/jira/  ', fallback: '' })).toBe(
      'https://acme.atlassian.net',
    );
  });

  it('returns the empty fallback for input it cannot turn into an http site', () => {
    expect(normalizeHostUrl({ input: '', fallback: '' })).toBe('');
    expect(normalizeHostUrl({ input: 'javascript:alert(1)', fallback: '' })).toBe('');
  });

  it('returns the gitlab fallback when the host is blank or unusable', () => {
    const fallback = 'https://gitlab.com';
    expect(normalizeHostUrl({ input: '   ', fallback })).toBe(fallback);
    expect(normalizeHostUrl({ input: 'ftp://gitlab.acme.dev', fallback })).toBe(fallback);
    expect(normalizeHostUrl({ input: 'gitlab.acme.dev/', fallback })).toBe(
      'https://gitlab.acme.dev',
    );
  });
});
