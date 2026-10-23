// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ProjectId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import { brandedId } from '../../../features/history/testing/brandedId';
import { issueRepoProjectIds } from './issueRepoProjectIds';

type RepoParams = {
  readonly id: string;
  readonly remoteUrl: string;
};

const repo = ({ id, remoteUrl }: RepoParams) =>
  aProject({ id: brandedId<ProjectId>({ value: id }), name: id, remoteUrl });

const GITLAB_HOSTS = ['gitlab.internal'];

describe('issueRepoProjectIds', () => {
  it('matches the host as well as the path, so the same path on another host mounts nothing', () => {
    const projects = [
      repo({ id: 'cloud', remoteUrl: 'https://gitlab.com/acme/ledger-core.git' }),
      repo({ id: 'internal', remoteUrl: 'git@gitlab.internal:acme/ledger-core.git' }),
    ];

    expect(
      issueRepoProjectIds({
        issues: [{ provider: 'gitlab', url: 'https://gitlab.com/acme/ledger-core/-/issues/7' }],
        projects,
        gitlabHosts: GITLAB_HOSTS,
      }),
    ).toEqual(['cloud']);
    expect(
      issueRepoProjectIds({
        issues: [
          { provider: 'gitlab', url: 'https://gitlab.internal/acme/ledger-core/-/issues/7' },
        ],
        projects,
        gitlabHosts: GITLAB_HOSTS,
      }),
    ).toEqual(['internal']);
  });

  it('matches an SSH and an https remote of the same host', () => {
    const projects = [
      repo({ id: 'ssh', remoteUrl: 'git@github.com:acme/payments-api.git' }),
      repo({ id: 'https', remoteUrl: 'https://github.com/Acme/payments-api' }),
      repo({ id: 'ssh-url', remoteUrl: 'ssh://git@github.com/acme/payments-api.git' }),
      repo({ id: 'other', remoteUrl: 'git@github.com:acme/notify-relay.git' }),
    ];

    expect(
      issueRepoProjectIds({
        issues: [{ provider: 'github', url: 'https://github.com/acme/payments-api/issues/12' }],
        projects,
        gitlabHosts: GITLAB_HOSTS,
      }),
    ).toEqual(['ssh', 'https', 'ssh-url']);
  });

  it('skips a provider with no repo', () => {
    expect(
      issueRepoProjectIds({
        issues: [{ provider: 'linear', url: 'https://linear.app/acme/issue/ACM-1' }],
        projects: [repo({ id: 'ssh', remoteUrl: 'git@github.com:acme/payments-api.git' })],
        gitlabHosts: GITLAB_HOSTS,
      }),
    ).toEqual([]);
  });
});
