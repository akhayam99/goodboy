import { describe, expect, it } from 'vitest';
import { matchStrandedWriterLease } from './strandedWriterLeaseError';

describe('matchStrandedWriterLease', () => {
  it('reads the holder and the resource out of a stranded lease timeout', () => {
    expect(
      matchStrandedWriterLease({
        message:
          'gave up after waiting 1800000ms for a writer lease on repo:/repos/app, held by agent-1 in state unknown',
      }),
    ).toEqual({ waitedMs: 1800000, resource: 'repo:/repos/app', holder: 'agent-1' });
  });

  it('does not match an ordinary writer that is still alive', () => {
    expect(
      matchStrandedWriterLease({
        message:
          'gave up after waiting 1800000ms for a writer lease on repo:/repos/app, held by agent-1 in state active',
      }),
    ).toBeNull();
  });

  it('does not match an unrelated error', () => {
    expect(matchStrandedWriterLease({ message: 'provider exited without a response.' })).toBeNull();
  });
});
