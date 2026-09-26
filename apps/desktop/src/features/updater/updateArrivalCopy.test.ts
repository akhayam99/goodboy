import { describe, expect, it } from 'vitest';
import type { ReleaseEntry } from '../changelog/parseChangelog';
import { arrivalBullets, arrivalLead, arrivalTitle } from './updateArrivalCopy';

const v2Release: ReleaseEntry = {
  version: '0.8.0',
  shape: 'v2',
  lead: 'A short opening sentence.',
  oneWayFrom: null,
  sections: {
    new: [
      {
        title: 'First new thing',
        area: 'app',
        screen: null,
        image: null,
        prs: [],
        paragraphs: ['p'],
      },
      {
        title: 'Second new thing',
        area: 'app',
        screen: null,
        image: null,
        prs: [],
        paragraphs: ['p'],
      },
    ],
    improved: [
      {
        title: 'An improvement',
        area: 'app',
        screen: null,
        image: null,
        prs: [],
        paragraphs: ['p'],
      },
    ],
    fixed: [],
  },
  markdown: null,
  publishedAt: null,
};

describe('arrivalTitle', () => {
  it('names the version', () => {
    expect(arrivalTitle({ version: '0.8.0' })).toBe('Goodboy 0.8.0 is ready');
  });

  it('falls back when the version is unknown', () => {
    expect(arrivalTitle({ version: null })).toBe('Goodboy update is ready');
  });
});

describe('arrivalBullets', () => {
  it('lists New titles before Improved, capped at three', () => {
    expect(arrivalBullets({ notes: v2Release })).toEqual([
      { title: 'First new thing' },
      { title: 'Second new thing' },
      { title: 'An improvement' },
    ]);
  });

  it('is empty with no notes', () => {
    expect(arrivalBullets({ notes: null })).toEqual([]);
  });

  it('is empty for a markdown-shape release', () => {
    expect(arrivalBullets({ notes: { ...v2Release, shape: 'markdown' } })).toEqual([]);
  });
});

describe('arrivalLead', () => {
  it('returns the opening sentence', () => {
    expect(arrivalLead({ notes: v2Release })).toBe('A short opening sentence.');
  });

  it('is null with no notes', () => {
    expect(arrivalLead({ notes: null })).toBeNull();
  });
});
