// @vitest-environment node
import { describe, expect, it } from 'vitest';
import rawChangelog from '../../../../../CHANGELOG.md?raw';
import { CHANGELOG_RELEASES } from './changelogSource';

describe('changelogSource', () => {
  it('loads the packaged CHANGELOG.md at build time', () => {
    const headings = rawChangelog.split('\n').filter((line) => line.startsWith('## Goodboy v'));
    expect(CHANGELOG_RELEASES.length).toBe(headings.length);
    expect(CHANGELOG_RELEASES[0]?.version).toBe('0.31.3');
    expect(CHANGELOG_RELEASES[0]?.shape).toBe('v2');
  });
});
