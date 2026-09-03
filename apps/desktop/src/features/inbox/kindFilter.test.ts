import { describe, expect, it } from 'vitest';
import type { InboxRecord } from './types';
import {
  filterInboxRecords,
  kindFilterCounts,
  matchesKindFilter,
  matchesSearch,
} from './kindFilter';

const record = (overrides: Partial<InboxRecord> & Pick<InboxRecord, 'key'>): InboxRecord => ({
  provider: 'github',
  kind: 'issue',
  identifier: '#0',
  title: 'untitled',
  state: 'open',
  updatedAt: '2026-08-01T10:00:00Z',
  url: '',
  meta: '',
  payload: {
    provider: 'github',
    kind: 'issue',
    issue: {
      number: 0,
      title: 'untitled',
      body: '',
      url: '',
      state: 'OPEN',
      labels: [],
      updatedAt: '',
    },
    sessionId: null,
  },
  ...overrides,
});

describe('matchesKindFilter', () => {
  it.each([
    ['all', 'issue', true],
    ['issue', 'issue', true],
    ['issue', 'pr', false],
    ['pr-mr', 'pr', true],
    ['pr-mr', 'mr', true],
    ['pr-mr', 'issue', false],
    ['thread', 'thread', true],
    ['error', 'error', true],
    ['error', 'issue', false],
  ] as const)('filter %s against kind %s is %s', (filter, kind, expected) => {
    expect(matchesKindFilter({ kind, filter })).toBe(expected);
  });
});

describe('matchesSearch', () => {
  const item = record({
    key: 'k1',
    title: 'Fix flaky test',
    identifier: '#41',
    meta: 'goodboy/goodboy',
  });

  it('matches on title, identifier or meta case-insensitively', () => {
    expect(matchesSearch({ record: item, query: 'FLAKY' })).toBe(true);
    expect(matchesSearch({ record: item, query: '41' })).toBe(true);
    expect(matchesSearch({ record: item, query: 'goodboy' })).toBe(true);
  });

  it('matches everything on an empty query', () => {
    expect(matchesSearch({ record: item, query: '   ' })).toBe(true);
  });

  it('rejects a query that matches nothing', () => {
    expect(matchesSearch({ record: item, query: 'nope' })).toBe(false);
  });
});

describe('filterInboxRecords', () => {
  const github = record({ key: 'a', provider: 'github', kind: 'issue', title: 'github item' });
  const slack = record({
    key: 'b',
    provider: 'slack',
    kind: 'thread',
    title: 'slack item',
    payload: {
      provider: 'slack',
      kind: 'thread',
      channel: { id: 'C1', name: 'eng', isMember: true, topic: null, memberCount: 1 },
      head: {
        ts: '1',
        threadTs: '1',
        userId: null,
        botId: null,
        text: 'slack item',
        subtype: null,
        replyCount: 1,
        replyUserCount: 1,
        postedAt: null,
        latestReplyAt: null,
        reactions: [],
      },
      sessionId: null,
    },
  });
  const records = [github, slack];

  it('applies kind, provider and search filters together', () => {
    expect(
      filterInboxRecords({ records, query: '', kindFilter: 'all', providers: new Set() }),
    ).toEqual(records);
    expect(
      filterInboxRecords({ records, query: '', kindFilter: 'thread', providers: new Set() }),
    ).toEqual([slack]);
    expect(
      filterInboxRecords({ records, query: '', kindFilter: 'all', providers: new Set(['github']) }),
    ).toEqual([github]);
    expect(
      filterInboxRecords({ records, query: 'slack', kindFilter: 'all', providers: new Set() }),
    ).toEqual([slack]);
  });
});

describe('kindFilterCounts', () => {
  it('counts every kind filter bucket including all', () => {
    const github = record({ key: 'a', kind: 'issue' });
    const bitbucket = record({
      key: 'b',
      provider: 'bitbucket',
      kind: 'pr',
      payload: {
        provider: 'bitbucket',
        kind: 'pr',
        pullRequest: {
          id: 1,
          title: 't',
          description: '',
          state: 'OPEN',
          createdOn: '',
          updatedOn: '',
          sourceBranch: 'feat',
          sourceCommit: null,
          destinationBranch: 'main',
          destinationCommit: null,
          author: null,
          reviewers: [],
          participants: [],
          closeSourceBranch: true,
          mergeCommit: null,
          commentCount: 0,
          taskCount: 0,
          webUrl: null,
        },
        repo: null,
      },
    });

    expect(kindFilterCounts({ records: [github, bitbucket] })).toEqual({
      all: 2,
      issue: 1,
      'pr-mr': 1,
      thread: 0,
      error: 0,
    });
  });
});
