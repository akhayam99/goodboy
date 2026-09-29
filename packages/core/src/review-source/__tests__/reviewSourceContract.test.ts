import { describe, expect, it, vi } from 'vitest';
import type { GhResult, GhRunner } from '../../github/gh';
import { githubReviewSource } from '../githubReviewSource';
import {
  gitlabReviewSource,
  type GitlabReviewDiscussion,
  type GitlabReviewTransport,
} from '../gitlabReviewSource';
import type { ReviewSource } from '../types';

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
      if (args[0] === 'pr' && args[1] === 'view' && joined.includes('headRefOid')) {
        return jsonOk({ headRefOid: 'abc1234' });
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
    }),
    openThreadId: 'gitlab:d41',
    providerThreadId: 'd41',
    head: 'def5678',
    commitUrl: 'https://gitlab.example.com/harborline/notify-relay/-/commit/def5678',
    replyCalls: () => replies,
    resolveCalls: () => resolves,
  };
};

const SOURCES: ReadonlyArray<readonly [string, () => Fake]> = [
  ['github', githubFake],
  ['gitlab', gitlabFake],
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

  it('resolves the provider thread', async () => {
    const fake = build();
    const result = await fake.source.resolve({ providerThreadId: fake.providerThreadId });
    expect(result.isResolved).toBe(true);
    expect(fake.resolveCalls()).toContain(fake.providerThreadId);
  });

  it('reads the remote head and links a commit', async () => {
    const fake = build();
    expect(await fake.source.readRemoteHead()).toBe(fake.head);
    expect(fake.source.commitLink({ sha: fake.head })).toBe(fake.commitUrl);
  });

  it('can reply and resolve', () => {
    expect(build().source.capabilities).toEqual({ canReply: true, canResolve: true });
  });
});
