import { describe, expect, it } from 'vitest';
import { classifyGhFailure, type GhFailureKind } from '../classifyGhFailure';

type Sample = {
  readonly name: string;
  readonly stderr: string;
  readonly kind: GhFailureKind;
};

const SAMPLES: ReadonlyArray<Sample> = [
  {
    name: 'a rate limit that carries HTTP 403',
    stderr: 'gh: API rate limit exceeded for user ID 12345. (HTTP 403)',
    kind: 'rate-limited',
  },
  {
    name: 'a secondary rate limit',
    stderr:
      'gh: You have exceeded a secondary rate limit. Please wait a few minutes before you try again. (HTTP 403)',
    kind: 'rate-limited',
  },
  {
    name: 'an offline machine',
    stderr:
      'error connecting to api.github.com/user\ncheck your internet connection or https://githubstatus.com',
    kind: 'network',
  },
  {
    name: 'a host that does not resolve',
    stderr: 'Get "https://api.github.com/user": dial tcp: lookup api.github.com: no such host\n',
    kind: 'network',
  },
  {
    name: 'a timeout while dialling',
    stderr: 'dial tcp 140.82.121.6:443: i/o timeout',
    kind: 'network',
  },
  {
    name: 'an untrusted certificate chain',
    stderr:
      'Get "https://api.github.com/user": tls: failed to verify certificate: x509: certificate signed by unknown authority',
    kind: 'network',
  },
  {
    name: 'an expired certificate, which is not an expired token',
    stderr:
      'Get "https://api.github.com/user": tls: failed to verify certificate: x509: certificate has expired or is not yet valid: current time 2026-08-06T10:00:00Z is after 2025-01-01T00:00:00Z',
    kind: 'network',
  },
  {
    name: 'SAML enforcement',
    stderr:
      'HTTP 403: Resource protected by organization SAML enforcement. You must grant your token access to this organization.',
    kind: 'denied',
  },
  {
    name: 'a token without the access',
    stderr: 'HTTP 403: Resource not accessible by personal access token',
    kind: 'denied',
  },
  {
    name: 'a token missing a scope',
    stderr: 'error: your authentication token is missing required scopes [repo]\n',
    kind: 'denied',
  },
  { name: 'bad credentials', stderr: 'gh: Bad credentials (HTTP 401)\n', kind: 'auth' },
  {
    name: 'an expired token',
    stderr: 'gh: Token expired, create a new one (HTTP 401)\n',
    kind: 'auth',
  },
  {
    name: 'a token that has expired',
    stderr: 'gh: the token has expired (HTTP 401)',
    kind: 'auth',
  },
  {
    name: 'text nobody has seen before',
    stderr: 'gh: something new went wrong\nstack noise\n',
    kind: 'failed',
  },
  { name: 'a silent failure', stderr: '   \n', kind: 'failed' },
];

describe('classifyGhFailure', () => {
  it.each(SAMPLES.map((sample) => [sample.name, sample] as const))('reads %s', (_name, sample) => {
    expect(classifyGhFailure({ stderr: sample.stderr })).toBe(sample.kind);
  });

  it('matches in lower case whatever case gh prints', () => {
    expect(classifyGhFailure({ stderr: 'RESOURCE NOT ACCESSIBLE BY INTEGRATION' })).toBe('denied');
  });

  it('keeps the order the Rust side uses, so a rate limited 403 is never a permission problem', () => {
    expect(
      classifyGhFailure({
        stderr: 'API rate limit exceeded. Resource not accessible. (HTTP 403)',
      }),
    ).toBe('rate-limited');
  });

  it('never calls an empty message denied', () => {
    expect(classifyGhFailure({ stderr: '' })).toBe('failed');
  });
});
