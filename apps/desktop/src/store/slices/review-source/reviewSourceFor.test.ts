import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolveThread, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  ghCalls: [] as Array<ReadonlyArray<string>>,
  gitlabReplies: [] as Array<string>,
  gitlabResolves: [] as Array<string>,
  bitbucketReplies: [] as Array<number>,
}));

vi.mock('../../../features/integrations/bitbucket/client', () => ({
  bitbucketListPullRequestComments: vi.fn(async () => []),
  bitbucketGetPullRequest: vi.fn(async () => ({ sourceCommit: '9a8b7c6' })),
  bitbucketReplyToPullRequestComment: vi.fn(
    async ({ parentCommentId }: { readonly parentCommentId: number }) => {
      h.bitbucketReplies.push(parentCommentId);
      return { id: 4004 };
    },
  ),
}));

vi.mock('../../../features/github/github', () => ({
  tauriGhRunner: {
    run: vi.fn(async (args: ReadonlyArray<string>) => {
      h.ghCalls.push(args);
      const joined = args.join(' ');
      if (joined.includes('addPullRequestReviewThreadReply')) {
        return {
          stdout: JSON.stringify({
            data: { addPullRequestReviewThreadReply: { comment: { id: 'PRRC_9', url: 'u' } } },
          }),
          stderr: '',
          exitCode: 0,
        };
      }
      return {
        stdout: JSON.stringify({
          data: { resolveReviewThread: { thread: { id: 'PRRT_1', isResolved: true } } },
        }),
        stderr: '',
        exitCode: 0,
      };
    }),
  },
}));

vi.mock('../../../features/integrations/gitlab/client', () => ({
  gitlabListMrDiscussions: vi.fn(async () => []),
  gitlabMrDiffRefs: vi.fn(async () => ({ baseSha: 'a', headSha: 'def5678', startSha: 'a' })),
  gitlabReplyToMrDiscussion: vi.fn(async ({ discussionId }: { readonly discussionId: string }) => {
    h.gitlabReplies.push(discussionId);
    return 902;
  }),
  gitlabResolveMrDiscussion: vi.fn(async ({ discussionId }: { readonly discussionId: string }) => {
    h.gitlabResolves.push(discussionId);
    return {
      id: discussionId,
      individualNote: false,
      notes: [
        {
          id: 1,
          body: 'x',
          system: false,
          author: null,
          createdAt: '',
          resolvable: true,
          resolved: true,
          position: null,
        },
      ],
    };
  }),
}));

import { reviewSourceFor } from './reviewSourceFor';
import type { GetFn } from './types';

const SESSION = 'session' as SessionId;

const get = (() => ({
  sessions: [{ id: SESSION, workspaceId: 'workspace' }],
  sessionGithub: {},
  sessionGitlabMr: {},
  reviewSourceKeys: {},
  reviewSourceThreads: {},
  mountGithub: {},
  mountGitlabMr: {
    mount: {
      mountId: 'mount',
      projectId: 'project',
      host: 'https://gitlab.example.com',
      projectPath: 'harborline/notify-relay',
      mr: {
        iid: 57,
        webUrl: 'https://gitlab.example.com/harborline/notify-relay/-/merge_requests/57',
      },
    },
  },
  mountBitbucketPr: {
    bbmount: {
      mountId: 'bbmount',
      projectId: 'bbproject',
      repo: { workspaceSlug: 'northwind', repoSlug: 'storefront-web' },
      repository: 'northwind/storefront-web',
      pr: {
        id: 12,
        state: 'OPEN',
        sourceBranch: 'nw/cart-total',
        webUrl: 'https://bitbucket.org/northwind/storefront-web/pull-requests/12',
      },
      prs: [],
    },
  },
  diffComments: {},
  projects: [],
  sessionProjectMounts: {},
  sessionMounts: undefined,
  sessionActiveProject: {},
  sessionActiveMount: {},
  closeResolvedNote: vi.fn(async () => undefined),
})) as unknown as GetFn;

const row = (overrides: Partial<ResolveThread>): ResolveThread =>
  ({
    threadId: 'PRRT_1',
    originKind: 'review_comment',
    projectId: null,
    prNumber: 318,
    ...overrides,
  }) as ResolveThread;

beforeEach(() => {
  h.ghCalls.length = 0;
  h.gitlabReplies.length = 0;
  h.gitlabResolves.length = 0;
  h.bitbucketReplies.length = 0;
});

describe('reviewSourceFor', () => {
  it('talks to gh for a github thread', async () => {
    const source = reviewSourceFor({ get, sessionId: SESSION, row: row({}) });
    await source.reply({ providerThreadId: 'PRRT_1', body: 'Fixed' });
    const resolution = await source.resolve({ providerThreadId: 'PRRT_1' });
    expect(resolution.isResolved).toBe(true);
    expect(h.ghCalls.flat()).toContain('threadId=PRRT_1');
    expect(h.gitlabReplies).toEqual([]);
  });

  it('talks to the gitlab api for a merge request thread', async () => {
    const source = reviewSourceFor({
      get,
      sessionId: SESSION,
      row: row({ threadId: 'gitlab:d41', sourceKind: 'gitlab', prNumber: 57 }),
    });
    const reply = await source.reply({ providerThreadId: 'd41', body: 'Fixed' });
    const resolution = await source.resolve({ providerThreadId: 'd41' });
    expect(reply.id).toBe('902');
    expect(resolution.isResolved).toBe(true);
    expect(h.gitlabReplies).toEqual(['d41']);
    expect(h.gitlabResolves).toEqual(['d41']);
    expect(h.ghCalls).toEqual([]);
  });

  it('replies on a bitbucket pull request and refuses to resolve', async () => {
    const source = reviewSourceFor({
      get,
      sessionId: SESSION,
      row: row({ threadId: 'bitbucket:4001', sourceKind: 'bitbucket', prNumber: 12 }),
    });
    const reply = await source.reply({ providerThreadId: '4001', body: 'Fixed' });
    expect(reply.id).toBe('4004');
    expect(h.bitbucketReplies).toEqual([4001]);
    expect(source.capabilities).toEqual({ canReply: true, canResolve: false });
    await expect(source.resolve({ providerThreadId: '4001' })).rejects.toThrow();
    expect(await source.readRemoteHead()).toBe('9a8b7c6');
    expect(h.ghCalls).toEqual([]);
  });

  it('refuses a bitbucket thread whose pull request is not in the session', () => {
    expect(() =>
      reviewSourceFor({
        get,
        sessionId: SESSION,
        row: row({ threadId: 'bitbucket:1', sourceKind: 'bitbucket', prNumber: 999 }),
      }),
    ).toThrow();
  });

  it('closes a note on this machine and cannot reply to it', async () => {
    const source = reviewSourceFor({
      get,
      sessionId: SESSION,
      row: row({ threadId: 'note:1', originKind: 'diff_comment' }),
    });
    expect(source.kind).toBe('local');
    expect(source.capabilities.canReply).toBe(false);
  });

  it('refuses a gitlab thread whose merge request is not in the session', async () => {
    expect(() =>
      reviewSourceFor({
        get,
        sessionId: SESSION,
        row: row({ threadId: 'gitlab:d1', sourceKind: 'gitlab', prNumber: 999 }),
      }),
    ).toThrow();
  });
});
