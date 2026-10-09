import type { GhRunOptions, GhRunner } from '../github/gh';
import { runJson } from '../github/gh';
import { fetchPrDetail } from '../github/details';
import { addReviewThreadReply, resolveReviewThread } from '../github/mutations';
import { commitLinkOf } from './commitLink';
import { githubPullRequestPort } from './githubPullRequestPort';
import { groupReviewComments } from './groupReviewComments';
import { REVIEW_SOURCE_CAPABILITIES, type ReviewSource } from './types';

type Params = Readonly<{
  runner: GhRunner;
  repo: string;
  prNumber: number;
  prUrl: string | null;
  options?: GhRunOptions;
}>;

type RawHead = { readonly headRefOid?: string | null };

export const githubReviewSource = ({
  runner,
  repo,
  prNumber,
  prUrl,
  options = {},
}: Params): ReviewSource => ({
  kind: 'github',
  capabilities: REVIEW_SOURCE_CAPABILITIES.github,
  listThreads: async () => {
    const detail = await fetchPrDetail(runner, repo, prNumber, options);
    return groupReviewComments({
      comments: detail.comments,
      providerThreadIdOf: ({ threadId }) => threadId,
    });
  },
  reply: async ({ providerThreadId, body }) => {
    const posted = await addReviewThreadReply(runner, providerThreadId, body, options);
    return { id: posted.id };
  },
  resolve: async ({ providerThreadId }) => {
    const thread = await resolveReviewThread(runner, providerThreadId, options);
    return { isResolved: thread.isResolved };
  },
  readRemoteHead: async () => {
    const raw = await runJson<RawHead>({
      runner,
      args: ['pr', 'view', String(prNumber), '--repo', repo, '--json', 'headRefOid'],
      opts: options,
      shape: 'object',
    });
    return raw.headRefOid ?? null;
  },
  commitLink: ({ sha }) => commitLinkOf({ kind: 'github', url: prUrl, sha }),
  pullRequest: githubPullRequestPort({ runner, repo, prNumber, prUrl, options }),
});
