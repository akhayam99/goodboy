import { describe, expect, it } from 'vitest';
import type { GithubIssue, SessionId } from '@goodboy/types';
import type { GithubIssueGroup } from '../../github/components/GitHubStudio/useGithubIssues';
import { adaptGithubIssues } from './github';

const issue = (overrides: Partial<GithubIssue> = {}): GithubIssue => ({
  number: 41,
  title: 'Fix the flaky test',
  body: '',
  url: 'https://github.com/goodboy/goodboy/issues/41',
  state: 'OPEN',
  labels: [],
  updatedAt: '2026-08-01T10:00:00Z',
  ...overrides,
});

describe('adaptGithubIssues', () => {
  it('maps a GitHub issue row into a normalized inbox record', () => {
    const sessionId = 'session-1' as SessionId;
    const groups: ReadonlyArray<GithubIssueGroup> = [
      { key: 'open', label: 'Open', rows: [{ issue: issue(), sessionId }] },
    ];

    const [record] = adaptGithubIssues({ groups });

    expect(record).toEqual({
      key: 'github:issue:41',
      provider: 'github',
      kind: 'issue',
      identifier: '#41',
      title: 'Fix the flaky test',
      state: 'open',
      updatedAt: '2026-08-01T10:00:00Z',
      url: 'https://github.com/goodboy/goodboy/issues/41',
      meta: 'GitHub',
      payload: { provider: 'github', kind: 'issue', issue: issue(), sessionId },
    });
  });

  it('flattens every group and keeps a null sessionId untouched', () => {
    const groups: ReadonlyArray<GithubIssueGroup> = [
      { key: 'open', label: 'Open', rows: [{ issue: issue({ number: 1 }), sessionId: null }] },
      {
        key: 'other',
        label: 'Other',
        rows: [{ issue: issue({ number: 2 }), sessionId: 'session-2' as SessionId }],
      },
    ];

    const records = adaptGithubIssues({ groups });

    expect(records.map((record) => record.key)).toEqual(['github:issue:1', 'github:issue:2']);
    expect(records[0]).toMatchObject({ payload: { sessionId: null } });
  });
});
