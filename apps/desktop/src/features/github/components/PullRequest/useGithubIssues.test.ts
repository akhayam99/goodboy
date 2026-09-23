import { describe, expect, it } from 'vitest';
import type { GithubIssue, IsoDateTime, SessionExternalTask, SessionId } from '@goodboy/types';
import { buildGithubIssueGroups } from './useGithubIssues';

type IssueParams = {
  readonly number: number;
  readonly updatedAt: string;
};

type TaskParams = {
  readonly sessionId: SessionId;
  readonly externalId: string;
  readonly provider?: SessionExternalTask['provider'];
};

const makeIssue = ({ number, updatedAt }: IssueParams): GithubIssue => ({
  number,
  title: `Issue ${number}`,
  body: '',
  url: `https://github.com/goodboy/goodboy/issues/${number}`,
  state: 'OPEN',
  labels: [],
  updatedAt,
});

const makeTask = ({
  sessionId,
  externalId,
  provider = 'github',
}: TaskParams): SessionExternalTask => ({
  sessionId,
  provider,
  externalId,
  identifier: `#${externalId}`,
  url: `https://github.com/goodboy/goodboy/issues/${externalId}`,
  title: `Issue ${externalId}`,
  createdAt: '2026-07-20T10:00:00Z' as IsoDateTime,
});

describe('buildGithubIssueGroups', () => {
  it('maps GitHub issues to sessions and sorts newest first', () => {
    const sessionId = 'session-1' as SessionId;
    const groups = buildGithubIssueGroups({
      issues: [
        makeIssue({ number: 41, updatedAt: '2026-07-20T10:00:00Z' }),
        makeIssue({ number: 42, updatedAt: '2026-07-22T10:00:00Z' }),
        makeIssue({ number: 43, updatedAt: '2026-07-21T10:00:00Z' }),
      ],
      externalTasks: {
        [sessionId]: [
          makeTask({ sessionId, externalId: '42' }),
          makeTask({ sessionId, externalId: '43', provider: 'gitlab' }),
        ],
      },
    });

    expect(groups[0]?.rows.map((row) => row.issue.number)).toEqual([42, 43, 41]);
    expect(groups[0]?.rows.map((row) => row.sessionId)).toEqual([sessionId, null, null]);
  });
});
