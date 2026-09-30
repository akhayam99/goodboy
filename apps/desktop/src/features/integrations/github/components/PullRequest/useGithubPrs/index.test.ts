import { describe, expect, it } from 'vitest';
import type {
  GithubInboxPrRole,
  GithubInboxPullRequest,
  IsoDateTime,
  SessionId,
} from '@goodboy/types';
import { buildGithubPrGroups } from '.';
import { collectLinkedExternalIds } from '../../../../hooks/useLinkedExternalIds';

type EntryParams = {
  readonly number: number;
  readonly updatedAt: string;
  readonly role: GithubInboxPrRole;
};

const makeEntry = ({ number, updatedAt, role }: EntryParams): GithubInboxPullRequest => ({
  role,
  pr: {
    number,
    title: `Pull request ${number}`,
    url: `https://github.com/harborline/ledger-core/pull/${number}`,
    state: 'open',
    mergeable: true,
    checks: null,
    baseBranch: 'main',
    headBranch: `feature-${number}`,
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt,
  },
});

describe('buildGithubPrGroups', () => {
  it('groups review requests before own prs, newest first, with linked sessions', () => {
    const sessionId = 'session-1' as SessionId;
    const groups = buildGithubPrGroups({
      pullRequests: [
        makeEntry({ number: 5, updatedAt: '2026-09-20T10:00:00Z', role: 'author' }),
        makeEntry({ number: 7, updatedAt: '2026-09-21T10:00:00Z', role: 'review-requested' }),
        makeEntry({ number: 9, updatedAt: '2026-09-25T10:00:00Z', role: 'review-requested' }),
      ],
      linkedSessions: collectLinkedExternalIds({
        sessionExternalTasks: {
          [sessionId]: [
            {
              sessionId,
              provider: 'github',
              externalId: '7',
              identifier: '#7',
              url: 'https://github.com/harborline/ledger-core/pull/7',
              title: 'Pull request 7',
              createdAt: '2026-09-21T10:00:00Z' as IsoDateTime,
            },
          ],
        },
        providers: ['github'],
      }),
    });

    expect(groups.map((group) => group.key)).toEqual(['review-requested', 'author']);
    expect(groups[0]?.rows.map((row) => [row.pr.number, row.sessionId])).toEqual([
      [9, null],
      [7, sessionId],
    ]);
    expect(groups[1]?.rows.map((row) => row.pr.number)).toEqual([5]);
  });

  it('drops empty groups', () => {
    expect(buildGithubPrGroups({ pullRequests: [], linkedSessions: new Map() })).toEqual([]);
  });
});
