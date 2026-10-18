// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GUIDE_CHAPTERS } from './guideChapters';
import { searchChapters } from './searchChapters';

const hits = (query: string) =>
  searchChapters({ chapters: GUIDE_CHAPTERS, query }).map((hit) =>
    hit.term === null ? hit.chapterId : `${hit.chapterId}: ${hit.term}`,
  );

describe('searchChapters', () => {
  it('finds nothing for an empty query, so the rail shows the chapter list', () => {
    expect(hits('   ')).toEqual([]);
  });

  it('lists the chapter first, then its points, in Guide order', () => {
    const limit = hits('limit');
    expect(limit).toContain('words: Limit');
    expect(limit).toContain('providers');
    expect(limit.indexOf('words: Limit')).toBeLessThan(limit.indexOf('providers'));
    expect(limit.indexOf('providers')).toBeLessThan(limit.indexOf('providers: Limit'));
  });

  it('matches every word anywhere in a point, ignoring case', () => {
    expect(hits('USE reset')).toEqual(['providers: Use reset']);
    expect(hits('squash')).toEqual(['commits: Shape the history']);
  });

  it('finds a chapter by the screen it links to', () => {
    expect(hits('open branches')).toEqual(['commits', 'storage']);
  });

  it('finds the rail, the tools and the rebase prompt by their names', () => {
    expect(hits('fold session rail')).toContain('shell: Session tools');
    expect(hits('resolve with auto')).toEqual(['commits: A rebase conflict asks']);
    expect(hits('hint the orchestrator')[0]).toBe('workflows: Orchestrated');
  });

  it('names each hit once, with a key no other hit has', () => {
    const keys = searchChapters({ chapters: GUIDE_CHAPTERS, query: 'a' }).map((hit) => hit.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('no longer finds what the shell moved or renamed', () => {
    expect(hits('pulse icon')).toEqual([]);
    expect(hits('monthly cap')).toEqual([]);
    expect(hits('more panes')).toEqual([]);
  });

  it('returns nothing when a word matches no point', () => {
    expect(hits('reset kubernetes')).toEqual([]);
  });
});
