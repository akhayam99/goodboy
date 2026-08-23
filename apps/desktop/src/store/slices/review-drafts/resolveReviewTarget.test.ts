import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  Project,
  ProjectId,
  PullRequestState,
  Session,
  SessionExternalTask,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import { reviewPrKey, resolveReviewTarget, type ReviewTargetState } from './resolveReviewTarget';

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-1' as ProjectId;
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

const mergeRequest: GitlabMergeRequest = {
  id: 100,
  iid: 10,
  projectId: 3,
  title: 'MR',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/acme/web/-/merge_requests/10',
  sourceBranch: 'ak/feature',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: NOW,
};

const pullRequest: PullRequestState = {
  number: 42,
  title: 'PR',
  url: 'https://github.com/acme/web/pull/42',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/feature',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: NOW,
};

type StateParams = {
  readonly tasks: ReadonlyArray<SessionExternalTask>;
  readonly prs?: ReadonlyArray<PullRequestState>;
  readonly mr?: GitlabMergeRequest | null;
};

const buildState = ({ tasks, prs = [], mr = null }: StateParams): ReviewTargetState => ({
  sessionExternalTasks: { [SESSION_ID]: tasks },
  sessions: [{ id: SESSION_ID, activeProjectId: PROJECT_ID } as Session],
  projects: [{ id: PROJECT_ID, kind: 'repo' } as Project],
  sessionProjectMounts: {
    [SESSION_ID]: [
      {
        projectId: PROJECT_ID,
        repoRoot: '/repo',
        worktreePath: '/wt',
        branch: 'ak/feature',
        mountName: 'repo',
      } as SessionProjectMount,
    ],
  },
  sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
  sessionProjectPrs: { [SESSION_ID]: { [PROJECT_ID]: prs } },
  sessionGitlabMr: {
    [SESSION_ID]: { mr, fetchedAt: NOW, loading: false, error: null },
  },
});

describe('resolveReviewTarget', () => {
  it('picks the same target whatever order the candidates arrive in', () => {
    const forward = resolveReviewTarget({
      state: buildState({ tasks: [gitlabTask, githubTask] }),
      sessionId: SESSION_ID,
    });
    const reversed = resolveReviewTarget({
      state: buildState({ tasks: [githubTask, gitlabTask] }),
      sessionId: SESSION_ID,
    });

    expect(forward).toEqual({ provider: 'github', repo: 'acme/web', prNumber: 42 });
    expect(reversed).toEqual(forward);
  });

  it('prefers the candidate matching a pull request the store already discovered', () => {
    const state = buildState({ tasks: [githubTask, gitlabTask], mr: mergeRequest });

    expect(resolveReviewTarget({ state, sessionId: SESSION_ID })).toEqual({
      provider: 'gitlab',
      repo: 'acme/web',
      prNumber: 10,
    });
  });

  it('falls back to the priority order when both hosts discovered something', () => {
    const state = buildState({
      tasks: [gitlabTask, githubTask],
      prs: [pullRequest],
      mr: mergeRequest,
    });

    expect(resolveReviewTarget({ state, sessionId: SESSION_ID })).toEqual({
      provider: 'github',
      repo: 'acme/web',
      prNumber: 42,
    });
  });

  it('never routes a bitbucket task through the reviewable providers', () => {
    expect(
      resolveReviewTarget({ state: buildState({ tasks: [bitbucketTask] }), sessionId: SESSION_ID }),
    ).toBeNull();
    expect(
      resolveReviewTarget({
        state: buildState({ tasks: [bitbucketTask, gitlabTask] }),
        sessionId: SESSION_ID,
      }),
    ).toEqual({ provider: 'gitlab', repo: 'acme/web', prNumber: 10 });
  });

  it('skips candidates with an unusable external id or url', () => {
    const brokenId = { ...githubTask, externalId: 'not-a-number' };
    const brokenUrl = { ...githubTask, url: 'not a url' };
    const state = buildState({ tasks: [brokenId, brokenUrl, gitlabTask] });

    expect(resolveReviewTarget({ state, sessionId: SESSION_ID })).toEqual({
      provider: 'gitlab',
      repo: 'acme/web',
      prNumber: 10,
    });
  });

  it('keys a discovered pull request by provider so numbers cannot collide', () => {
    expect(reviewPrKey({ provider: 'github', prNumber: 10 })).not.toBe(
      reviewPrKey({ provider: 'gitlab', prNumber: 10 }),
    );
  });
});
