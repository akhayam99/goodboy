import { describe, expect, it } from 'vitest';
import { sanitizeSlug } from './slug';

describe('sanitizeSlug', () => {
  it('lowercases and keeps a-z 0-9 and hyphens', () => {
    expect(sanitizeSlug('Refactor Auth Domain')).toBe('refactor-auth-domain');
  });

  it('collapses runs of separators', () => {
    expect(sanitizeSlug('a---b__c  d')).toBe('a-b-c-d');
  });

  it('strips leading and trailing hyphens', () => {
    expect(sanitizeSlug('---hi---')).toBe('hi');
  });

  it('truncates to max 48 chars without trailing hyphen', () => {
    const long = 'a'.repeat(60);
    expect(sanitizeSlug(long)).toHaveLength(48);
  });

  it('falls back to a stable hash for empty input', () => {
    expect(sanitizeSlug('')).toMatch(/^[a-f0-9]{8}$/);
    expect(sanitizeSlug('!!!')).toMatch(/^[a-f0-9]{8}$/);
  });
});
