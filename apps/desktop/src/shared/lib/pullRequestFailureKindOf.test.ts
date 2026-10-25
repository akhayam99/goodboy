// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { HOST_FAILURE_KINDS } from './testing/hostFailureKinds';
import { pullRequestFailureKindOf } from './pullRequestFailureKindOf';

describe('pullRequestFailureKindOf', () => {
  it.each([
    ['bad_credentials', 'denied'],
    ['denied', 'denied'],
    ['not_found', 'failed'],
    ['rate_limited', 'rate_limited'],
    ['network', 'network'],
    ['timeout', 'network'],
    ['failed', 'failed'],
  ] as const)('reads the host failure %s as %s', (kind, expected) => {
    expect(pullRequestFailureKindOf({ kind })).toBe(expected);
  });

  it('answers for every kind Rust can send', () => {
    for (const kind of HOST_FAILURE_KINDS) {
      expect(['denied', 'failed', 'rate_limited', 'network']).toContain(
        pullRequestFailureKindOf({ kind }),
      );
    }
  });
});
