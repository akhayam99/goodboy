import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { parseChangelog } from './parseChangelog';

const CHANGELOG_PATH = join(__dirname, '..', '..', '..', '..', '..', 'CHANGELOG.md');

describe('parseChangelog', () => {
  it('parses the real CHANGELOG.md without throwing', () => {
    const content = readFileSync(CHANGELOG_PATH, 'utf8');
    const releases = parseChangelog({ text: content });
    expect(releases.length).toBe(89);
  });

  it('parses v0.7.0 into the v2 shape with New, Improved and Fixed', () => {
    const content = readFileSync(CHANGELOG_PATH, 'utf8');
    const releases = parseChangelog({ text: content });
    const release = releases.find((entry) => entry.version === '0.7.0');
    expect(release).toBeDefined();
    expect(release?.shape).toBe('v2');
    expect(release?.oneWayFrom).toBe('0.6');
    expect(release?.sections.new.length).toBe(3);
    expect(release?.sections.improved.length).toBe(2);
    expect(release?.sections.fixed.length).toBe(2);
    expect(release?.sections.new[0]?.area).toBe('artifacts');
    expect(release?.sections.new[0]?.prs).toEqual([1886]);
    expect(release?.markdown).toBeNull();
  });

  it('parses v0.5.0 (no one-way paragraph) into the v2 shape', () => {
    const content = readFileSync(CHANGELOG_PATH, 'utf8');
    const releases = parseChangelog({ text: content });
    const release = releases.find((entry) => entry.version === '0.5.0');
    expect(release?.shape).toBe('v2');
    expect(release?.oneWayFrom).toBeNull();
  });

  it('falls back to markdown for a pre-v2 release', () => {
    const content = readFileSync(CHANGELOG_PATH, 'utf8');
    const releases = parseChangelog({ text: content });
    const release = releases.find((entry) => entry.version === '0.4.3');
    expect(release?.shape).toBe('markdown');
    expect(release?.sections.new).toEqual([]);
    expect(release?.markdown).not.toBeNull();
    expect(release?.markdown).toContain('The board and your sessions answer every click again');
  });

  it('falls back a whole release to markdown when a block is out of place', () => {
    const text = [
      '## Goodboy v9.9.9',
      '',
      'A lead sentence for this release.',
      '',
      '### New',
      '',
      '#### Something new',
      '<!-- gb area=app -->',
      '',
      'A paragraph.',
      '',
      '### Unexpected',
      '',
      'some stray content',
    ].join('\n');
    const releases = parseChangelog({ text });
    expect(releases).toHaveLength(1);
    expect(releases[0]?.shape).toBe('markdown');
    expect(releases[0]?.sections.new).toEqual([]);
  });

  it('rejects an unknown area and falls back to markdown', () => {
    const text = [
      '## Goodboy v9.9.9',
      '',
      'A lead sentence for this release.',
      '',
      '### New',
      '',
      '#### Something new',
      '<!-- gb area=unknown-area -->',
      '',
      'A paragraph.',
    ].join('\n');
    const releases = parseChangelog({ text });
    expect(releases[0]?.shape).toBe('markdown');
  });

  it('rejects an unknown key in the meta comment', () => {
    const text = [
      '## Goodboy v9.9.9',
      '',
      'A lead sentence for this release.',
      '',
      '### New',
      '',
      '#### Something new',
      '<!-- gb area=app bogus=1 -->',
      '',
      'A paragraph.',
    ].join('\n');
    const releases = parseChangelog({ text });
    expect(releases[0]?.shape).toBe('markdown');
  });

  it('ignores a <picture> tag appended by release-notes.mjs for images', () => {
    const text = [
      '## Goodboy v9.9.9',
      '',
      'A lead sentence for this release.',
      '',
      '### New',
      '',
      '#### Something new',
      '<!-- gb area=app image=some-shot -->',
      '',
      'A paragraph.',
      '<picture><source srcset="x"><img src="y"></picture>',
    ].join('\n');
    const releases = parseChangelog({ text });
    expect(releases[0]?.shape).toBe('v2');
    expect(releases[0]?.sections.new[0]?.paragraphs).toEqual(['A paragraph.']);
  });

  it('parses a Fixed-only release', () => {
    const text = [
      '## Goodboy v9.9.9',
      '',
      'A lead sentence for this release.',
      '',
      '### Fixed',
      '',
      '- A fix. <!-- gb area=app -->',
    ].join('\n');
    const releases = parseChangelog({ text });
    expect(releases[0]?.shape).toBe('v2');
    expect(releases[0]?.sections.fixed).toEqual([{ text: 'A fix.', area: 'app', prs: [] }]);
  });

  it('returns an empty array for empty input', () => {
    expect(parseChangelog({ text: '' })).toEqual([]);
  });
});
