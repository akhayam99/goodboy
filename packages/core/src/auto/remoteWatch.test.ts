import { describe, expect, it } from 'vitest';
import { remoteVerdictOf, type RemoteRead } from './remoteWatch';

const at = (sha: string): RemoteRead => ({ kind: 'sha', branch: 'ak/ledger-export', sha });
const ABSENT: RemoteRead = { kind: 'absent', branch: 'ak/ledger-export' };
const UNKNOWN: RemoteRead = { kind: 'unknown' };

describe('remoteVerdictOf', () => {
  it('reads unchanged when the online sha is the same', () => {
    expect(remoteVerdictOf({ before: at('aaa111'), after: at('aaa111') })).toEqual({
      status: 'unchanged',
      branch: 'ak/ledger-export',
      before: 'aaa111',
      after: 'aaa111',
    });
  });

  it('reads moved when the online sha changed', () => {
    expect(remoteVerdictOf({ before: at('aaa111'), after: at('bbb222') })).toEqual({
      status: 'moved',
      branch: 'ak/ledger-export',
      before: 'aaa111',
      after: 'bbb222',
    });
  });

  it('reads moved when the branch appeared online and unchanged when it stayed absent', () => {
    expect(remoteVerdictOf({ before: ABSENT, after: at('bbb222') })?.status).toBe('moved');
    expect(remoteVerdictOf({ before: at('aaa111'), after: ABSENT })?.status).toBe('moved');
    expect(remoteVerdictOf({ before: ABSENT, after: ABSENT })?.status).toBe('unchanged');
  });

  it('reads unknown, never clean, when either read failed or the branch differs', () => {
    expect(remoteVerdictOf({ before: at('aaa111'), after: UNKNOWN })?.status).toBe('unknown');
    expect(remoteVerdictOf({ before: UNKNOWN, after: at('aaa111') })?.status).toBe('unknown');
    expect(
      remoteVerdictOf({
        before: at('aaa111'),
        after: { kind: 'sha', branch: 'ak/other', sha: 'aaa111' },
      })?.status,
    ).toBe('unknown');
  });

  it('has no verdict when no baseline was recorded', () => {
    expect(remoteVerdictOf({ before: null, after: at('aaa111') })).toBeNull();
  });
});
