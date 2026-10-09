import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  PrComment,
  ProjectId,
  ResolveThread,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { BitbucketPullRequest } from '../../../features/integrations/bitbucket/client';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import { useAppStore, type AppStore } from '../../store';
import type { MountGithubState } from '../../types';
import type { MountBitbucketPrState } from '../bitbucket-pr/state';
import { activeReviewSourceOf, selectedReviewEntryOf } from './activeReviewSource';
import { reviewSourceEntriesOf } from './reviewSourceEntries';
import { rowBelongsToSource } from './rowBelongsToSource';
import type { ReviewSourceEntry } from './types';

const SESSION = 'session' as SessionId;
const GITHUB_URL = 'https://example.invalid/harborline/payments-api/pull/318';
const GITLAB_URL = 'https://example.invalid/harborline/notify-relay/-/merge_requests/57';

const BITBUCKET_URL = 'https://example.invalid/northwind/storefront-web/pull-requests/12';

const BITBUCKET_MOUNT_ID = 'bbmount' as MountId;
const BITBUCKET_PROJECT_ID = 'bbproject' as ProjectId;
const WORKSPACE_ID = 'workspace' as WorkspaceId;
const STAMP = '2026-09-04T14:20:00.000Z' as IsoDateTime;
const LEDGER = 'ledger' as MountId;
const RELAY = 'relay' as MountId;

const BITBUCKET_PR: BitbucketPullRequest = {
  id: 12,
  title: 'Recompute the cart total',
  description: '',
  state: 'OPEN',
  createdOn: STAMP,
  updatedOn: STAMP,
  sourceBranch: 'nw/cart-total',
  sourceCommit: null,
  destinationBranch: 'main',
  destinationCommit: null,
  author: null,
  reviewers: [],
  participants: [],
  closeSourceBranch: false,
  mergeCommit: null,
  commentCount: 0,
  taskCount: 0,
  webUrl: BITBUCKET_URL,
};

const BITBUCKET_MOUNT: MountBitbucketPrState = {
  mountId: BITBUCKET_MOUNT_ID,
  projectId: BITBUCKET_PROJECT_ID,
  revision: 1,
  host: null,
  repo: {
    workspaceId: WORKSPACE_ID,
    workspaceSlug: 'northwind',
    repoSlug: 'storefront-web',
    email: 'ops@northwind.example',
  },
  repository: 'northwind/storefront-web',
  branch: 'nw/cart-total',
  pr: BITBUCKET_PR,
  prs: [],
  links: [],
  checks: null,
  reviewDecision: null,
  fetchedAt: null,
  loading: false,
  error: null,
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

const comment = (threadId: string): PrComment => ({
  id: threadId,
  author: 'theo-v',
  authorAvatarUrl: null,
  body: 'Cap it',
  createdAt: '2026-09-04T10:00:00.000Z',
  url: '',
  source: 'review',
  path: 'src/a.ts',
  line: 1,
  resolved: false,
  threadId,
});

const stateWith = (overrides: Partial<AppStore> = {}): AppStore => ({
  ...useAppStore.getInitialState(),
  sessions: [],
  projects: [],
  sessionProjectMounts: {},
  sessionActiveProject: {},
  sessionActiveMount: {},
  sessionGithub: {
    [SESSION]: {
      pr: {
        number: 318,
        title: 'Guard the settlement batch',
        url: GITHUB_URL,
        state: 'open',
        mergeable: true,
        checks: 'success',
        baseBranch: 'main',
        headBranch: 'hl/fix',
        isDraft: false,
        reviewDecision: null,
        body: '',
        updatedAt: STAMP,
      },
      linkedIssues: [],
      fetchedAt: null,
      failedAt: null,
      loading: false,
      error: null,
      detail: {
        prNumber: 318,
        comments: [comment('PRRT_1'), comment('PRRT_2')],
        reviews: [],
        reviewRequests: [],
        checks: [],
      },
      detailFetchedAt: null,
      detailLoading: false,
      detailError: null,
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
        fetchedAt: STAMP,
        loading: false,
        error: null,
      },
    },
  },
  reviewSourceKeys: {},
  ...overrides,
});

describe('review sources of a session', () => {
  it('lists the pull request and the merge request with open counts, never the notes', () => {
    const entries = reviewSourceEntriesOf({ state: stateWith(), sessionId: SESSION });
    expect(entries.map((entry) => [entry.kind, entry.label, entry.openCount])).toEqual([
      ['github', 'payments-api #318', 2],
      ['gitlab', 'notify-relay !57', 1],
    ]);
  });

  it('keeps the notes out of the list whatever notes the session holds', () => {
    const note = {
      id: 'n1',
      sessionId: SESSION,
      filePath: 'src/a.ts',
      body: 'Cap it',
      status: 'open',
      createdAt: STAMP,
      authorKind: 'user',
    } as const;
    const state = stateWith({ diffComments: { [SESSION]: [note] } });
    expect(
      reviewSourceEntriesOf({ state, sessionId: SESSION }).some(
        (entry) => (entry.kind as string) === 'local',
      ),
    ).toBe(false);
    expect(
      reviewSourceEntriesOf({
        state: stateWith({
          sessionGithub: {},
          sessionGitlabMr: {},
          diffComments: state.diffComments,
        }),
        sessionId: SESSION,
      }),
    ).toEqual([]);
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

  it('ignores a stored pick that is no longer a request and reads the pull request', () => {
    const state = stateWith({ reviewSourceKeys: { [SESSION]: 'local' } });
    expect(activeReviewSourceOf({ state, sessionId: SESSION })?.kind).toBe('github');
    expect(selectedReviewEntryOf({ state, sessionId: SESSION })?.kind).toBe('github');
  });

  it('selects nothing when the session has no request', () => {
    const state = stateWith({ sessionGithub: {}, sessionGitlabMr: {} });
    expect(selectedReviewEntryOf({ state, sessionId: SESSION })).toBeNull();
    expect(activeReviewSourceOf({ state, sessionId: SESSION })).toBeNull();
  });

  it('lists one pull request for each of two mounts and no notes among them', () => {
    const mountOf = (id: string, name: string) => ({
      id: id as MountId,
      sessionId: SESSION,
      projectId: `${id}-project` as ProjectId,
      worktreePath: `/repo/${name}`,
      lastWorktreePath: null,
      branch: `hl/${name}`,
      baseBranch: 'main',
      parallelIndex: 0,
      mountName: name,
      repoSlug: null,
      isAttached: true,
      diskState: 'present' as const,
      revision: 1,
      createdAt: STAMP,
      updatedAt: STAMP,
      repoRoot: `/repo/${name}`,
    });
    const githubOf = (id: string, number: number): MountGithubState => ({
      mountId: id as MountId,
      projectId: `${id}-project` as ProjectId,
      revision: 1,
      repository: null,
      host: null,
      branch: `hl/${id}`,
      prs: [],
      links: [],
      pr: {
        number,
        title: 'Guard the batch',
        url: `https://example.invalid/harborline/${id}/pull/${number}`,
        state: 'open',
        mergeable: true,
        checks: 'success',
        baseBranch: 'main',
        headBranch: `hl/${id}`,
        isDraft: false,
        reviewDecision: null,
        body: '',
        updatedAt: STAMP,
      },
      linkedIssues: [],
      fetchedAt: null,
      failedAt: null,
      loading: false,
      error: null,
      detail: null,
      detailFetchedAt: null,
      detailLoading: false,
      detailError: null,
    });
    const state = stateWith({
      sessionGithub: {},
      sessionGitlabMr: {},
      sessionMounts: {
        [SESSION]: [mountOf('ledger', 'ledger-core'), mountOf('relay', 'notify-relay')],
      },
      mountGithub: {
        [LEDGER]: githubOf('ledger', 31),
        [RELAY]: githubOf('relay', 32),
      },
    });
    const entries = reviewSourceEntriesOf({ state, sessionId: SESSION });
    expect(entries.map((entry) => [entry.kind, entry.number])).toEqual([
      ['github', 31],
      ['github', 32],
    ]);
    expect(selectedReviewEntryOf({ state, sessionId: SESSION })?.kind).toBe('github');
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
  const bitbucketState = (overrides: Partial<AppStore> = {}) =>
    stateWith({
      sessionGithub: {},
      sessionGitlabMr: {},
      sessionBitbucketPr: {
        [SESSION]: { pr: BITBUCKET_PR, fetchedAt: null, loading: false, error: null },
      },
      sessionMounts: {
        [SESSION]: [
          {
            id: BITBUCKET_MOUNT_ID,
            sessionId: SESSION,
            projectId: BITBUCKET_PROJECT_ID,
            worktreePath: null,
            lastWorktreePath: null,
            branch: 'nw/cart-total',
            baseBranch: 'main',
            parallelIndex: 0,
            mountName: 'storefront-web',
            repoSlug: null,
            isAttached: true,
            diskState: 'present',
            revision: 1,
            createdAt: STAMP,
            updatedAt: STAMP,
            repoRoot: '/repo',
          },
        ],
      },
      mountBitbucketPr: { [BITBUCKET_MOUNT_ID]: BITBUCKET_MOUNT },
      reviewSourceThreads: {
        [SESSION]: {
          [BITBUCKET_URL]: {
            comments: [comment('bitbucket:4001'), comment('bitbucket:4002')],
            fetchedAt: STAMP,
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
    ]);
  });

  it('reads the pull request comments and says it cannot resolve', () => {
    const source = activeReviewSourceOf({ state: bitbucketState(), sessionId: SESSION });
    expect(source?.kind).toBe('bitbucket');
    expect(source?.prNumber).toBe(12);
    expect(source?.repo).toBe('northwind/storefront-web');
    expect(source?.headBranch).toBe('nw/cart-total');
    expect(source?.comments).toHaveLength(2);
    expect(source?.capabilities).toMatchObject({ canReply: true, canResolve: false });
  });

  it('leaves a merged pull request out of the picker', () => {
    const state = bitbucketState({
      mountBitbucketPr: {
        [BITBUCKET_MOUNT_ID]: {
          ...BITBUCKET_MOUNT,
          pr: { ...BITBUCKET_PR, state: 'MERGED' },
        },
      },
    });
    expect(reviewSourceEntriesOf({ state, sessionId: SESSION })).toEqual([]);
  });
});

describe('rowBelongsToSource', () => {
  it('keeps a row on the source it was created for', () => {
    const github = { kind: 'github', projectId: null, number: 318 } as const;
    const gitlab = { kind: 'gitlab', projectId: null, number: 57 } as const;
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
    expect(rowBelongsToSource({ row: row({ originKind: 'diff_comment' }), entry: github })).toBe(
      false,
    );
    expect(
      rowBelongsToSource({
        row: row({ originKind: 'diff_comment', sourceKind: 'local' }),
        entry: gitlab,
      }),
    ).toBe(false);
  });

  it('separates two requests with the same number in different projects', () => {
    const entry: Pick<ReviewSourceEntry, 'kind' | 'projectId' | 'number'> = {
      kind: 'github',
      projectId: 'p2' as ProjectId,
      number: 318,
    };
    expect(rowBelongsToSource({ row: row({ projectId: 'p1' as ProjectId }), entry })).toBe(false);
  });
});
