import { describe, expect, it } from 'vitest';
import { releaseDateLabel } from './releaseDateLabel';

describe('releaseDateLabel', () => {
  it('writes the day and the short month of the local day', () => {
    const publishedAt = new Date(2026, 9, 17, 9, 0).toISOString();

    expect(releaseDateLabel({ publishedAt })).toMatch(/17/);
    expect(releaseDateLabel({ publishedAt })).toMatch(/Oct/);
  });

  it('has no label for a missing or unreadable date', () => {
    expect(releaseDateLabel({ publishedAt: undefined })).toBeNull();
    expect(releaseDateLabel({ publishedAt: 'soon' })).toBeNull();
  });
});
