import { describe, expect, it } from 'vitest';
import { releaseDateLabel } from './releaseDateLabel';

describe('releaseDateLabel', () => {
  it('writes the day and the short month', () => {
    expect(releaseDateLabel({ publishedAt: '2026-10-17T09:00:00Z' })).toMatch(/17/);
    expect(releaseDateLabel({ publishedAt: '2026-10-17T09:00:00Z' })).toMatch(/Oct/);
  });

  it('has no label for a missing or unreadable date', () => {
    expect(releaseDateLabel({ publishedAt: undefined })).toBeNull();
    expect(releaseDateLabel({ publishedAt: 'soon' })).toBeNull();
  });
});
