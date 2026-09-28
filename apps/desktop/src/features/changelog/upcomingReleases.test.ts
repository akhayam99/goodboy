import { describe, expect, it } from 'vitest';
import type { ReleaseEntry } from './parseChangelog';
import { releasesInUpdate, upcomingEntries, withUpcomingReleases } from './upcomingReleases';

const FETCHED_CHANGELOG = [
  '# Changelog',
  '',
  'Release notes for Goodboy, newest first.',
  '',
  '## Goodboy v0.13.1',
  '',
  'Chats keep their place after a restart.',
  '',
  '### Fixed',
  '',
  '- A chat reopens where you left it. <!-- gb area=sessions -->',
  '',
  '## Goodboy v0.13.0',
  '',
  'Ask about the Harborline workspace in a chat of its own.',
  '',
  '### New',
  '',
  '#### Chat',
  '<!-- gb area=sessions image=chat-home -->',
  '',
  'A chat answers questions about ledger-core with read-only tools.',
  '',
  '## Goodboy v0.12.3',
  '',
  'Link any tracker item to a session.',
  '',
  '### Improved',
  '',
  '#### Link work from one search',
  '<!-- gb area=sessions -->',
  '',
  'One search covers every connected tracker.',
  '',
  '## Goodboy v0.12.2',
  '',
  'Faster board.',
  '',
  '### Fixed',
  '',
  '- The board scrolls again. <!-- gb area=app -->',
  '',
].join('\n');

const release = (version: string): ReleaseEntry => ({
  version,
  shape: 'markdown',
  lead: null,
  oneWayFrom: null,
  sections: { new: [], improved: [], fixed: [] },
  markdown: `notes for ${version}`,
  publishedAt: null,
});

describe('releasesInUpdate', () => {
  it('keeps the releases after the installed one up to the target, newest first', () => {
    const releases = releasesInUpdate({
      text: FETCHED_CHANGELOG,
      installed: '0.12.2',
      target: '0.13.0',
    });

    expect(releases.map((entry) => entry.version)).toEqual(['0.13.0', '0.12.3']);
    expect(releases[0]?.shape).toBe('v2');
    expect(releases[0]?.sections.new[0]?.image).toBe('chat-home');
  });

  it('returns nothing when the installed version is already the target', () => {
    expect(
      releasesInUpdate({ text: FETCHED_CHANGELOG, installed: '0.13.1', target: '0.13.1' }),
    ).toEqual([]);
  });
});

describe('upcomingEntries', () => {
  it('prefers the fetched releases', () => {
    const fetched = [release('0.13.0'), release('0.12.3')];

    expect(
      upcomingEntries({ fetched, notes: release('0.13.0'), target: '0.13.0', installed: '0.12.2' }),
    ).toBe(fetched);
  });

  it('falls back to the notes of the target when the fetch brought nothing', () => {
    const notes = release('0.13.0');

    expect(upcomingEntries({ fetched: [], notes, target: '0.13.0', installed: '0.12.2' })).toEqual([
      notes,
    ]);
  });

  it('ignores notes that belong to another version', () => {
    expect(
      upcomingEntries({
        fetched: [],
        notes: release('0.12.9'),
        target: '0.13.0',
        installed: '0.12.2',
      }),
    ).toEqual([]);
  });

  it('shows nothing without an update newer than the installed version', () => {
    const notes = release('0.12.2');

    expect(upcomingEntries({ fetched: [], notes, target: null, installed: '0.12.2' })).toEqual([]);
    expect(upcomingEntries({ fetched: [], notes, target: '0.12.2', installed: '0.12.2' })).toEqual(
      [],
    );
  });
});

describe('withUpcomingReleases', () => {
  it('puts the upcoming releases on top and drops the bundled copies of the same version', () => {
    const upcoming = [release('0.13.0'), release('0.12.3')];
    const bundled = [release('0.12.3'), release('0.12.2')];

    const merged = withUpcomingReleases({ upcoming, releases: bundled });

    expect(merged.map((entry) => entry.version)).toEqual(['0.13.0', '0.12.3', '0.12.2']);
    expect(merged[1]).toBe(upcoming[1]);
  });
});
