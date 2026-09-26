import { describe, expect, it } from 'vitest';
import { CHANGELOG_RELEASES } from './changelogSource';
import { changelogCatchUp } from './changelogCatchUp';

describe('changelogCatchUp', () => {
  it('returns null when nothing was seen before', () => {
    expect(
      changelogCatchUp({
        releases: CHANGELOG_RELEASES,
        seenVersion: null,
        installedVersion: '0.7.0',
      }),
    ).toBeNull();
  });

  it('returns null when the seen version is already the installed one', () => {
    expect(
      changelogCatchUp({
        releases: CHANGELOG_RELEASES,
        seenVersion: '0.7.0',
        installedVersion: '0.7.0',
      }),
    ).toBeNull();
  });

  it('returns null when only one release separates seen from installed', () => {
    expect(
      changelogCatchUp({
        releases: CHANGELOG_RELEASES,
        seenVersion: '0.6.0',
        installedVersion: '0.7.0',
      }),
    ).toBeNull();
  });

  it('returns the releases strictly after the seen version, up to installed', () => {
    const result = changelogCatchUp({
      releases: CHANGELOG_RELEASES,
      seenVersion: '0.5.3',
      installedVersion: '0.7.0',
    });
    expect(result?.fromVersion).toBe('0.5.3');
    expect(result?.releases.map((release) => release.version)).toEqual(['0.7.0', '0.6.0']);
  });
});
