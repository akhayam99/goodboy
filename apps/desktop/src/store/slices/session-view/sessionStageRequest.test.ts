// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  MountPullRequestLink,
  MountPullRequestProvider,
  ProjectId,
  PullRequestState,
  SessionId,
  SessionMountView,
} from '@goodboy/types';
import type { MountGithubState } from '../../types';
import { sessionStageRequestOf } from './sessionStageRequest';

const SESSION = 'session-harborline' as SessionId;
const PROJECT = 'project-payments-api' as ProjectId;
const DATE = '2026-10-07T09:00:00.000Z' as IsoDateTime;

const mountIdOf = (slug: string) => `mount-${slug}` as MountId;

const viewOf = (slug: string): SessionMountView => ({
  id: mountIdOf(slug),
  sessionId: SESSION,
  projectId: PROJECT,
  worktreePath: `/tmp/payments-api/${slug}`,
  lastWorktreePath: null,
  branch: `harborline/${slug}`,
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: 'payments-api',
  repoSlug: null,
  repoRoot: '/tmp/payments-api',
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: DATE,
  updatedAt: DATE,
});

const githubOf = ({
  slug,
  number,
  over,
}: {
  readonly slug: string;
  readonly number: number;
  readonly over: Partial<PullRequestState>;
}): MountGithubState => {
  const pr: PullRequestState = {
    number,
    title: 'Retry webhooks',
    url: `https://github.com/harborline/payments-api/pull/${number}`,
    state: 'open',
    mergeable: true,
    checks: 'success',
    baseBranch: 'main',
    headBranch: `harborline/${slug}`,
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: DATE,
    ...over,
  };
  return {
    pr,
    linkedIssues: [],
    fetchedAt: DATE,
    failedAt: null,
    loading: false,
    error: null,
    detail: null,
    detailFetchedAt: null,
    detailLoading: false,
    detailError: null,
    mountId: mountIdOf(slug),
    projectId: PROJECT,
    revision: 1,
    repository: 'harborline/payments-api',
    host: 'github.com',
    branch: `harborline/${slug}`,
    prs: [pr],
    links: [],
  };
};

type Seed = {
  readonly slug: string;
  readonly number: number;
  readonly over: Partial<PullRequestState>;
};

const stateOf = (seeds: ReadonlyArray<Seed>) => ({
  sessionMounts: { [SESSION]: seeds.map((seed) => viewOf(seed.slug)) },
  mountGithub: Object.fromEntries(
    seeds.map((seed) => [mountIdOf(seed.slug), githubOf(seed)] as const),
  ),
  mountRequests: {},
});

const QUEUED: Seed = {
  slug: 'queued',
  number: 327,
  over: { state: 'queued', reviewDecision: 'approved' },
};
const IN_REVIEW: Seed = { slug: 'review', number: 330, over: {} };
const APPROVED: Seed = {
  slug: 'approved',
  number: 331,
  over: { state: 'approved', reviewDecision: 'approved' },
};
const MERGED: Seed = { slug: 'merged', number: 304, over: { state: 'merged' } };

const labelOf = (seeds: ReadonlyArray<Seed>): string | null =>
  sessionStageRequestOf({ state: stateOf(seeds), sessionId: SESSION })?.requestLabel ?? null;

describe('sessionStageRequestOf', () => {
  it('lets a mount still in review speak for the session ahead of one in the merge queue', () => {
    expect(labelOf([QUEUED, IN_REVIEW])).toBe('PR #330');
    expect(labelOf([IN_REVIEW, QUEUED])).toBe('PR #330');
  });

  it('lets an approved mount ready to merge speak ahead of one in the merge queue', () => {
    expect(labelOf([QUEUED, APPROVED])).toBe('PR #331');
  });

  it('lets the merge queue speak ahead of a mount that already merged', () => {
    expect(labelOf([MERGED, QUEUED])).toBe('PR #327');
  });

  it('lets failing checks speak ahead of the merge queue', () => {
    const failing: Seed = { slug: 'failing', number: 332, over: { checks: 'failure' } };

    expect(labelOf([QUEUED, failing])).toBe('PR #332');
  });

  describe('a removed branch', () => {
    const REMOVED = 'removed';

    const removedViewOf = (): SessionMountView => ({
      ...viewOf(REMOVED),
      worktreePath: null,
      lastWorktreePath: `/tmp/payments-api/${REMOVED}`,
      isAttached: false,
      diskState: 'removed',
    });

    type LinkParams = {
      readonly provider: MountPullRequestProvider;
      readonly state: MountPullRequestLink['state'];
    };

    const linkOf = ({ provider, state }: LinkParams): MountPullRequestLink => ({
      id: 'link-removed',
      mountId: mountIdOf(REMOVED),
      provider,
      host: provider === 'github' ? 'github.com' : `${provider}.example.test`,
      repoSlug: 'harborline/payments-api',
      prNumber: 41,
      headBranch: `harborline/${REMOVED}`,
      baseBranch: 'main',
      url: 'https://example.test/pull/41',
      state,
      snapshot: null,
      mergedAt: state === 'merged' ? DATE : null,
      lastObservedAt: DATE,
      createdAt: DATE,
      updatedAt: DATE,
    });

    type HistoryParams = LinkParams & {
      readonly seeds?: ReadonlyArray<Seed>;
    };

    const historyOf = ({ provider, state, seeds = [] }: HistoryParams) => {
      const live = stateOf(seeds);
      return {
        ...live,
        sessionMounts: { [SESSION]: [removedViewOf(), ...seeds.map((seed) => viewOf(seed.slug))] },
        mountPrLinks: { [mountIdOf(REMOVED)]: linkOf({ provider, state }) },
      };
    };

    it.each([
      ['github', 'PR #41'],
      ['gitlab', 'MR !41'],
      ['bitbucket', 'PR #41'],
    ] as const)('keeps the merged %s request of a deleted branch', (provider, label) => {
      const request = sessionStageRequestOf({
        state: historyOf({ provider, state: 'merged' }),
        sessionId: SESSION,
      });

      expect(request?.requestLabel).toBe(label);
      expect(request?.pr.state).toBe('merged');
    });

    it.each(['github', 'gitlab', 'bitbucket'] as const)(
      'does not settle a session on a closed %s request',
      (provider) => {
        expect(
          sessionStageRequestOf({
            state: historyOf({ provider, state: 'closed' }),
            sessionId: SESSION,
          }),
        ).toBeNull();
      },
    );

    it('lets a second live branch speak ahead of the merged history', () => {
      const request = sessionStageRequestOf({
        state: historyOf({ provider: 'github', state: 'merged', seeds: [IN_REVIEW] }),
        sessionId: SESSION,
      });

      expect(request?.requestLabel).toBe('PR #330');
    });

    it('lets a removed branch whose request is still open keep the session open', () => {
      const request = sessionStageRequestOf({
        state: historyOf({ provider: 'github', state: 'open' }),
        sessionId: SESSION,
      });

      expect(request?.pr.state).toBe('open');
    });

    it('brings nothing from history once the branch is attached again', () => {
      const state = historyOf({ provider: 'github', state: 'merged' });
      const removed = removedViewOf();

      expect(
        sessionStageRequestOf({
          state: {
            ...state,
            sessionMounts: {
              [SESSION]: [
                {
                  ...removed,
                  worktreePath: '/tmp/payments-api/removed',
                  isAttached: true,
                  diskState: 'present',
                },
              ],
            },
          },
          sessionId: SESSION,
        }),
      ).toBeNull();
    });
  });
});
