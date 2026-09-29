// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CHANGELOG_RELEASES } from './changelogSource';

describe('changelogSource', () => {
  it('loads the packaged CHANGELOG.md at build time', () => {
    expect(CHANGELOG_RELEASES.length).toBe(105);
    expect(CHANGELOG_RELEASES[0]?.version).toBe('0.13.1');
    expect(CHANGELOG_RELEASES[0]?.shape).toBe('v2');
  });
});
