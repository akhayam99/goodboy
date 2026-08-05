import { describe, expect, it } from 'vitest';
import {
  availableProviderCount,
  resolvePullRequestProvider,
  type PullRequestAvailability,
} from './resolvePullRequestProvider';

const availability = (
  overrides: Partial<PullRequestAvailability> = {},
): PullRequestAvailability => ({
  github: false,
  gitlab: false,
  bitbucket: false,
  ...overrides,
});

describe('resolvePullRequestProvider', () => {
  it('picks the only host that has data, whatever the remote says', () => {
    expect(
      resolvePullRequestProvider({
        selected: null,
        availability: availability({ bitbucket: true }),
        remoteKind: 'other',
      }),
    ).toBe('bitbucket');
  });

  it('prefers the remote host when two hosts have data', () => {
    expect(
      resolvePullRequestProvider({
        selected: null,
        availability: availability({ github: true, gitlab: true }),
        remoteKind: 'gitlab',
      }),
    ).toBe('gitlab');
  });

  it('falls back to the priority order when three hosts have data and the remote is unknown', () => {
    expect(
      resolvePullRequestProvider({
        selected: null,
        availability: availability({ github: true, gitlab: true, bitbucket: true }),
        remoteKind: 'other',
      }),
    ).toBe('github');
  });

  it('honours an explicit pick and ignores one pointing at an empty host', () => {
    const three = availability({ github: true, gitlab: true, bitbucket: true });
    expect(
      resolvePullRequestProvider({ selected: 'bitbucket', availability: three, remoteKind: null }),
    ).toBe('bitbucket');
    expect(
      resolvePullRequestProvider({
        selected: 'bitbucket',
        availability: availability({ github: true }),
        remoteKind: null,
      }),
    ).toBe('github');
  });

  it('counts only the hosts that have data', () => {
    expect(availableProviderCount({ availability: availability() })).toBe(0);
    expect(availableProviderCount({ availability: availability({ bitbucket: true }) })).toBe(1);
    expect(
      availableProviderCount({
        availability: availability({ github: true, gitlab: true, bitbucket: true }),
      }),
    ).toBe(3);
  });
});
