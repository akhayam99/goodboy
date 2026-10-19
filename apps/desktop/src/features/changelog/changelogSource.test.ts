// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CHANGELOG_RELEASES } from './changelogSource';

describe('changelogSource', () => {
  it('loads the packaged CHANGELOG.md at build time', () => {
    expect(CHANGELOG_RELEASES.length).toBe(139);
    expect(CHANGELOG_RELEASES[0]?.version).toBe('0.27.6');
    expect(CHANGELOG_RELEASES[0]?.shape).toBe('v2');
  });
});
