// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GUIDE_CHAPTERS } from './guideChapters';
import { searchChapters } from './searchChapters';

const ids = (query: string) =>
  searchChapters({ chapters: GUIDE_CHAPTERS, query }).map((chapter) => chapter.id);

describe('searchChapters', () => {
  it('keeps every chapter for an empty query', () => {
    expect(ids('   ')).toEqual(GUIDE_CHAPTERS.map((chapter) => chapter.id));
  });

  it('matches every word anywhere in a chapter, ignoring case', () => {
    expect(ids('USE reset')).toEqual(['providers']);
    expect(ids('squash')).toEqual(['history']);
  });

  it('finds a chapter by the screen it links to', () => {
    expect(ids('security findings')).toContain('storage');
  });

  it('returns nothing when a word matches no chapter', () => {
    expect(ids('reset kubernetes')).toEqual([]);
  });
});
