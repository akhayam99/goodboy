import { describe, expect, it } from 'vitest';
import type { IsoDateTime, SessionExternalTask, SessionId } from '@goodboy/types';
import { reviewPrKey, reviewTargetFromTasks } from './resolveReviewTarget';

const SESSION_ID = 'session-1' as SessionId;
const NOW = '2026-08-01T00:00:00.000Z' as IsoDateTime;

const githubTask: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'github',
  externalId: '42',
  identifier: '#42',
  url: 'https://github.com/acme/web/pull/42',
  title: 'PR',
  createdAt: NOW,
};

const gitlabTask: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'gitlab',
  externalId: '10',
  identifier: '!10',
  url: 'https://gitlab.com/acme/web/-/merge_requests/10',
  title: 'MR',
  createdAt: NOW,
};

const bitbucketTask: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'bitbucket',
  externalId: '5',
  identifier: '#5',
  url: 'https://bitbucket.org/acme/web/pull-requests/5',
  title: 'BB',
  createdAt: NOW,
};

describe('reviewTargetFromTasks', () => {
  it('picks the same target whatever order the candidates arrive in', () => {
    const forward = reviewTargetFromTasks({ tasks: [gitlabTask, githubTask] });
    const reversed = reviewTargetFromTasks({ tasks: [githubTask, gitlabTask] });

    expect(forward).toEqual({ provider: 'github', repo: 'acme/web', prNumber: 42 });
    expect(reversed).toEqual(forward);
  });

  it('prefers the candidate matching a pull request the store already discovered', () => {
    const discoveredPrKeys = new Set([reviewPrKey({ provider: 'gitlab', prNumber: 10 })]);
    const forward = reviewTargetFromTasks({ tasks: [gitlabTask, githubTask], discoveredPrKeys });
    const reversed = reviewTargetFromTasks({ tasks: [githubTask, gitlabTask], discoveredPrKeys });

    expect(forward).toEqual({ provider: 'gitlab', repo: 'acme/web', prNumber: 10 });
    expect(reversed).toEqual(forward);
  });

  it('never routes a bitbucket task through the reviewable providers', () => {
    expect(reviewTargetFromTasks({ tasks: [bitbucketTask] })).toBeNull();
    expect(reviewTargetFromTasks({ tasks: [bitbucketTask, gitlabTask] })).toEqual({
      provider: 'gitlab',
      repo: 'acme/web',
      prNumber: 10,
    });
  });

  it('skips candidates with an unusable external id or url', () => {
    const brokenId = { ...githubTask, externalId: 'not-a-number' };
    const brokenUrl = { ...githubTask, url: 'not a url' };

    expect(reviewTargetFromTasks({ tasks: [brokenId, brokenUrl, gitlabTask] })).toEqual({
      provider: 'gitlab',
      repo: 'acme/web',
      prNumber: 10,
    });
  });
});
