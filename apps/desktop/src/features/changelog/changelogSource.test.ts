import { describe, expect, it } from 'vitest';
import { CHANGELOG_RELEASES } from './changelogSource';

describe('changelogSource', () => {
  it('loads the packaged CHANGELOG.md at build time', () => {
    expect(CHANGELOG_RELEASES.length).toBe(89);
    expect(CHANGELOG_RELEASES[0]?.version).toBe('0.7.0');
    expect(CHANGELOG_RELEASES[0]?.shape).toBe('v2');
  });
});
