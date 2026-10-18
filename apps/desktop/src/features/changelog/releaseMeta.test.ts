import { describe, expect, it } from 'vitest';
import type { ChangelogFeature, ChangelogFix, ReleaseEntry } from './parseChangelog';
import { releaseMeta } from './releaseMeta';

const feature: ChangelogFeature = {
  title: 'Guide in chapters',
  area: 'sessions',
  screen: null,
  image: null,
  prs: [],
  paragraphs: [],
};
const fix: ChangelogFix = { text: 'Rows keep their order', area: 'sessions', prs: [] };

const buildRelease = (overrides: Partial<ReleaseEntry> = {}): ReleaseEntry => ({
  version: '0.27.2',
  shape: 'v2',
  lead: null,
  oneWayFrom: null,
  sections: { new: [], improved: [feature, feature], fixed: [fix] },
  markdown: null,
  publishedAt: null,
  ...overrides,
});

describe('releaseMeta', () => {
  it('reads date, counts and installed state on one line', () => {
    expect(
      releaseMeta({ release: buildRelease(), dateLabel: '17 Oct', installedVersion: '0.27.2' }),
    ).toBe('17 Oct · 2 improved · 1 fixed · Installed');
  });

  it('says Changes your data for a one-way release', () => {
    expect(
      releaseMeta({
        release: buildRelease({ oneWayFrom: '0.26' }),
        dateLabel: null,
        installedVersion: null,
      }),
    ).toBe('2 improved · 1 fixed · Changes your data');
  });

  it('marks a release newer than the installed one as in the update', () => {
    expect(
      releaseMeta({ release: buildRelease(), dateLabel: null, installedVersion: '0.27.1' }),
    ).toBe('2 improved · 1 fixed · In the update');
  });

  it('keeps only the date for a markdown release', () => {
    expect(
      releaseMeta({
        release: buildRelease({ shape: 'markdown', markdown: 'notes' }),
        dateLabel: '5 Oct',
        installedVersion: null,
      }),
    ).toBe('5 Oct');
  });
});
