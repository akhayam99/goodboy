import { describe, expect, it } from 'vitest';
import { hostFromRemote, hostsInOrder, remoteLabel } from './hostFromRemote';

describe('hostFromRemote', () => {
  it('reads github from https and scp remotes', () => {
    expect(hostFromRemote('https://github.com/northwind/ledger-core.git')).toBe('github');
    expect(hostFromRemote('git@github.com:northwind/ledger-core.git')).toBe('github');
  });

  it('reads gitlab.com and a self-hosted gitlab', () => {
    expect(hostFromRemote('https://gitlab.com/acme/payments-api.git')).toBe('gitlab');
    expect(hostFromRemote('git@gitlab.acme.dev:acme/payments-api.git')).toBe('gitlab');
  });

  it('reads bitbucket.org', () => {
    expect(hostFromRemote('git@bitbucket.org:cascadia/notify-relay.git')).toBe('bitbucket');
  });

  it('returns null without a remote or on an unknown host', () => {
    expect(hostFromRemote(null)).toBeNull();
    expect(hostFromRemote('')).toBeNull();
    expect(hostFromRemote('https://git.harborline.dev/ledger-core.git')).toBeNull();
  });
});

describe('remoteLabel', () => {
  it('shows host and path without the .git suffix', () => {
    expect(remoteLabel('git@github.com:northwind/ledger-core.git')).toBe(
      'github.com/northwind/ledger-core',
    );
  });

  it('returns null without a remote', () => {
    expect(remoteLabel(null)).toBeNull();
  });
});

describe('hostsInOrder', () => {
  it('puts the origin host first', () => {
    expect(hostsInOrder('bitbucket')).toEqual(['bitbucket', 'github', 'gitlab']);
    expect(hostsInOrder(null)).toEqual(['github', 'gitlab', 'bitbucket']);
  });
});
