// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { requestHostOfRemote } from './requestHostOfRemote';

describe('requestHostOfRemote', () => {
  it('names GitHub for an ssh and an https remote', () => {
    expect(
      requestHostOfRemote({ url: 'git@github.com:harborline/ledger-core.git', gitlabHosts: [] }),
    ).toBe('github');
    expect(
      requestHostOfRemote({ url: 'https://github.com/harborline/ledger-core', gitlabHosts: [] }),
    ).toBe('github');
  });

  it('names Bitbucket for the cloud host', () => {
    expect(
      requestHostOfRemote({
        url: 'git@bitbucket.org:harborline/payments-api.git',
        gitlabHosts: [],
      }),
    ).toBe('bitbucket');
  });

  it('names GitLab for gitlab.com and for a self-hosted host the workspace connected', () => {
    expect(
      requestHostOfRemote({
        url: 'https://gitlab.com/harborline/notify-relay.git',
        gitlabHosts: [],
      }),
    ).toBe('gitlab');
    expect(
      requestHostOfRemote({
        url: 'git@code.northwind.test:harborline/notify-relay.git',
        gitlabHosts: ['code.northwind.test'],
      }),
    ).toBe('gitlab');
  });

  it('names nothing for a remote no host owns and for no remote at all', () => {
    expect(
      requestHostOfRemote({
        url: 'git@code.northwind.test:harborline/notify-relay.git',
        gitlabHosts: [],
      }),
    ).toBeNull();
    expect(requestHostOfRemote({ url: null, gitlabHosts: [] })).toBeNull();
  });
});
