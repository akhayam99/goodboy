// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type MountId,
  type MountPullRequestLink,
  type MountPullRequestProvider,
  type ProjectId,
  type SessionId,
  type SessionMountView,
} from '@goodboy/types';
import { at } from '../../../../features/workspace/testing/sessionColumn';
import { soleMergedAtOf } from './soleMergedAtOf';

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
};

const stateOf = ({ views, links }: StateParams) => ({
  sessionMounts: { [SESSION]: views },
  sessionProjectMounts: {},
  mountGithub: {},
  mountRequests: {},
  mountPrLinks: Object.fromEntries(links.map((link) => [link.mountId, link])),
});

const PROVIDERS: ReadonlyArray<MountPullRequestProvider> = ['github', 'gitlab', 'bitbucket'];

describe('soleMergedAtOf', () => {
  it.each(PROVIDERS)('reads the merge time of a deleted %s branch', (provider) => {
    const state = stateOf({
      views: [viewOf({ slug: 'retry' })],
      links: [linkOf({ slug: 'retry', provider, state: 'merged' })],
    });

    expect(soleMergedAtOf({ state, sessionId: SESSION })).toBe(Date.parse(MERGED_AT));
  });

  it('is null for a closed pull request', () => {
    const state = stateOf({
      views: [viewOf({ slug: 'retry' })],
      links: [linkOf({ slug: 'retry', provider: 'github', state: 'closed' })],
    });

    expect(soleMergedAtOf({ state, sessionId: SESSION })).toBeNull();
  });

  it('is null while the session holds a second branch', () => {
    const state = stateOf({
      views: [viewOf({ slug: 'retry' }), viewOf({ slug: 'ledger', isAttached: true })],
      links: [linkOf({ slug: 'retry', provider: 'github', state: 'merged' })],
    });

    expect(soleMergedAtOf({ state, sessionId: SESSION })).toBeNull();
  });
});
