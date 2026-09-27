import { describe, expect, it } from 'vitest';
import { CHANGELOG_RELEASES } from './changelogSource';

describe('changelogSource', () => {
  it('loads the packaged CHANGELOG.md at build time', () => {
    expect(CHANGELOG_RELEASES.length).toBe(95);
    expect(CHANGELOG_RELEASES[0]?.version).toBe('0.11.2');
    expect(CHANGELOG_RELEASES[0]?.shape).toBe('v2');
  });
});
