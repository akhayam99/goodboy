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

  it('lists guide hits first, then releases, then shortcuts', () => {
    const hits = searchHelp({
      chapters: GUIDE_CHAPTERS,
      releases: [release({ version: '0.30.0', markdown: 'a palette for Harborline' })],
      query: 'palette',
    });
    const kinds = hits.map((hit) => hit.kind);

    expect(kinds).toContain('guide');
    expect(kinds).toContain('release');
    expect(kinds).toContain('shortcut');
    expect(kinds.lastIndexOf('guide')).toBeLessThan(kinds.indexOf('release'));
    expect(kinds.lastIndexOf('release')).toBeLessThan(kinds.indexOf('shortcut'));
  });

  it('gives every hit its own key', () => {
    const hits = searchHelp({ chapters: GUIDE_CHAPTERS, releases: [], query: 'session' });

    expect(new Set(hits.map((hit) => hit.key)).size).toBe(hits.length);
  });
});
