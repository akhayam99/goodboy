// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ReleaseEntry } from '../../../features/changelog/parseChangelog';
import { GUIDE_CHAPTERS } from '../../../features/settings/components/GuideStudio/guideChapters';
import { searchHelp } from './searchHelp';

type ReleaseParams = {
  readonly version: string;
  readonly markdown: string;
};

const release = ({ version, markdown }: ReleaseParams): ReleaseEntry => ({
  version,
  shape: 'markdown',
  lead: null,
  oneWayFrom: null,
  sections: { new: [], improved: [], fixed: [] },
  markdown,
  publishedAt: null,
});

describe('searchHelp', () => {
  it('returns nothing for an empty query', () => {
    expect(searchHelp({ chapters: GUIDE_CHAPTERS, releases: [], query: '  ' })).toEqual([]);
  });

  it('lists guide hits first, then releases', () => {
    const hits = searchHelp({
      chapters: GUIDE_CHAPTERS,
      releases: [release({ version: '0.30.0', markdown: 'a palette for Harborline' })],
      query: 'palette',
    });
    const kinds = hits.map((hit) => hit.kind);

    expect(kinds).toContain('guide');
    expect(kinds).toContain('release');
    expect(kinds.lastIndexOf('guide')).toBeLessThan(kinds.indexOf('release'));
  });

  it('ranks a guide hit whose title matches before one that only mentions the word', () => {
    const hits = searchHelp({ chapters: GUIDE_CHAPTERS, releases: [], query: 'palette' });
    const guide = hits.flatMap((hit) => (hit.kind === 'guide' ? [hit.hit] : []));
    const firstTitleMatch = guide.findIndex((hit) =>
      (hit.term ?? hit.chapterTitle).toLowerCase().includes('palette'),
    );
    const firstBodyOnly = guide.findIndex(
      (hit) => !(hit.term ?? hit.chapterTitle).toLowerCase().includes('palette'),
    );

    expect(firstTitleMatch).toBe(0);
    expect(firstBodyOnly === -1 || firstBodyOnly > firstTitleMatch).toBe(true);
  });

  it('carries a one line excerpt on every guide hit', () => {
    const hits = searchHelp({ chapters: GUIDE_CHAPTERS, releases: [], query: 'palette' });
    const guide = hits.flatMap((hit) => (hit.kind === 'guide' ? [hit.hit] : []));

    expect(guide.length).toBeGreaterThan(0);
    expect(guide.every((hit) => hit.excerpt !== '')).toBe(true);
  });

  it('gives every hit its own key', () => {
    const hits = searchHelp({ chapters: GUIDE_CHAPTERS, releases: [], query: 'session' });

    expect(new Set(hits.map((hit) => hit.key)).size).toBe(hits.length);
  });
});
