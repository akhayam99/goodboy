// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { INBOX_RECORD_FIXTURES, LINKED_SESSION } from '../../__tests__/helpers/inboxRecordFixtures';
import { startFromRecord, startLabelOf } from './startFromRecord';
import type { InboxRecord } from './types';

const fixture = (key: string): InboxRecord => {
  const record = INBOX_RECORD_FIXTURES.find((candidate) => candidate.key === key);
  if (record === undefined) {
    throw new Error(`missing fixture ${key}`);
  }
  return record;
};

const githubPullRequest = (role: 'author' | 'review-requested'): InboxRecord => {
  const record = fixture('github:pr:12');
  if (record.payload.provider !== 'github' || record.payload.kind !== 'pr') {
    throw new Error('missing github pr fixture');
  }
  return { ...record, payload: { ...record.payload, role, sessionId: null } };
};

describe('startFromRecord', () => {
  it.each([
    ['github:issue:1', 'kickoff', 'Start from #1'],
    ['gitlab:issue:1', 'kickoff', 'Start from goodboy#1'],
    ['linear:issue:1', 'kickoff', 'Start from ENG-1'],
    ['jira:issue:1', 'kickoff', 'Start from GBY-1'],
    ['sentry:error:1', 'kickoff', 'Start from GBY-1'],
    ['slack:thread:1', 'panel', 'Start from #eng'],
    ['bitbucket:pr:1', 'panel', 'Start from #1'],
    ['gitlab:mr:1', 'panel', 'Start from !1'],
  ] as const)('sends %s to %s with the label %s', (key, kind, label) => {
    const record = fixture(key);

    expect(startFromRecord({ record })?.kind).toBe(kind);
    expect(startLabelOf({ record })).toBe(label);
  });

  it('hands the kickoff the candidate the New session draft picks', () => {
    const start = startFromRecord({ record: fixture('linear:issue:1') });

    expect(start).toMatchObject({
      kind: 'kickoff',
      candidate: { provider: 'linear', externalId: '1', identifier: 'ENG-1', title: 'linear item' },
    });
  });

  it('opens the session a record is already linked to, whatever its kind', () => {
    const linked = { ...fixture('linear:issue:1'), linkedSessionId: LINKED_SESSION };

    expect(startFromRecord({ record: linked })).toEqual({
      kind: 'open',
      sessionId: LINKED_SESSION,
    });
  });

  it('reviews a GitHub pull request that waits on you, with the pull request itself', () => {
    const record = githubPullRequest('review-requested');

    expect(startFromRecord({ record })).toMatchObject({
      kind: 'review',
      pr: { number: 12, headBranch: 'retry-sync' },
    });
    expect(startLabelOf({ record })).toBe('Review pull request');
  });

  it('keeps the one-step panel for a GitHub pull request that is yours', () => {
    const record = githubPullRequest('author');

    expect(startFromRecord({ record })).toMatchObject({
      kind: 'panel',
      spec: { externalTask: { identifier: '#12' } },
    });
    expect(startLabelOf({ record })).toBe('Start from #12');
  });

  it('has nothing to start for a Bitbucket pull request without its repository', () => {
    const record = fixture('bitbucket:pr:1');
    if (record.payload.provider !== 'bitbucket') {
      throw new Error('missing bitbucket fixture');
    }
    const orphan = { ...record, payload: { ...record.payload, repo: null } };

    expect(startFromRecord({ record: orphan })).toBeNull();
    expect(startLabelOf({ record: orphan })).toBeNull();
  });

  it('never builds a candidate for a record the row only labels', () => {
    for (const record of INBOX_RECORD_FIXTURES) {
      expect(startLabelOf({ record }), record.key).not.toBeNull();
    }
  });
});
