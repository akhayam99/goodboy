// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hostFailureKindOf } from './hostFailure';
import { HOST_FAILURE_KINDS } from './testing/hostFailureKinds';
import { hostFailureOf } from './hostFailureOf';

describe('hostFailureKindOf', () => {
  it.each(HOST_FAILURE_KINDS)('knows the kind %s', (kind) => {
    expect(hostFailureKindOf({ value: kind })).toBe(kind);
  });

  it.each(['teapot', '', 'Denied', 4, null, undefined])('does not know %j', (value) => {
    expect(hostFailureKindOf({ value })).toBeNull();
  });
});

describe('hostFailureOf', () => {
  it('reads the whole wire form', () => {
    expect(
      hostFailureOf({
        rejection: {
          kind: 'rate_limited',
          message: 'http error 429: slow',
          failureKind: 'rate_limited',
          status: 429,
          retryAfterSeconds: 9,
          detail: 'slow',
        },
      }),
    ).toEqual({ kind: 'rate_limited', status: 429, retryAfterSeconds: 9, detail: 'slow' });
  });

  it('leaves absent or malformed fields empty', () => {
    expect(
      hostFailureOf({
        rejection: { failureKind: 'timeout', status: 'x', retryAfterSeconds: null, detail: 4 },
      }),
    ).toEqual({ kind: 'timeout', status: null, retryAfterSeconds: null, detail: null });
  });

  it.each([null, undefined, 'denied', 7, {}, { failureKind: 'teapot' }])(
    'reads %j as no failure',
    (rejection) => {
      expect(hostFailureOf({ rejection })).toBeNull();
    },
  );
});
