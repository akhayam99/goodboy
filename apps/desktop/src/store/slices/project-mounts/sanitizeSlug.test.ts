import { describe, expect, it } from 'vitest';
import { sanitizeSlug } from './sanitizeSlug';

describe('sanitizeSlug', () => {
  it('mirrors the backend sanitizer on a branch-shaped slug', () => {
    expect(sanitizeSlug('alice/fix-parser')).toBe('alice-fix-parser');
  });

  it('lowercases only ascii letters, the way the backend does', () => {
    expect(sanitizeSlug('Fix-Parser')).toBe('fix-parser');
    expect(sanitizeSlug('caffÈ')).toBe('caff');
  });

  it('collapses runs and drops edge dashes', () => {
    expect(sanitizeSlug('  my   feature  ')).toBe('my-feature');
  });

  it('truncates at 48 characters, not 40', () => {
    const raw = 'a'.repeat(60);

    expect(sanitizeSlug(raw)).toHaveLength(48);
  });

  it('never leaves a trailing dash after truncation', () => {
    const raw = `${'a'.repeat(47)}-tail`;

    expect(sanitizeSlug(raw)).toBe('a'.repeat(47));
  });

  it('is idempotent, so a sanitized name survives a second pass', () => {
    const once = sanitizeSlug('Alice/Fix   Parser/../weird');

    expect(sanitizeSlug(once)).toBe(once);
  });

  it('returns an empty string when nothing survives', () => {
    expect(sanitizeSlug('***')).toBe('');
  });
});
