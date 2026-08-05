import { describe, expect, it } from 'vitest';
import { normalizeSiteUrl } from './normalizeSiteUrl';

describe('normalizeSiteUrl', () => {
  it('adds the scheme and strips path and trailing slashes', () => {
    expect(normalizeSiteUrl({ input: 'acme.atlassian.net/' })).toBe('https://acme.atlassian.net');
    expect(normalizeSiteUrl({ input: '  https://acme.atlassian.net/jira/  ' })).toBe(
      'https://acme.atlassian.net',
    );
  });

  it('returns an empty string for input it cannot turn into an http site', () => {
    expect(normalizeSiteUrl({ input: '' })).toBe('');
    expect(normalizeSiteUrl({ input: 'javascript:alert(1)' })).toBe('');
  });
});
