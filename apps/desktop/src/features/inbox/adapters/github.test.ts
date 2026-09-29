// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { GithubIssue, PullRequestState, SessionId } from '@goodboy/types';
import type { GithubIssueGroup } from '../../github/components/PullRequest/useGithubIssues';
import type { GithubPrGroup } from '../../github/components/PullRequest/useGithubPrs';
import { adaptGithubIssues, adaptGithubPrs } from './github';

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
      stateLabel: 'Open',
      context: 'goodboy/goodboy',
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

const pr = (overrides: Partial<PullRequestState> = {}): PullRequestState => ({
  number: 12,
  title: 'Retry ledger sync',
  url: 'https://github.com/harborline/ledger-core/pull/12',
  state: 'open',
  mergeable: true,
  checks: null,
  baseBranch: 'main',
  headBranch: 'retry-sync',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-09-25T10:00:00Z',
  ...overrides,
});

describe('adaptGithubPrs', () => {
  it('maps a GitHub pull request row into a pr record', () => {
    const groups: ReadonlyArray<GithubPrGroup> = [
      {
        key: 'review-requested',
        label: 'Review requested',
        rows: [{ pr: pr(), role: 'review-requested', sessionId: null }],
      },
    ];

    const [record] = adaptGithubPrs({ groups });

    expect(record).toEqual({
      key: 'github:pr:12',
      provider: 'github',
      kind: 'pr',
      identifier: '#12',
      title: 'Retry ledger sync',
      state: 'open',
      stateLabel: 'In review',
      updatedAt: '2026-09-25T10:00:00Z',
      url: 'https://github.com/harborline/ledger-core/pull/12',
      context: 'harborline/ledger-core',
      payload: {
        provider: 'github',
        kind: 'pr',
        pr: pr(),
        role: 'review-requested',
        sessionId: null,
      },
    });
  });

  it.each([
    ['draft', 'open', 'Draft'],
    ['approved', 'open', 'Approved'],
    ['queued', 'open', 'Queued'],
    ['merged', 'done', 'Merged'],
    ['closed', 'done', 'Closed'],
  ] as const)('maps the %s state like the other pr sources', (state, category, label) => {
    const [record] = adaptGithubPrs({
      groups: [
        {
          key: 'author',
          label: 'Your pull requests',
          rows: [{ pr: pr({ state }), role: 'author', sessionId: null }],
        },
      ],
    });

    expect(record).toMatchObject({ state: category, stateLabel: label });
  });
});
