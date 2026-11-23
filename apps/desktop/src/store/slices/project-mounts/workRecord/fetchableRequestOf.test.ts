// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type MountPullRequestLink,
  type MountPullRequestProvider,
  type MountPullRequestState,
} from '@goodboy/types';
import { fetchableRequestOf } from './fetchableRequestOf';

const AT = brandId<IsoDateTime>({ value: '2026-11-20T09:00:00.000Z' });

type LinkParams = {
  readonly provider: MountPullRequestProvider;
  readonly state: MountPullRequestState;
};

const linkOf = ({ provider, state }: LinkParams): MountPullRequestLink => ({
  id: 'link-relay',
  mountId: brandId<MountId>({ value: 'mount-notify-relay' }),
  provider,
  host: 'github.com',
  repoSlug: 'harborline/notify-relay',
  prNumber: 96,
  headBranch: 'hl/relay-backoff',
  baseBranch: 'main',
  url: 'https://github.com/harborline/notify-relay/pull/96',
  state,
  snapshot: null,
  lastObservedAt: AT,
  createdAt: AT,
  updatedAt: AT,
});

describe('fetchableRequestOf', () => {
  it('names an open stored request on a host whose head can be fetched', () => {
    expect(fetchableRequestOf({ link: linkOf({ provider: 'github', state: 'open' }) })).toEqual({
      provider: 'github',
      prNumber: 96,
    });
    expect(
      fetchableRequestOf({ link: linkOf({ provider: 'gitlab', state: 'draft' }) }),
    ).not.toBeNull();
  });

  it('names nothing without a stored link, for a settled request or a host with no head ref', () => {
    expect(fetchableRequestOf({ link: null })).toBeNull();
    expect(
      fetchableRequestOf({ link: linkOf({ provider: 'github', state: 'merged' }) }),
    ).toBeNull();
    expect(
      fetchableRequestOf({ link: linkOf({ provider: 'github', state: 'closed' }) }),
    ).toBeNull();
    expect(
      fetchableRequestOf({ link: linkOf({ provider: 'bitbucket', state: 'open' }) }),
    ).toBeNull();
  });
});
