import { describe, expect, it } from 'vitest';
import { githubPullRequestPort } from '../githubPullRequestPort';
import { gitlabPullRequestPort, gitlabStateKindOf } from '../gitlabPullRequestPort';
import { REVIEW_SOURCE_CAPABILITIES } from '../types';
import {
  GITHUB_PR_REPO,
  GITHUB_PR_URL,
  PR_VIEW_JSON,
  githubRunner,
  jsonOk,
} from './githubPullRequestFixture';
import { MR_JSON, fakeGitlabTransport } from './gitlabPullRequestFixture';

describe('queued pull request ports', () => {
  it('reads the GitHub queue placement for the head branch', async () => {
    const { runner, calls } = githubRunner({
      override: (args) =>
        args[1] === 'graphql'
          ? jsonOk({
              data: {
                repository: {
                  pullRequests: {
                    nodes: [
                      { number: 318, isInMergeQueue: true, mergeQueueEntry: { position: 3 } },
                    ],
                  },
                },
              },
            })
          : null,
    });
    const port = githubPullRequestPort({
      runner,
      repo: GITHUB_PR_REPO,
      prNumber: 318,
      prUrl: GITHUB_PR_URL,
    });
    expect(await port.read()).toMatchObject({
      state: 'queued',
      mergeQueue: { position: 3 },
      autoMerge: false,
    });
    expect(calls.find((args) => args[1] === 'graphql')).toContain(
      `branch=${PR_VIEW_JSON.headRefName}`,
    );
  });

  it('reads GitHub auto-merge as queued independently of a queue placement', async () => {
    const { runner } = githubRunner({
      override: (args) =>
        args.join(' ').includes('closingIssuesReferences')
          ? jsonOk({ ...PR_VIEW_JSON, autoMergeRequest: {} })
          : null,
    });
    const port = githubPullRequestPort({
      runner,
      repo: GITHUB_PR_REPO,
      prNumber: 318,
      prUrl: GITHUB_PR_URL,
    });
    expect(await port.read()).toMatchObject({ state: 'queued', autoMerge: true, mergeQueue: null });
  });

  it('disables GitHub auto-merge with the named pull request', async () => {
    const { runner, calls } = githubRunner();
    const port = githubPullRequestPort({
      runner,
      repo: GITHUB_PR_REPO,
      prNumber: 318,
      prUrl: GITHUB_PR_URL,
    });
    await port.cancelAutoMerge?.();
    expect(calls).toEqual([['pr', 'merge', '318', '--disable-auto']]);
  });

  it.each([
    ['opened', true, 'queued'],
    ['opened', false, 'open'],
    ['locked', false, 'queued'],
    ['merged', true, 'merged'],
    ['closed', true, 'closed'],
  ] as const)('maps GitLab %s with auto-merge %s to %s', (state, isAutoMerge, expected) => {
    expect(gitlabStateKindOf({ state, draft: false, mergeWhenPipelineSucceeds: isAutoMerge })).toBe(
      expected,
    );
  });

  it('reads GitLab auto-merge and cancels it through the transport', async () => {
    const { transport } = fakeGitlabTransport({
      mr: { ...MR_JSON, mergeWhenPipelineSucceeds: true },
    });
    const port = gitlabPullRequestPort({ transport, mrUrl: MR_JSON.webUrl });
    expect(await port.read()).toMatchObject({ state: 'queued', autoMerge: true });
    await port.cancelAutoMerge?.();
    expect(transport.cancelAutoMerge).toHaveBeenCalledOnce();
  });

  it.each(['github', 'gitlab', 'bitbucket', 'local'] as const)(
    'gates cancellation on %s capability',
    (host) => {
      expect(REVIEW_SOURCE_CAPABILITIES[host].canCancelAutoMerge).toBe(
        host === 'github' || host === 'gitlab',
      );
    },
  );
});
