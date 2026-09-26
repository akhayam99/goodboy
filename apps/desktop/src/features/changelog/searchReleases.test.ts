import { describe, expect, it } from 'vitest';
import { CHANGELOG_RELEASES } from './changelogSource';
import { searchReleases } from './searchReleases';

describe('searchReleases', () => {
  it('returns every release for an empty query', () => {
    expect(searchReleases({ releases: CHANGELOG_RELEASES, query: '' }).length).toBe(
      CHANGELOG_RELEASES.length,
    );
  });

  it('matches a feature title by free text', () => {
    const results = searchReleases({ releases: CHANGELOG_RELEASES, query: 'built-in workflows' });
    expect(results.some((release) => release.version === '0.7.0')).toBe(true);
  });

  it('finds no results for a word that is not in the changelog', () => {
    const results = searchReleases({ releases: CHANGELOG_RELEASES, query: 'xylophonemarmot' });
    expect(results).toEqual([]);
  });

  it('filters by area with area:<name>', () => {
    const results = searchReleases({ releases: CHANGELOG_RELEASES, query: 'area:storage' });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((release) => {
      if (release.shape === 'markdown') {
        throw new Error('area filter should only return v2 releases');
      }
      const hasStorage =
        release.sections.new.some((feature) => feature.area === 'storage') ||
        release.sections.improved.some((feature) => feature.area === 'storage') ||
        release.sections.fixed.some((fix) => fix.area === 'storage');
      expect(hasStorage).toBe(true);
    });
  });

  it('returns no results for an unknown area', () => {
    const results = searchReleases({ releases: CHANGELOG_RELEASES, query: 'area:bogus' });
    expect(results).toEqual([]);
  });
});
