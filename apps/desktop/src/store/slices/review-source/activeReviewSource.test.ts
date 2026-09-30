import { describe, expect, it } from 'vitest';
import type { ResolveThread, SessionId } from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import { activeReviewSourceOf, selectedReviewEntryOf } from './activeReviewSource';
import { reviewSourceEntriesOf } from './reviewSourceEntries';
import { rowBelongsToSource } from './rowBelongsToSource';

const SESSION = 'session' as SessionId;
const GITHUB_URL = 'https://example.invalid/harborline/payments-api/pull/318';
const GITLAB_URL = 'https://example.invalid/harborline/notify-relay/-/merge_requests/57';

const BITBUCKET_URL = 'https://example.invalid/northwind/storefront-web/pull-requests/12';

const BITBUCKET_MOUNT = {
  mountId: 'bbmount',
  projectId: 'bbproject',
  repo: { workspaceSlug: 'northwind', repoSlug: 'storefront-web' },
  repository: 'northwind/storefront-web',
  pr: { id: 12, state: 'OPEN', sourceBranch: 'nw/cart-total', webUrl: BITBUCKET_URL },
  prs: [],
};

const MR: GitlabMergeRequest = {
  id: 1,
  iid: 57,
  projectId: 1,
  title: 'Retry on 503',
  description: null,
  state: 'opened',
  webUrl: GITLAB_URL,
  sourceBranch: 'hl/relay-retry',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: '2026-09-04T14:20:00.000Z',
};

const comment = (threadId: string) => ({
  id: threadId,
  author: 'theo-v',
  authorAvatarUrl: null,
  body: 'Cap it',
  createdAt: '2026-09-04T10:00:00.000Z',
  url: '',
  source: 'review' as const,
  path: 'src/a.ts',
  line: 1,
  resolved: false,
  threadId,
});

const stateWith = (overrides: Record<string, unknown> = {}) =>
  ({
    sessions: [],
    projects: [],
    sessionProjectMounts: {},
    sessionMounts: undefined,
    sessionActiveProject: {},
    sessionActiveMount: {},
    sessionGithub: {
      [SESSION]: {
        pr: { number: 318, url: GITHUB_URL, headBranch: 'hl/fix' },
        detail: { comments: [comment('PRRT_1'), comment('PRRT_2')] },
        detailLoading: false,
        detailError: null,
        detailFetchedAt: null,
      },
    },
    sessionGitlabMr: { [SESSION]: { mr: MR, fetchedAt: null, loading: false, error: null } },
    mountGithub: {},
    mountGitlabMr: {},
    mountBitbucketPr: {},
    sessionBitbucketPr: {},
    diffComments: {},
    reviewSourceThreads: {
      [SESSION]: {
        [GITLAB_URL]: {
          comments: [comment('gitlab:d1')],
          fetchedAt: '2026-09-04T14:20:00.000Z',
          loading: false,
          error: null,
        },
      },
    },
    reviewSourceKeys: {},
    ...overrides,
  }) as unknown as Parameters<typeof reviewSourceEntriesOf>[0]['state'] &
    Parameters<typeof selectedReviewEntryOf>[0]['state'];

describe('review sources of a session', () => {
  it('lists the pull request, the merge request and the notes with open counts', () => {
    const entries = reviewSourceEntriesOf({ state: stateWith(), sessionId: SESSION });
    expect(entries.map((entry) => [entry.kind, entry.label, entry.openCount])).toEqual([
      ['github', 'payments-api #318', 2],
      ['gitlab', 'notify-relay !57', 1],
      ['local', 'Notes on this machine', 0],
    ]);
  });

  it('reads the github pull request by default and its comments', () => {
    const source = activeReviewSourceOf({ state: stateWith(), sessionId: SESSION });
    expect(source?.kind).toBe('github');
    expect(source?.comments).toHaveLength(2);
    expect(source?.capabilities.canResolve).toBe(true);
  });

  it('reads the gitlab merge request once it is picked', () => {
    const state = stateWith({ reviewSourceKeys: { [SESSION]: 'gitlab:session:57' } });
    const source = activeReviewSourceOf({ state, sessionId: SESSION });
    expect(source?.kind).toBe('gitlab');
    expect(source?.prNumber).toBe(57);
    expect(source?.repo).toBe('harborline/notify-relay');
    expect(source?.headBranch).toBe('hl/relay-retry');
    expect(source?.comments.map((item) => item.threadId)).toEqual(['gitlab:d1']);
  });

  it('has no remote source when the notes are picked', () => {
    const state = stateWith({ reviewSourceKeys: { [SESSION]: 'local' } });
    expect(activeReviewSourceOf({ state, sessionId: SESSION })).toBeNull();
    expect(selectedReviewEntryOf({ state, sessionId: SESSION }).kind).toBe('local');
  });

  it('falls back to the notes when the session has no request', () => {
    const state = stateWith({ sessionGithub: {}, sessionGitlabMr: {} });
    expect(selectedReviewEntryOf({ state, sessionId: SESSION }).kind).toBe('local');
  });
});

const row = (overrides: Partial<ResolveThread>): ResolveThread =>
  ({
    threadId: 'PRRT_1',
    originKind: 'review_comment',
    projectId: null,
    prNumber: 318,
    ...overrides,
  }) as ResolveThread;

describe('bitbucket as a review source', () => {
  const bitbucketState = (overrides: Record<string, unknown> = {}) =>
    stateWith({
      sessionGithub: {},
      sessionGitlabMr: {},
      sessionBitbucketPr: { [SESSION]: { pr: BITBUCKET_MOUNT.pr } },
      sessionProjectMounts: { [SESSION]: ['bbmount'] },
      sessionMounts: {
        [SESSION]: [
          {
            id: 'bbmount',
            projectId: 'bbproject',
            branch: 'nw/cart-total',
            baseBranch: 'main',
            repoRoot: '/repo',
            worktreePath: null,
            repoSlug: null,
            revision: 1,
          },
        ],
      },
      mountBitbucketPr: { bbmount: BITBUCKET_MOUNT },
      reviewSourceThreads: {
        [SESSION]: {
          [BITBUCKET_URL]: {
            comments: [comment('bitbucket:4001'), comment('bitbucket:4002')],
            fetchedAt: '2026-09-04T14:20:00.000Z',
            loading: false,
            error: null,
          },
        },
      },
      ...overrides,
    });

  it('lists the pull request with its open count', () => {
    const entries = reviewSourceEntriesOf({ state: bitbucketState(), sessionId: SESSION });
    expect(entries.map((entry) => [entry.kind, entry.label, entry.openCount])).toEqual([
      ['bitbucket', 'storefront-web #12', 2],
      ['local', 'Notes on this machine', 0],
    ]);
  });

  it('reads the pull request comments and says it cannot resolve', () => {
    const source = activeReviewSourceOf({ state: bitbucketState(), sessionId: SESSION });
    expect(source?.kind).toBe('bitbucket');
    expect(source?.prNumber).toBe(12);
    expect(source?.repo).toBe('northwind/storefront-web');
    expect(source?.headBranch).toBe('nw/cart-total');
    expect(source?.comments).toHaveLength(2);
    expect(source?.capabilities).toEqual({ canReply: true, canResolve: false });
  });

  it('leaves a merged pull request out of the picker', () => {
    const state = bitbucketState({
      mountBitbucketPr: {
        bbmount: { ...BITBUCKET_MOUNT, pr: { ...BITBUCKET_MOUNT.pr, state: 'MERGED' } },
      },
    });
    expect(reviewSourceEntriesOf({ state, sessionId: SESSION }).map((entry) => entry.kind)).toEqual(
      ['local'],
    );
  });
});

describe('rowBelongsToSource', () => {
  it('keeps a row on the source it was created for', () => {
    const github = { kind: 'github', projectId: null, number: 318 } as const;
    const gitlab = { kind: 'gitlab', projectId: null, number: 57 } as const;
    const local = { kind: 'local', projectId: null, number: null } as const;
    const bitbucket = { kind: 'bitbucket', projectId: null, number: 12 } as const;
    expect(rowBelongsToSource({ row: row({}), entry: github })).toBe(true);
    expect(rowBelongsToSource({ row: row({}), entry: gitlab })).toBe(false);
    expect(
      rowBelongsToSource({ row: row({ sourceKind: 'gitlab', prNumber: 57 }), entry: gitlab }),
    ).toBe(true);
    expect(
      rowBelongsToSource({ row: row({ sourceKind: 'bitbucket', prNumber: 12 }), entry: bitbucket }),
    ).toBe(true);
    expect(rowBelongsToSource({ row: row({}), entry: bitbucket })).toBe(false);
    expect(rowBelongsToSource({ row: row({ originKind: 'diff_comment' }), entry: local })).toBe(
      true,
    );
    expect(rowBelongsToSource({ row: row({ originKind: 'diff_comment' }), entry: github })).toBe(
      false,
    );
  });

  it('separates two requests with the same number in different projects', () => {
    const entry = { kind: 'github', projectId: 'p2', number: 318 } as never;
    expect(rowBelongsToSource({ row: row({ projectId: 'p1' as never }), entry })).toBe(false);
  });
});
