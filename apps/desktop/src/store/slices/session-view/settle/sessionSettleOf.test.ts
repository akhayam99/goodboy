// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type MountId,
  type MountPullRequestLink,
  type MountPullRequestProvider,
  type ProjectId,
  type SessionId,
  type ResolveThread,
  type SessionMountView,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { at } from '../../../../features/workspace/testing/sessionColumn';
import { sessionSettleOf } from './sessionSettleOf';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const PROJECT = brandId<ProjectId>({ value: 'project-payments-api' });
const DATE = at('2026-10-07T09:00:00.000Z');
const MERGED_AT = at('2026-10-08T12:00:00.000Z');

const mountIdOf = (slug: string): MountId => brandId<MountId>({ value: `mount-${slug}` });

type ViewParams = {
  readonly slug: string;
  readonly isAttached?: boolean;
};

const viewOf = ({ slug, isAttached = false }: ViewParams): SessionMountView => ({
  id: mountIdOf(slug),
  sessionId: SESSION,
  projectId: PROJECT,
  worktreePath: isAttached ? `/tmp/payments-api/${slug}` : null,
  lastWorktreePath: `/tmp/payments-api/${slug}`,
  branch: `harborline/${slug}`,
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: 'payments-api',
  repoSlug: null,
  repoRoot: '/tmp/payments-api',
  isAttached,
  diskState: isAttached ? 'present' : 'removed',
  revision: 1,
  createdAt: DATE,
  updatedAt: DATE,
});

type LinkParams = {
  readonly slug: string;
  readonly provider: MountPullRequestProvider;
  readonly state: MountPullRequestLink['state'];
};

const linkOf = ({ slug, provider, state }: LinkParams): MountPullRequestLink => ({
  id: `link-${slug}`,
  mountId: mountIdOf(slug),
  provider,
  host: provider === 'gitlab' ? 'gitlab.example.test' : 'github.example.test',
  repoSlug: 'harborline/payments-api',
  prNumber: 12,
  headBranch: `harborline/${slug}`,
  baseBranch: 'main',
  url: 'https://example.test/pull/12',
  state,
  snapshot: null,
  mergedAt: state === 'merged' ? MERGED_AT : null,
  lastObservedAt: DATE,
  createdAt: DATE,
  updatedAt: DATE,
});

type StateParams = {
  readonly views: ReadonlyArray<SessionMountView>;
  readonly links: ReadonlyArray<MountPullRequestLink>;
  readonly threads?: ReadonlyArray<{ readonly state: ResolveThread['state'] }>;
  readonly startedAt?: string;
};

const stateOf = ({ views, links, threads = [], startedAt }: StateParams) => ({
  sessionMounts: { [SESSION]: views },
  sessionProjectMounts: {},
  mountGithub: {},
  mountRequests: {},
  mountPrLinks: Object.fromEntries(links.map((link) => [link.mountId, link])),
  sessionPhaseRuns:
    startedAt === undefined
      ? {}
      : {
          [SESSION]: [
            anAgent({ sessionId: SESSION, status: 'completed', startedAt: at(startedAt) }),
          ],
        },
  sessionResolveThreads: { [SESSION]: threads },
});

const PROVIDERS: ReadonlyArray<MountPullRequestProvider> = ['github', 'gitlab', 'bitbucket'];

const settleOf = (state: ReturnType<typeof stateOf>) =>
  sessionSettleOf({ state, sessionId: SESSION });

describe('sessionSettleOf', () => {
  it.each(PROVIDERS)('reads the merge time of a deleted %s branch', (provider) => {
    const state = stateOf({
      views: [viewOf({ slug: 'retry' })],
      links: [linkOf({ slug: 'retry', provider, state: 'merged' })],
    });

    expect(settleOf(state)).toEqual({ isSettled: true, settledAt: Date.parse(MERGED_AT) });
  });

  it('is settled with no time for a closed pull request', () => {
    const state = stateOf({
      views: [viewOf({ slug: 'retry' })],
      links: [linkOf({ slug: 'retry', provider: 'github', state: 'closed' })],
    });

    expect(settleOf(state)).toEqual({ isSettled: true, settledAt: null });
  });

  it('is not settled while the session holds a second branch with no request', () => {
    const state = stateOf({
      views: [viewOf({ slug: 'retry' }), viewOf({ slug: 'ledger', isAttached: true })],
      links: [linkOf({ slug: 'retry', provider: 'github', state: 'merged' })],
    });

    expect(settleOf(state)).toEqual({ isSettled: false, settledAt: null });
  });

  it('is settled when both branches merged and takes the later merge', () => {
    const state = stateOf({
      views: [viewOf({ slug: 'retry' }), viewOf({ slug: 'ledger' })],
      links: [
        linkOf({ slug: 'retry', provider: 'github', state: 'merged' }),
        {
          ...linkOf({ slug: 'ledger', provider: 'gitlab', state: 'merged' }),
          mergedAt: at('2026-10-09T12:00:00.000Z'),
        },
      ],
    });

    expect(settleOf(state).settledAt).toBe(Date.parse('2026-10-09T12:00:00.000Z'));
  });

  it('is not settled with an open request on a removed branch history', () => {
    const state = stateOf({
      views: [viewOf({ slug: 'retry' })],
      links: [linkOf({ slug: 'retry', provider: 'github', state: 'open' })],
    });

    expect(settleOf(state).isSettled).toBe(false);
  });

  it('is not settled while a review thread waits', () => {
    const state = stateOf({
      views: [viewOf({ slug: 'retry' })],
      links: [linkOf({ slug: 'retry', provider: 'github', state: 'merged' })],
      threads: [{ state: 'needs_answer' }],
    });

    expect(settleOf(state).isSettled).toBe(false);
  });

  it('is not settled once an agent started after the merge', () => {
    const state = stateOf({
      views: [viewOf({ slug: 'retry' })],
      links: [linkOf({ slug: 'retry', provider: 'github', state: 'merged' })],
      startedAt: '2026-10-08T13:00:00.000Z',
    });

    expect(settleOf(state).isSettled).toBe(false);
  });

  it('is not settled for a session with no branch', () => {
    const state = stateOf({
      views: [{ ...viewOf({ slug: 'retry' }), branch: '' }],
      links: [],
    });

    expect(settleOf(state).isSettled).toBe(false);
  });
});
