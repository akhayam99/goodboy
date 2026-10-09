import { describe, expect, it, vi } from 'vitest';
import type { GhResult, GhRunner } from '../../github/gh';
import {
  BITBUCKET_NO_RESOLVE,
  bitbucketReviewSource,
  type BitbucketReviewComment,
  type BitbucketReviewTransport,
} from '../bitbucketReviewSource';
import { githubReviewSource } from '../githubReviewSource';
import { PULL_REQUEST_CAPABILITY_METHODS, type PullRequestCapability } from '../pullRequestPort';
import { PR_VIEW_JSON } from './githubPullRequestFixture';
import { fakeGitlabTransport } from './gitlabPullRequestFixture';
import {
  gitlabReviewSource,
  type GitlabReviewDiscussion,
  type GitlabReviewTransport,
} from '../gitlabReviewSource';
import { REVIEW_SOURCE_CAPABILITIES, type ReviewSource } from '../types';

const jsonOk = (data: unknown): GhResult => ({
  stdout: JSON.stringify(data),
  stderr: '',
  exitCode: 0,
});

type Fake = Readonly<{
  source: ReviewSource;
  openThreadId: string;
  providerThreadId: string;
  head: string;
  commitUrl: string;
  canResolve: boolean;
  replyCalls: () => ReadonlyArray<string>;
  resolveCalls: () => ReadonlyArray<string>;
}>;

const threadIdsOf = ({
  calls,
  mutation,
}: {
  readonly calls: ReadonlyArray<ReadonlyArray<string>>;
  readonly mutation: string;
}): ReadonlyArray<string> =>
  calls
    .filter((args) => args.join(' ').includes(mutation))
    .flatMap((args) => args.filter((arg) => arg.startsWith('threadId=')))
    .map((arg) => arg.slice('threadId='.length));

const githubFake = (): Fake => {
  const calls: Array<ReadonlyArray<string>> = [];
  const runner: GhRunner = {
    run: vi.fn(async (args: ReadonlyArray<string>) => {
      calls.push(args);
      const joined = args.join(' ');
      if (joined.includes('issues/318/comments')) {
        return jsonOk([]);
      }
      if (joined.includes('resolveReviewThread')) {
        return jsonOk({
          data: { resolveReviewThread: { thread: { id: 'PRT_1', isResolved: true } } },
        });
      }
      if (joined.includes('addPullRequestReviewThreadReply')) {
        return jsonOk({
          data: { addPullRequestReviewThreadReply: { comment: { id: 'PRRC_9', url: 'u' } } },
        });
      }
      if (args[0] === 'api' && args[1] === 'graphql') {
        return jsonOk({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  nodes: [
                    {
                      id: 'PRT_1',
                      isResolved: false,
                      isOutdated: false,
                      path: 'src/webhooks/retryPolicy.ts',
                      line: 42,
                      comments: {
                        nodes: [
                          {
                            id: 'PRRC_1',
                            databaseId: 200,
                            author: { login: 'mara', avatarUrl: null },
                            body: 'Cap the retries',
                            createdAt: '2026-01-02T10:00:00Z',
                            url: 'https://github.com/harborline/payments-api/pull/318#discussion_r200',
                            replyTo: null,
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        });
      }
      if (args[0] === 'pr' && args[1] === 'view' && joined.includes('closingIssuesReferences')) {
        return jsonOk(PR_VIEW_JSON);
      }
      if (args[0] === 'pr' && args[1] === 'view' && joined.includes('headRefOid')) {
        return jsonOk({ headRefOid: 'abc1234' });
      }
      if (args[0] === 'repo') {
        return jsonOk({ squashMergeAllowed: true });
      }
      if (args[0] === 'pr') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      return jsonOk({ reviews: [], reviewRequests: [], statusCheckRollup: [] });
    }),
  };
  return {
    source: githubReviewSource({
      runner,
      repo: 'harborline/payments-api',
      prNumber: 318,
      prUrl: 'https://github.com/harborline/payments-api/pull/318',
    }),
    openThreadId: 'PRT_1',
    providerThreadId: 'PRT_1',
    head: 'abc1234',
    commitUrl: 'https://github.com/harborline/payments-api/commit/abc1234',
    canResolve: true,
    replyCalls: () => threadIdsOf({ calls, mutation: 'addPullRequestReviewThreadReply' }),
    resolveCalls: () => threadIdsOf({ calls, mutation: 'resolveReviewThread' }),
  };
};

const discussion = ({ resolved }: { readonly resolved: boolean }): GitlabReviewDiscussion => ({
  id: 'd41',
  individualNote: false,
  notes: [
    {
      id: 900,
      body: 'Retry the send when the provider returns a 503',
      system: false,
      author: { username: 'theo', name: 'Theo Varga', avatarUrl: null },
      createdAt: '2026-01-02T10:00:00Z',
      resolvable: true,
      resolved,
      position: {
        newPath: 'src/relay/dispatch.ts',
        oldPath: 'src/relay/dispatch.ts',
        newLine: 64,
        oldLine: null,
      },
    },
    {
      id: 901,
      body: 'assigned to me',
      system: true,
      author: null,
      createdAt: '2026-01-02T10:05:00Z',
      resolvable: false,
      resolved: null,
      position: null,
    },
  ],
});

const gitlabFake = (): Fake => {
  const replies: Array<string> = [];
  const resolves: Array<string> = [];
  const transport: GitlabReviewTransport = {
    listDiscussions: async () => [
      discussion({ resolved: false }),
      {
        id: 'plain',
        individualNote: true,
        notes: [
          {
            id: 1,
            body: 'looks good',
            system: false,
            author: null,
            createdAt: '2026-01-01T10:00:00Z',
            resolvable: false,
            resolved: null,
            position: null,
          },
        ],
      },
    ],
    replyToDiscussion: async ({ discussionId }) => {
      replies.push(discussionId);
      return 902;
    },
    resolveDiscussion: async ({ discussionId }) => {
      resolves.push(discussionId);
      return discussion({ resolved: true });
    },
    readHeadSha: async () => 'def5678',
  };
  return {
    source: gitlabReviewSource({
      transport,
      mrUrl: 'https://gitlab.example.com/harborline/notify-relay/-/merge_requests/57',
      pullRequestTransport: fakeGitlabTransport().transport,
    }),
    openThreadId: 'gitlab:d41',
    providerThreadId: 'd41',
    head: 'def5678',
    commitUrl: 'https://gitlab.example.com/harborline/notify-relay/-/commit/def5678',
    canResolve: true,
    replyCalls: () => replies,
    resolveCalls: () => resolves,
  };
};

const bitbucketComment = (
  overrides: Partial<BitbucketReviewComment> = {},
): BitbucketReviewComment => ({
  id: 4001,
  body: 'Guard the empty cart before the total',
  user: { nickname: 'ines', displayName: 'Ines Okafor', avatarUrl: null },
  createdOn: '2026-01-02T10:00:00Z',
  deleted: false,
  parentId: null,
  inline: { path: 'src/cart/total.ts', from: null, to: 33 },
  webUrl: 'https://bitbucket.org/northwind/storefront-web/pull-requests/12#comment-4001',
  ...overrides,
});

const bitbucketFake = (): Fake => {
  const replies: Array<string> = [];
  const transport: BitbucketReviewTransport = {
    listComments: async () => [
      bitbucketComment(),
      bitbucketComment({ id: 4002, parentId: 4001, inline: null, body: 'On it' }),
      bitbucketComment({ id: 4003, inline: null, body: 'Looks good overall' }),
    ],
    replyToComment: async ({ parentCommentId }) => {
      replies.push(String(parentCommentId));
      return 4004;
    },
    readHeadSha: async () => '9a8b7c6',
  };
  return {
    source: bitbucketReviewSource({
      transport,
      prUrl: 'https://bitbucket.org/northwind/storefront-web/pull-requests/12',
    }),
    openThreadId: 'bitbucket:4001',
    providerThreadId: '4001',
    head: '9a8b7c6',
    commitUrl: 'https://bitbucket.org/northwind/storefront-web/commits/9a8b7c6',
    canResolve: false,
    replyCalls: () => replies,
    resolveCalls: () => [],
  };
};

const SOURCES: ReadonlyArray<readonly [string, () => Fake]> = [
  ['github', githubFake],
  ['gitlab', gitlabFake],
  ['bitbucket', bitbucketFake],
];

describe.each(SOURCES)('review source contract on %s', (_name, build) => {
  it('lists the open review threads with their provider ids', async () => {
    const fake = build();
    const threads = await fake.source.listThreads();
    expect(threads.map((thread) => thread.threadId)).toEqual([fake.openThreadId]);
    expect(threads[0]?.providerThreadId).toBe(fake.providerThreadId);
    expect(threads[0]?.isResolved).toBe(false);
  });

  it('carries the file and line of the head comment', async () => {
    const [thread] = await build().source.listThreads();
    expect(thread?.comments[0]?.source).toBe('review');
    expect(thread?.comments[0]?.path).toMatch(/^src\//);
    expect(thread?.comments[0]?.line).toBeGreaterThan(0);
  });

  it('replies on the provider thread and returns the new comment id', async () => {
    const fake = build();
    const reply = await fake.source.reply({
      providerThreadId: fake.providerThreadId,
      body: 'Fixed in the next push',
    });
    expect(reply.id).not.toBe('');
    expect(fake.replyCalls()).toContain(fake.providerThreadId);
  });

  it('resolves the provider thread only where the provider can', async () => {
    const fake = build();
    if (!fake.canResolve) {
      await expect(
        fake.source.resolve({ providerThreadId: fake.providerThreadId }),
      ).rejects.toThrow(BITBUCKET_NO_RESOLVE);
      expect(fake.resolveCalls()).toEqual([]);
      return;
    }
    const result = await fake.source.resolve({ providerThreadId: fake.providerThreadId });
    expect(result.isResolved).toBe(true);
    expect(fake.resolveCalls()).toContain(fake.providerThreadId);
  });

  it('reads the remote head and links a commit', async () => {
    const fake = build();
    expect(await fake.source.readRemoteHead()).toBe(fake.head);
    expect(fake.source.commitLink({ sha: fake.head })).toBe(fake.commitUrl);
  });

  it('states what it can do', () => {
    const fake = build();
    expect(fake.source.capabilities).toEqual(REVIEW_SOURCE_CAPABILITIES[fake.source.kind]);
    expect(fake.source.capabilities.canResolve).toBe(fake.canResolve);
  });

  it('backs every pull request flag that is true with a port method it can run', async () => {
    const { source } = build();
    const flags = Object.keys(
      PULL_REQUEST_CAPABILITY_METHODS,
    ) as ReadonlyArray<PullRequestCapability>;
    const claimed = flags.filter((flag) => source.capabilities[flag]);
    if (claimed.length > 0) {
      expect(source.pullRequest).not.toBeNull();
    }
    for (const flag of claimed) {
      const port = source.pullRequest;
      if (port === null) {
        continue;
      }
      const calls: Readonly<Record<PullRequestCapability, () => Promise<unknown>>> = {
        canEditTitle: () => port.updateTitle({ title: 'Retitled' }),
        canEditBody: () => port.updateBody({ body: 'Rewritten' }),
        canRequestReviewers: () => port.requestReviewers({ logins: ['kenji-w'] }),
        canSetDraft: () => port.setDraft({ isDraft: false }),
        canReadChecks: async () => (await port.read()).checks,
        canChooseMergeMethod: () => port.merge({ method: 'squash' }),
        canClose: () => port.close(),
        canReopen: () => port.reopen(),
      };
      await expect(calls[flag]()).resolves.not.toThrow();
      expect(typeof port[PULL_REQUEST_CAPABILITY_METHODS[flag]]).toBe('function');
    }
  });

  it('has no port to write with when it claims nothing', () => {
    const { source } = build();
    const flags = Object.keys(
      PULL_REQUEST_CAPABILITY_METHODS,
    ) as ReadonlyArray<PullRequestCapability>;
    if (flags.every((flag) => !source.capabilities[flag])) {
      expect(source.pullRequest === null || typeof source.pullRequest.read === 'function').toBe(
        true,
      );
    }
  });
});
